const { AucBot } = require('./utils/autobuy');
const { SellBot } = require('./utils/autosell');
const { CaseBot } = require('./utils/getcase');
const { ProxyPool } = require('./utils/proxypool');
const { launchAll } = require('./utils/launcher');
const { createLogger } = require('./utils/logger');
const { killSwitch } = require('./utils/killswitch');
const config = require('./config');

const log = createLogger('main');

// Глобальные ошибки: логируем, но НЕ выходим (скрипт должен жить бесконечно).
// Важно: сетевые/протокольные ошибки у ботов должны обрабатываться на уровне bot.on('error') с реконнектом.
process.on('uncaughtException', (err) => {
    try { log.error('[uncaughtException]', err); } catch { /* ignore */ }
});
process.on('unhandledRejection', (reason) => {
    try { log.error('[unhandledRejection]', reason); } catch { /* ignore */ }
});

const {
    SELL_BOTS,
    AUC_BOTS,
    ANARCHIES,
    BOTS_PER_ANARCHY,
    CASE_STAGGER_MIN_MS,
    CASE_STAGGER_MAX_MS,
    MAX_ACTIVE_CASE_BOTS,
    MEMORY_RSS_RESTART_MB,
    MEMORY_WATCHDOG_INTERVAL_MS,
    ENABLE_SELL_BOTS,
    ENABLE_AUC_BOTS,
} = config;

/* ───────── helpers ───────── */

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

/** Случайная задержка 0–3 с (между запусками CaseBot). */
function randomCaseStagger() {
    return CASE_STAGGER_MIN_MS + Math.floor(Math.random() * (CASE_STAGGER_MAX_MS - CASE_STAGGER_MIN_MS + 1));
}

/* ───────── unique nicknames ───────── */

const MC_NAME_FIRST = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const MC_NAME_REST  = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_';

/** Случайный ник 6–16 символов, уникальный в `used`. 1 ник = 1 кейс. */
function randomCaseUsername(used) {
    if (used.size >= MAX_CASE_NAMES) used.clear();
    for (let attempt = 0; attempt < 1000; attempt++) {
        const len = 6 + Math.floor(Math.random() * 11);
        let s = MC_NAME_FIRST[Math.floor(Math.random() * MC_NAME_FIRST.length)];
        for (let i = 1; i < len; i++) {
            s += MC_NAME_REST[Math.floor(Math.random() * MC_NAME_REST.length)];
        }
        if (!used.has(s)) {
            used.add(s);
            return s;
        }
    }
    // Fallback: timestamp-based
    const tail = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const s = (`b${tail}`).replace(/[^a-zA-Z0-9_]/g, 'x').slice(0, 16);
    used.add(s);
    return s;
}

/* ───────── AucBot registry ───────── */

const aucBotRegistry = {
    /** @type {Map<string, { username: string, anarchy: number, online: boolean }>} */
    _bots: new Map(),
    _rr: 0,

    register(username, anarchy) {
        this._bots.set(username, { username, anarchy, online: false });
    },

    setOnline(username, online) {
        const entry = this._bots.get(username);
        if (entry) entry.online = online;
    },

    pickRoundRobin() {
        const ordered = [...this._bots.values()];
        if (ordered.length === 0) return null;
        const online = ordered.filter((b) => b.online);
        const pool = online.length > 0 ? online : ordered;
        const i = this._rr % pool.length;
        this._rr++;
        return pool[i];
    },
};

for (const b of AUC_BOTS) {
    aucBotRegistry.register(b.username, b.anarchy);
}

/* ───────── proxy ───────── */

const proxyPool = new ProxyPool();

/* ───────── case line spawner ───────── */

/** Глобальный пул использованных ников — чтобы ник никогда не повторялся. */
const caseNameUsed = new Set();
const MAX_CASE_NAMES = 150;

/* ───────── simple CaseBot concurrency limiter ───────── */

let activeCaseBots = 0;
/** @type {Array<() => void>} */
const caseWaiters = [];

function caseCap() {
    const v = MAX_ACTIVE_CASE_BOTS;
    if (v == null) return 0;
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

async function acquireCaseSlot() {
    const cap = caseCap();
    if (!cap) {
        activeCaseBots++;
        return;
    }
    while (activeCaseBots >= cap) {
        await new Promise((resolve) => caseWaiters.push(resolve));
    }
    activeCaseBots++;
}

function releaseCaseSlot() {
    const cap = caseCap();
    activeCaseBots = Math.max(0, activeCaseBots - 1);
    if (!cap) return;
    const next = caseWaiters.shift();
    if (next) next();
}

async function spawnCaseLine(anarchy, pool) {
    if (killSwitch.isTripped()) return;
    await acquireCaseSlot();

    let proxy = pool?.acquire() ?? null;
    if (!proxy && pool && pool.proxies.length > 0) {
        const wait = pool.nextUnbanIn();
        if (wait > 0) {
            log.info(`[main] an${anarchy}: нет прокси, ждём ${Math.round(wait / 1000)} с`);
            await sleep(wait + 500);
            proxy = pool.acquire();
        }
    }
    const username = randomCaseUsername(caseNameUsed);
    log.info(`[main] запуск CaseBot ${username} (an${anarchy})`);
    let released = false;
    try {
        new CaseBot(username, {
            anarchy,
            proxy,
            proxyPool: pool,
            aucBotRegistry,
            onLineEnd: () => {
                if (!released) {
                    released = true;
                    releaseCaseSlot();
                }
                // Новый бот с новым ником (1 ник = 1 кейс), если не сработал kill switch.
                if (!killSwitch.isTripped()) void spawnCaseLine(anarchy, pool);
            },
        });
    } catch (e) {
        // Если конструктор упал — освобождаем слот, иначе очередь “залипнет”.
        if (!released) {
            released = true;
            releaseCaseSlot();
        }
        throw e;
    }
}

/* ───────── main ───────── */

(async () => {
    // Watchdog памяти: лог и мягкий self-exit до OOM (дальше pm2/ps1/cmd перезапустит)
    const rssLimitMb = Number(MEMORY_RSS_RESTART_MB);
    const watchdogMs = Number(MEMORY_WATCHDOG_INTERVAL_MS) || 60_000;
    if (Number.isFinite(rssLimitMb) && rssLimitMb > 0) {
        setInterval(() => {
            const mu = process.memoryUsage();
            const rssMb = Math.round(mu.rss / 1024 / 1024);
            const heapMb = Math.round(mu.heapUsed / 1024 / 1024);
            log.info(`[mem] rss=${rssMb}MB heap=${heapMb}MB activeCase=${activeCaseBots}`);
            if (rssMb >= rssLimitMb) {
                log.error(`[mem] rss>=${rssLimitMb}MB → выход для перезапуска супервизором`);
                // Небольшая задержка, чтобы лог успел записаться.
                setTimeout(() => process.exit(1), 250);
            }
        }, Math.max(10_000, watchdogMs)).unref?.();
    }

    // Проверка прокси перед запуском
    if (proxyPool.proxies.length > 0) {
        log.info(`[main] Проверяем ${proxyPool.proxies.length} прокси...`);
        const { alive, dead } = await proxyPool.checkAll();
        log.info(`[main] Прокси: ${alive} живых, ${dead} мёртвых`);
        if (alive === 0 && dead > 0) {
            log.error('[main] Все прокси мертвы! Боты запустятся без прокси.');
        }
    }

    const caseSlotsTotal = ANARCHIES.length * BOTS_PER_ANARCHY;
    log.info(
        `[main] Case: ${caseSlotsTotal} линий (${BOTS_PER_ANARCHY}×${ANARCHIES.length}), ` +
        `Sell: ${ENABLE_SELL_BOTS ? SELL_BOTS.length : 0} (вкл: ${!!ENABLE_SELL_BOTS}), ` +
        `Auc: ${ENABLE_AUC_BOTS ? AUC_BOTS.length : 0} (вкл: ${!!ENABLE_AUC_BOTS}), ` +
        `прокси: ${proxyPool.proxies.length}`,
    );
    const cap = caseCap();
    if (cap) log.info(`[main] Case cap: максимум ${cap} одновременных CaseBot`);
    else log.info('[main] Case cap: без лимита (одновременно все линии по ANARCHIES×BOTS_PER_ANARCHY)');

    // Запуск CaseBot-ов: 3 бота на анархию, задержка 0-3с между запусками
    let totalDelay = 0;
    for (const an of ANARCHIES) {
        for (let i = 0; i < BOTS_PER_ANARCHY; i++) {
            const d = totalDelay;
            setTimeout(() => void spawnCaseLine(an, proxyPool), d);
            totalDelay += randomCaseStagger();
        }
    }

    const sellJobs = SELL_BOTS.map(({ username, anarchy }) => ({ username, anarchy }));
    const aucJobs = AUC_BOTS.map(({ username, anarchy }) => ({ username, anarchy }));

    const toLaunch = [];
    if (ENABLE_SELL_BOTS) {
        toLaunch.push(launchAll({ BotClass: SellBot, jobs: sellJobs, proxyPool }));
    } else {
        log.info('[main] SellBot не запускается — ENABLE_SELL_BOTS=false в config.js (включи true для возврата)');
    }
    if (ENABLE_AUC_BOTS) {
        toLaunch.push(launchAll({ BotClass: AucBot, jobs: aucJobs, proxyPool, aucBotRegistry }));
    } else {
        log.info('[main] AucBot не запускается — ENABLE_AUC_BOTS=false в config.js (включи true для возврата)');
    }
    if (toLaunch.length > 0) {
        await Promise.all(toLaunch);
    }

    log.info('[main] Case-линии стартуют по расписанию');
})();
