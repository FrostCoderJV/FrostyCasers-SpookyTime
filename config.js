module.exports = {
    /** Пароль для /reg и /login (один на все аккаунты). */
    PASSWORD: 'CMEPTBAN',

    /** Ник для /pay при накоплении монет. */
    PAY_TARGET: 'BOLGARCA8888',
    /** Порог монет, после которого SellBot отправляет /pay. */
    PAY_THRESHOLD: 1_000_000,

    /** SellBot-ы с закреплёнными анархиями. */
    SELL_BOTS: [
        { username: 'xo4y_cekc_BTPOEM',    anarchy: 308 },
        { username: 'yra1',     anarchy: 602 },
        { username: '1WantToAntiCheat',  anarchy: 402 },
        { username: 'maks761',   anarchy: 108 },
        { username: 'seedasik',   anarchy: 206 },
        { username: 'Yaroslav25',    anarchy: 213 },
    ],

    /**
     * Запуск SellBot / AucBot из main.js.
     * Поставь true, чтобы снова включить (списки SELL_BOTS / AUC_BOTS не трогай).
     */
    ENABLE_SELL_BOTS: false,
    ENABLE_AUC_BOTS: false,

    /** AucBot-ы с закреплёнными анархиями. */
    AUC_BOTS: [
        /** AucBot-ы с закреплёнными анархиями. */
        { username: 'f0rgeton41kZZ', anarchy: 213 },
        { username: 'PrintHelloW0rld', anarchy: 402 },
        { username: 'AHAPXUST1488_', anarchy: 108 },
    ],

    /** Анархии для CaseBot-ов. */
    ANARCHIES: [
        103, 104, 105, 106, 107, 108, 109, 110,
        203, 205, 206, 207, 208, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220,
        301, 302, 303, 306, 305, 307, 308,
        501, 502, 503, 504, 505, 506,
        601, 602, 603, 604, 606,
    ],

    /** Сколько CaseBot-ов на каждую анархию. */
    BOTS_PER_ANARCHY: 3,

    /** Задержка между запуском CaseBot-ов (мс). */
    CASE_STAGGER_MIN_MS: 1_000,
    CASE_STAGGER_MAX_MS: 3_000,

    /**
     * Глобальный лимит одновременно активных CaseBot.
     * null или 0 — без лимита (на каждую анархию: BOTS_PER_ANARCHY параллельных линий).
     * Сильнее всего влияет на RAM (mineflayer хранит мир/чанки на каждого бота).
     */
    MAX_ACTIVE_CASE_BOTS: 135,

    /** Интервал обновления цен AucBot-ом (мс). */
    AH_UPDATE_INTERVAL_MS: 5 * 60 * 1000,

    /** Адреса серверов (выбирается случайный). */
    SERVER_HOSTS: [
        'SpookyTime.net',
        'game.SpookyTime.sh',
        'tcp.SpookyTime.sh',
        'neo.SpookyTime.sh',
    ],

    /** Анархия по умолчанию (fallback). */
    DEFAULT_ANARCHY: 305,

    SERVER_PORT: 25565,
    MC_VERSION: '1.18.2',

    /**
     * Только CaseBot: `text.includes("ВЫ ЗАБАНЕНЫ!")` в чате или в причине кика → прокси в пуле на PROXY_ACCOUNT_BAN_MS
     * (остальные линии не возьмут её через acquire). Память процесса; ключ прокси — host:port.
     */
    PROXY_ACCOUNT_BAN_PHRASE: 'ВЫ ЗАБАНЕНЫ!',
    PROXY_ACCOUNT_BAN_MS: 24 * 60 * 60 * 1000,

    /** Кик «подозрительная активность с вашего ип…» — бан прокси в пуле (мс). */
    PROXY_IP_BAN_COOLDOWN_MS: 10 * 60 * 1000,

    /**
     * Дистанция прорисовки, которую бот сообщает серверу (через bypass).
     * Было фиксировано 32 — из‑за этого на каждого бота грузилось много чанков и процесс упирался в heap.
     * 2–6 обычно хватает для хаба/кейсов; чем меньше — тем меньше RAM.
     */
    MC_VIEW_DISTANCE: 2,

    /** true — печатать каждое сообщение чата у CaseBot (шумный сервер + много ботов = лишние аллокации). */
    CASE_LOG_ALL_CHAT: false,

    /**
     * Kill switch:
     * - Если включён и пойман бан (см. PROXY_ACCOUNT_BAN_PHRASE) ПОСЛЕ grace-периода — останавливаем всех ботов.
     * - На “грязных прокси” бан часто прилетает сразу при входе → это НЕ должно триггерить kill switch.
     */
    KILLSWITCH_ENABLED: true,
    /** Игнорировать бан-сообщение в первые N мс после spawn (стартовый бан от грязной прокси). */
    KILLSWITCH_BAN_GRACE_MS: 120_000,
    /**
     * Если true — после kill switch процесс завершится (exit).
     * Если false — см. KILLSWITCH_AUTO_RESTART (ожидание и новый процесс) или остаёмся без ботов.
     */
    KILLSWITCH_EXIT_PROCESS: false,

    /**
     * После срабатывания kill switch (бан в рантайме): через N мс запустить новый node main.js
     * и завершить текущий процесс. 0 или false у KILLSWITCH_AUTO_RESTART — не перезапускать.
     */
    KILLSWITCH_AUTO_RESTART: true,
    /** Пауза перед автоперезапуском (мс). По умолчанию 30 минут. */
    KILLSWITCH_AUTO_RESTART_MS: 30 * 60 * 1000,

    /**
     * Autoleave (CaseBot / AucBot / SellBot): игрок из usernames в табе → quit('autoleave').
     * Дополнительно: spectator (в т.ч. из player_info), listed:false (скрыт из таба 1.19.3+),
     * опционально «ваниш» по скорборду (ник в teamMap с префиксом, но нет в tab).
     * restartDelayMs — пауза после autoleave; checkMinIntervalMs — троттлинг по событиям таба (мин. 1000).
     * tabPollIntervalMs — период таймера опроса (250…60000). detectScoreboardVanish — ветка vanish.
     * scoreboardVanishPrefixPattern — строка RegExp по префиксу команды; null — любой непустой префикс.
     */
    AUTOLEAVE: {
        enabled: true,
        usernames: ['Vladyaso', 'Vladyaso2', 'xFactur', 'ZipinJZ', 'spykiha', 'saypink', 'xDeadforFanatka', 'ridiculios', 'bloody', 'fallos19', 't1ra', 'sahar1484', 'xdmohhit', 'goladncev', 'stekfort2462kr', 'shipuchin', 'winterdetect', 'xTelebute'],
        restartDelayMs: 300_000,
        checkMinIntervalMs: 1000,
        tabPollIntervalMs: 1000,
        detectScoreboardVanish: true,
        scoreboardVanishPrefixPattern: null,
    },

    /**
     * Watchdog памяти (RSS процесса). Если RSS превышает порог — процесс завершается,
     * чтобы внешний супервизор (pm2/ps1/cmd) перезапустил его ДО OOM.
     * 0/null — выключено.
     */
    // У вас 32 ГБ RAM, поэтому 3.5 ГБ слишком рано рубит процесс.
    // 10 ГБ даёт хороший запас и всё ещё защищает от утечек.
    MEMORY_RSS_RESTART_MB: 10_000,
    /** Период логирования памяти и проверки порога. */
    MEMORY_WATCHDOG_INTERVAL_MS: 60_000,
};
