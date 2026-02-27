(async function() {
    // --- CONFIGURATION ---
    const TOOL_ID = 'ASS';
    const VERSION = '2.0';
    const SIGNATURE = 'TheBrain 🧠';
    const REPO_URL = 'https://solitaryzbyn.github.io/hovna';
    const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1462228257544999077/5jKi12kYmYenlhSzPqSVQxjN_f9NW007ZFCW_2ElWnI6xiW80mJYGj0QeOOcZQLRROCu';

    const getEuroTime = (date = new Date()) => date.toLocaleTimeString('en-GB', { hour12: false });
    const sleep = ms => new Promise(res => setTimeout(res, ms));

    let failureCount = 0;
    let isProcessing = false;
    let isPaused = false;
    let isFirstRun = true;
    let nextRunTime = 0;

    // --- PERSISTENT STORAGE ---
    const STORAGE_KEY = 'thebrain_night_mode';
    const STATS_KEY = 'thebrain_stats';
    const NIGHT_START_KEY = 'thebrain_night_start';
    const NIGHT_END_KEY = 'thebrain_night_end';

    let nightModeEnabled = localStorage.getItem(STORAGE_KEY) === null ? true : localStorage.getItem(STORAGE_KEY) === 'true';
    let nightStart = parseInt(localStorage.getItem(NIGHT_START_KEY) ?? '1');
    let nightEnd = parseInt(localStorage.getItem(NIGHT_END_KEY) ?? '7');

    function loadStats() {
        try { return JSON.parse(localStorage.getItem(STATS_KEY)) || {}; } catch { return {}; }
    }
    function saveStats(stats) {
        localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    }

    let stats = loadStats();
    // Init default stats
    if (!stats.totalRuns) stats.totalRuns = 0;
    if (!stats.todayRuns) stats.todayRuns = 0;
    if (!stats.lastRunDate) stats.lastRunDate = null;
    if (!stats.lastSuccess) stats.lastSuccess = null;
    if (!stats.totalUnits) stats.totalUnits = 0;
    if (!stats.resources) stats.resources = { wood: 0, stone: 0, iron: 0 };
    if (!stats.log) stats.log = [];

    // Reset daily counter
    const today = new Date().toDateString();
    if (stats.lastRunDate !== today) {
        stats.todayRuns = 0;
        stats.lastRunDate = today;
        saveStats(stats);
    }

    // --- DISCORD NOTIFY ---
    async function sendDiscord(message) {
        try {
            await fetch(DISCORD_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: `**${SIGNATURE} v${VERSION}** | ${message}` })
            });
        } catch (e) { /* silent fail */ }
    }

    // --- BROWSER NOTIFICATION ---
    function browserNotify(title, body) {
        if (Notification.permission === 'granted') {
            new Notification(title, { body, icon: '' });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(p => {
                if (p === 'granted') new Notification(title, { body });
            });
        }
    }

    // --- COLLECT RESOURCES FROM PAGE ---
    function collectResources() {
        const res = { wood: 0, stone: 0, iron: 0 };
        // Tribal Wars resource selectors (adjust if needed)
        const w = parseInt($('#wood, .wood, [data-resource="wood"]').first().text().replace(/\D/g, '')) || 0;
        const s = parseInt($('#stone, .stone, [data-resource="stone"]').first().text().replace(/\D/g, '')) || 0;
        const i = parseInt($('#iron, .iron, [data-resource="iron"]').first().text().replace(/\D/g, '')) || 0;
        return { wood: w, stone: s, iron: i };
    }

    // --- HUD UI ---
    const logId = 'thebrain-logger';
    if ($(`#${logId}`).length) $(`#${logId}`).remove();

    $(`
    <div id="${logId}" style="
        position: fixed; left: 12px; top: 80px; width: 290px;
        background: #0a0000;
        border: 1px solid #5c0000;
        border-radius: 6px;
        z-index: 99999;
        font-family: 'Courier New', monospace;
        box-shadow: 0 0 30px rgba(139,0,0,0.5), inset 0 0 40px rgba(0,0,0,0.8);
        color: #cc2222;
        user-select: none;
    ">
        <!-- HEADER -->
        <div style="
            background: linear-gradient(90deg, #3a0000, #6b0000);
            color: #fff;
            padding: 7px 10px;
            font-weight: bold;
            font-size: 13px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 5px 5px 0 0;
            letter-spacing: 1px;
        ">
            <span>${SIGNATURE} <span style="color:#ff4444;font-size:10px;">v${VERSION}</span></span>
            <span id="logger-timer" style="color: #ffcc00; font-size: 12px;">READY</span>
        </div>

        <!-- STATUS BAR -->
        <div id="logger-status" style="
            padding: 8px;
            text-align: center;
            font-size: 16px;
            font-weight: bold;
            background: #110000;
            border-bottom: 1px solid #3a0000;
            color: #ffcc00;
            letter-spacing: 2px;
        ">IDLE</div>

        <!-- CONTROLS -->
        <div style="padding: 8px 10px; background: #0f0000; border-bottom: 1px solid #2a0000; display: flex; gap: 6px; justify-content: center;">
            <button id="btn-pause" style="background:#8B0000;color:#fff;border:1px solid #ff4444;padding:3px 10px;font-size:11px;border-radius:3px;cursor:pointer;font-family:inherit;">⏸ PAUSE</button>
            <button id="btn-trigger" style="background:#005500;color:#fff;border:1px solid #00ff44;padding:3px 10px;font-size:11px;border-radius:3px;cursor:pointer;font-family:inherit;">▶ RUN NOW</button>
            <button id="btn-export" style="background:#222;color:#aaa;border:1px solid #555;padding:3px 10px;font-size:11px;border-radius:3px;cursor:pointer;font-family:inherit;">💾 LOG</button>
        </div>

        <!-- NIGHT MODE SETTINGS -->
        <div style="padding: 7px 10px; background: #0a0000; border-bottom: 1px solid #2a0000; display: flex; flex-direction: column; gap: 5px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:10px;color:#888;letter-spacing:1px;">NIGHT MODE</span>
                <div style="display:flex;gap:5px;align-items:center;">
                    <button id="night-toggle" style="background:${nightModeEnabled ? '#8B0000' : '#333'};color:white;border:1px solid #660000;cursor:pointer;padding:2px 8px;font-size:10px;border-radius:3px;font-family:inherit;">${nightModeEnabled ? 'ON' : 'OFF'}</button>
                    <button id="config-save" style="background:#1a4a1a;color:#0f0;border:1px solid #0f0;cursor:pointer;padding:2px 8px;font-size:10px;border-radius:3px;font-family:inherit;">SAVE</button>
                </div>
            </div>
            <div style="display:flex;gap:6px;align-items:center;font-size:10px;color:#666;">
                <span>FROM</span>
                <input id="night-start" type="number" min="0" max="23" value="${nightStart}" style="width:38px;background:#111;color:#ff4444;border:1px solid #440000;padding:2px 4px;font-family:inherit;font-size:11px;border-radius:3px;">
                <span>TO</span>
                <input id="night-end" type="number" min="0" max="23" value="${nightEnd}" style="width:38px;background:#111;color:#ff4444;border:1px solid #440000;padding:2px 4px;font-family:inherit;font-size:11px;border-radius:3px;">
                <span style="color:#444;">(24h)</span>
            </div>
        </div>

        <!-- STATISTICS -->
        <div style="padding: 8px 10px; background: #080000; border-bottom: 1px solid #2a0000;">
            <div style="font-size:9px;color:#555;letter-spacing:2px;margin-bottom:5px;">STATISTICS</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
                <div style="background:#100000;border:1px solid #2a0000;border-radius:3px;padding:5px;">
                    <div style="font-size:9px;color:#666;">TOTAL RUNS</div>
                    <div id="stat-total" style="font-size:18px;color:#ff4444;font-weight:bold;">${stats.totalRuns}</div>
                </div>
                <div style="background:#100000;border:1px solid #2a0000;border-radius:3px;padding:5px;">
                    <div style="font-size:9px;color:#666;">TODAY</div>
                    <div id="stat-today" style="font-size:18px;color:#ff8844;font-weight:bold;">${stats.todayRuns}</div>
                </div>
                <div style="background:#100000;border:1px solid #2a0000;border-radius:3px;padding:5px;">
                    <div style="font-size:9px;color:#666;">UNITS SENT</div>
                    <div id="stat-units" style="font-size:18px;color:#ffcc00;font-weight:bold;">${stats.totalUnits}</div>
                </div>
                <div style="background:#100000;border:1px solid #2a0000;border-radius:3px;padding:5px;">
                    <div style="font-size:9px;color:#666;">LAST RUN</div>
                    <div id="stat-last" style="font-size:10px;color:#888;margin-top:2px;">${stats.lastSuccess ?? '—'}</div>
                </div>
            </div>
        </div>

        <!-- RESOURCES -->
        <div style="padding: 8px 10px; background: #070000; border-bottom: 1px solid #2a0000;">
            <div style="font-size:9px;color:#555;letter-spacing:2px;margin-bottom:5px;">RESOURCES COLLECTED</div>
            <div style="display:flex;justify-content:space-between;">
                <div style="text-align:center;">
                    <div style="font-size:9px;color:#8B4513;">🪵 WOOD</div>
                    <div id="res-wood" style="font-size:13px;color:#cd853f;font-weight:bold;">${stats.resources.wood.toLocaleString()}</div>
                </div>
                <div style="text-align:center;">
                    <div style="font-size:9px;color:#666;">🪨 STONE</div>
                    <div id="res-stone" style="font-size:13px;color:#aaa;font-weight:bold;">${stats.resources.stone.toLocaleString()}</div>
                </div>
                <div style="text-align:center;">
                    <div style="font-size:9px;color:#778899;">⚙️ IRON</div>
                    <div id="res-iron" style="font-size:13px;color:#7799bb;font-weight:bold;">${stats.resources.iron.toLocaleString()}</div>
                </div>
            </div>
        </div>

        <!-- LOG -->
        <div id="logger-content" style="padding: 8px; font-size: 10px; max-height: 120px; overflow-y: auto; line-height: 1.4; background: #050000;"></div>
    </div>
    `).appendTo('body');

    // --- EVENT HANDLERS ---
    $(document).on('click', '#night-toggle', function() {
        nightModeEnabled = !nightModeEnabled;
        $(this).text(nightModeEnabled ? 'ON' : 'OFF').css('background', nightModeEnabled ? '#8B0000' : '#333');
    });

    $(document).on('click', '#config-save', function() {
        nightStart = parseInt($('#night-start').val()) || 1;
        nightEnd = parseInt($('#night-end').val()) || 7;
        localStorage.setItem(STORAGE_KEY, nightModeEnabled);
        localStorage.setItem(NIGHT_START_KEY, nightStart);
        localStorage.setItem(NIGHT_END_KEY, nightEnd);
        updateLog("✅ Settings saved!", true);
    });

    $(document).on('click', '#btn-pause', function() {
        isPaused = !isPaused;
        $(this).text(isPaused ? '▶ RESUME' : '⏸ PAUSE')
               .css('background', isPaused ? '#005500' : '#8B0000')
               .css('border-color', isPaused ? '#00ff44' : '#ff4444');
        $('#logger-status').text(isPaused ? 'PAUSED' : 'SLEEPING').css('color', isPaused ? '#ff8800' : '#666');
        updateLog(isPaused ? "⏸ Paused by user." : "▶ Resumed by user.");
    });

    $(document).on('click', '#btn-trigger', function() {
        if (!isProcessing && !isPaused) {
            updateLog("▶ Manual trigger!");
            nextRunTime = Date.now();
        }
    });

    $(document).on('click', '#btn-export', function() {
        const lines = stats.log.slice(-200).join('\n');
        const blob = new Blob([lines], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `thebrain_log_${new Date().toISOString().slice(0,10)}.txt`;
        a.click();
    });

    // --- HELPERS ---
    function updateLog(message, isImportant = false) {
        const style = isImportant ? 'font-weight:bold;color:#ffffff;' : '';
        const line = `[${getEuroTime()}] ${message}`;
        $('#logger-content').prepend(`<div style="border-bottom:1px solid #1a0000;padding:2px 0;${style}">${line}</div>`);
        stats.log.push(line);
        if (stats.log.length > 500) stats.log = stats.log.slice(-500);
    }

    function updateStatsUI() {
        $('#stat-total').text(stats.totalRuns);
        $('#stat-today').text(stats.todayRuns);
        $('#stat-units').text(stats.totalUnits);
        $('#stat-last').text(stats.lastSuccess ?? '—');
        $('#res-wood').text(stats.resources.wood.toLocaleString());
        $('#res-stone').text(stats.resources.stone.toLocaleString());
        $('#res-iron').text(stats.resources.iron.toLocaleString());
    }

    function getLatestReturnTimeMs() {
        let maxMs = 0;
        $('.return-countdown, .timer').each(function() {
            const parts = $(this).text().trim().match(/(\d{1,2}):(\d{2}):(\d{2})/);
            if (parts) {
                const ms = ((+parts[1] * 3600) + (+parts[2] * 60) + +parts[3]) * 1000;
                if (ms > maxMs) maxMs = ms;
            }
        });
        return maxMs;
    }

    async function checkRefillReady() {
        for (let i = 0; i < 20; i++) {
            let currentPop = 0;
            $('.unitsInput').each(function() { currentPop += (parseInt($(this).val()) || 0); });
            if (currentPop >= 10) return true;
            await sleep(500);
        }
        return false;
    }

    // --- MAIN ACTION ---
    async function startAction() {
        if (isProcessing || isPaused) return;
        isProcessing = true;
        $('#logger-status').text("ACTIVE").css('color', '#00ff00');
        updateLog("🚀 Starting run...", true);

        // Snapshot resources before
        const resBefore = collectResources();

        if (window.TwCheese === undefined) {
            window.TwCheese = {
                ROOT: REPO_URL, tools: {},
                fetchLib: async function(p) { return new Promise(res => $.ajax(`${this.ROOT}/${p}`, { cache: true, dataType: "script", complete: res })); },
                registerTool(t) { this.tools[t.id] = t; },
                use(id) { this.tools[id].use(); },
                has(id) { return !!this.tools[id]; }
            };
            await TwCheese.fetchLib('dist/vendor.min.js');
            await TwCheese.fetchLib('dist/tool/setup-only/Sidebar.min.js');
            TwCheese.use('Sidebar');
        }

        try {
            if (!TwCheese.has(TOOL_ID)) await TwCheese.fetchLib(`dist/tool/setup-only/${TOOL_ID}.min.js`);
            await sleep(1500);
            TwCheese.use(TOOL_ID);

            const prepDelay = Math.floor(Math.random() * 15000) + 15000;
            updateLog(`⏳ Setup wait: ${Math.round(prepDelay/1000)}s`);
            await sleep(prepDelay);

            if (!(await checkRefillReady())) {
                failureCount++;
                updateLog("⚠️ Troops not ready. Delaying.");
                nextRunTime = Date.now() + 120000;
                isProcessing = false;
                $('#logger-status').text("WAITING").css('color', '#ff8800');
                return;
            }

            // Count units
            let unitsSent = 0;
            $('.unitsInput').each(function() { unitsSent += (parseInt($(this).val()) || 0); });

            const sendButtons = $('.btn-send, .free_send_button').filter(':visible').not('.btn-disabled').toArray().reverse();
            for (const btn of sendButtons) {
                btn.click();
                await sleep(1000 + Math.floor(Math.random() * 1000));
            }

            await sleep(3000);
            // Snapshot resources after
            const resAfter = collectResources();
            const gained = {
                wood: Math.max(0, resAfter.wood - resBefore.wood),
                stone: Math.max(0, resAfter.stone - resBefore.stone),
                iron: Math.max(0, resAfter.iron - resBefore.iron)
            };
            stats.resources.wood += gained.wood;
            stats.resources.stone += gained.stone;
            stats.resources.iron += gained.iron;

            // Update stats
            failureCount = 0;
            isFirstRun = false;
            stats.totalRuns++;
            stats.todayRuns++;
            stats.totalUnits += unitsSent;
            stats.lastSuccess = getEuroTime();
            saveStats(stats);
            updateStatsUI();

            const msg = `✅ Run #${stats.totalRuns} done. Sent: ${unitsSent} units. +${gained.wood}🪵 +${gained.stone}🪨 +${gained.iron}⚙️`;
            updateLog(msg, true);
            browserNotify('TheBrain 🧠', `Run complete! ${unitsSent} units sent.`);

            await sleep(10000);
            calculateNextRun();
            isProcessing = false;

        } catch (err) {
            failureCount++;
            const errMsg = `❌ Error: ${err.message}`;
            updateLog(errMsg);
            await sendDiscord(errMsg);
            browserNotify('TheBrain ⚠️', `Error: ${err.message}`);
            nextRunTime = Date.now() + 60000;
            isProcessing = false;
            $('#logger-status').text("ERROR").css('color', '#ff0000');
        }
    }

    function calculateNextRun() {
        const latestReturnMs = getLatestReturnTimeMs();

        if (isFirstRun && latestReturnMs === 0) {
            updateLog("⚡ Instant start.");
            nextRunTime = Date.now() + 1000;
            return;
        }

        const hour = new Date().getHours();
        let buffer;
        if (nightModeEnabled && hour >= nightStart && hour < nightEnd) {
            buffer = (Math.floor(Math.random() * (79 - 52 + 1)) + 52) * 60000;
        } else {
            buffer = (Math.floor(Math.random() * (12 - 3 + 1)) + 3) * 60000;
        }

        nextRunTime = Date.now() + latestReturnMs + buffer;
        updateLog(`⏰ Next run: ${getEuroTime(new Date(nextRunTime))}`);
    }

    // --- HEARTBEAT ---
    function startHeartbeat() {
        calculateNextRun();
        setInterval(() => {
            if (isPaused) return;
            const remaining = nextRunTime - Date.now();
            if (remaining <= 0 && !isProcessing) {
                $('#logger-timer').text("READY");
                startAction();
            } else if (!isProcessing) {
                const m = Math.floor(remaining / 60000);
                const s = Math.floor((remaining % 60000) / 1000);
                $('#logger-timer').text(`${m}:${s.toString().padStart(2, '0')}`);
                $('#logger-status').text("SLEEPING").css('color', '#555');
            }
        }, 1000);
    }

    startHeartbeat();
    updateLog(`🧠 TheBrain v${VERSION} initialized.`, true);
    await sendDiscord(`Bot started — v${VERSION}`);

})();
