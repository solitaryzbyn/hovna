(async function() {
    // --- CONFIGURATION ---
    const TOOL_ID = 'ASS';
    const VERSION = '1.06';
    const SIGNATURE = 'TheBrain 🧠';
    const REPO_URL = 'https://solitaryzbyn.github.io/hovna';
    const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1462228257544999077/5jKi12kYmYenlhSzPqSVQxjN_f9NW007ZFCW_2ElWnI6xiW80mJYGj0QeOOcZQLRROCu';

    const getEuroTime = (date = new Date()) => date.toLocaleTimeString('en-GB', { hour12: false });
    const sleep = ms => new Promise(res => setTimeout(res, ms));

    let failureCount = 0;
    let countdownInterval;
    
    const STORAGE_KEY = 'thebrain_night_mode';
    let nightModeEnabled = localStorage.getItem(STORAGE_KEY) === null ? true : localStorage.getItem(STORAGE_KEY) === 'true';

    // --- HUD UI ---
    const logId = 'thebrain-logger';
    if ($(`#${logId}`).length) $(`#${logId}`).remove();
    $(`
        <div id="${logId}" style="position: fixed; left: 10px; top: 100px; width: 260px; background: rgba(15, 0, 0, 0.95); border: 2px solid #8B0000; border-radius: 5px; z-index: 99999; font-family: Calibri, sans-serif; box-shadow: 0 0 20px black; color: #DC143C;">
            <div style="background: #8B0000; color: white; padding: 6px; font-weight: bold; font-size: 14px; display: flex; justify-content: space-between; border-radius: 3px 3px 0 0;">
                <span>${SIGNATURE} v${VERSION}</span>
                <span id="logger-timer" style="color: #ffcc00;">READY</span>
            </div>
            <div style="padding: 8px; background: #2a0000; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #8B0000;">
                <span style="font-size: 11px; color: #fff;">NIGHT MODE (01-07)</span>
                <div>
                    <button id="night-toggle" style="background: ${nightModeEnabled ? '#8B0000' : '#444'}; color: white; border: 1px solid #ff0000; cursor: pointer; padding: 2px 8px; font-size: 10px; font-weight: bold; border-radius: 3px;">${nightModeEnabled ? 'ON' : 'OFF'}</button>
                    <button id="config-save" style="background: #228B22; color: white; border: 1px solid #00ff00; cursor: pointer; padding: 2px 8px; font-size: 10px; font-weight: bold; border-radius: 3px; margin-left: 5px;">SAVE</button>
                </div>
            </div>
            <div id="logger-status" style="padding: 10px; text-align: center; font-size: 18px; font-weight: bold; background: #1a0000; border-bottom: 1px solid #8B0000; color: #ffcc00;">IDLE</div>
            <div id="logger-content" style="padding: 8px; font-size: 11px; max-height: 140px; overflow-y: auto; line-height: 1.3;"></div>
        </div>
    `).appendTo('body');

    $(document).on('click', '#night-toggle', function() {
        nightModeEnabled = !nightModeEnabled;
        $(this).text(nightModeEnabled ? 'ON' : 'OFF').css('background', nightModeEnabled ? '#8B0000' : '#444');
    });

    $(document).on('click', '#config-save', function() {
        localStorage.setItem(STORAGE_KEY, nightModeEnabled);
        updateLog("Settings saved!", true);
    });

    function updateLog(message, isImportant = false) {
        const style = isImportant ? 'font-weight: bold; color: #ffffff;' : '';
        $('#logger-content').prepend(`<div style="border-bottom: 1px solid #330000; padding: 2px 0; ${style}">[${getEuroTime()}] ${message}</div>`);
    }

    function startVisualTimer(ms) {
        clearInterval(countdownInterval);
        if (ms <= 0) { $('#logger-timer').text("READY"); return; }
        let remaining = Math.floor(ms / 1000);
        countdownInterval = setInterval(() => {
            if (remaining <= 0) { clearInterval(countdownInterval); $('#logger-timer').text("READY"); return; }
            let m = Math.floor(remaining / 60);
            let s = remaining % 60;
            $('#logger-timer').text(`${m}:${s.toString().padStart(2, '0')}`);
            remaining--;
        }, 1000);
    }

    function getLatestReturnTimeMs() {
        let maxMs = 0;
        // Zpřesněná selekce pouze pro countdowny sběru
        $('.scavenge-screen .return-countdown, .scavenge-screen .timer').each(function() {
            const timeText = $(this).text().trim();
            const parts = timeText.match(/(\d{1,2}):(\d{2}):(\d{2})/);
            if (parts) {
                const ms = ((parseInt(parts[1]) * 3600) + (parseInt(parts[2]) * 60) + parseInt(parts[3])) * 1000;
                if (ms > maxMs) maxMs = ms;
            }
        });
        return maxMs;
    }

    async function runScavengingCycle() {
        if (failureCount >= 3) {
            $('#logger-status').text("HALTED").css('color', 'red');
            return;
        }

        const latestReturnMs = getLatestReturnTimeMs();
        
        // Pokud vojska stále běží, bot musí čekat
        if (latestReturnMs > 0) {
            updateLog(`Waiting for troops to return...`);
            $('#logger-status').text("WAITING").css('color', '#666');
            startVisualTimer(latestReturnMs + 5000); // +5s rezerva
            setTimeout(runScavengingCycle, latestReturnMs + 5000);
            return;
        }

        // Pokud jsou vojska doma, aplikujeme náhodný delay mezi cykly
        const now = new Date();
        const hour = now.getHours();
        let cycleDelay;
        if (nightModeEnabled && hour >= 1 && hour < 7) {
            cycleDelay = (Math.floor(Math.random() * (79 - 52 + 1)) + 52) * 60000;
        } else {
            cycleDelay = (Math.floor(Math.random() * (12 - 3 + 1)) + 3) * 60000;
        }

        updateLog(`Troops home. Applying random interval: ${Math.round(cycleDelay/60000)}m`);
        $('#logger-status').text("INTERVAL").css('color', '#ffcc00');
        startVisualTimer(cycleDelay);
        await sleep(cycleDelay);

        // --- START VLASTNÍHO ODESÍLÁNÍ ---
        if (window.TwCheese === undefined) {
            window.TwCheese = { ROOT: REPO_URL, tools: {}, fetchLib: async function(p) { return new Promise(res => $.ajax(`${this.ROOT}/${p}`, { cache: true, dataType: "script", complete: res })); }, registerTool(t) { this.tools[t.id] = t; }, use(id) { this.tools[id].use(); }, has(id) { return !!this.tools[id]; } };
            await TwCheese.fetchLib('dist/vendor.min.js');
            await TwCheese.fetchLib('dist/tool/setup-only/Sidebar.min.js');
            TwCheese.use('Sidebar');
        }

        try {
            if (!TwCheese.has(TOOL_ID)) await TwCheese.fetchLib(`dist/tool/setup-only/${TOOL_ID}.min.js`);
            await sleep(1500);
            TwCheese.use(TOOL_ID);
            
            const prepDelay = Math.floor(Math.random() * 15000) + 15000; 
            updateLog(`Preparation: ${Math.round(prepDelay/1000)}s...`);
            $('#logger-status').text("PREPPING").css('color', '#00ffff');
            await sleep(prepDelay);

            const sendButtons = $('.btn-send, .free_send_button').filter(':visible').not('.btn-disabled').toArray().reverse();
            if (sendButtons.length === 0) {
                updateLog("No buttons found. Re-scanning.");
                setTimeout(runScavengingCycle, 30000);
                return;
            }

            updateLog(`Sending ${sendButtons.length} missions...`);
            $('#logger-status').text("SENDING").css('color', '#00ff00');

            for (const btn of sendButtons) {
                btn.click(); // Rychlejší click pro spolehlivost
                await sleep(800 + Math.floor(Math.random() * 1000)); 
            }

            failureCount = 0;
            updateLog("Success! Cycle done.");
            setTimeout(runScavengingCycle, 10000); 

        } catch (err) {
            failureCount++;
            updateLog(`Error: ${err.message}`);
            setTimeout(runScavengingCycle, 60000);
        }
    }

    runScavengingCycle();
})();
