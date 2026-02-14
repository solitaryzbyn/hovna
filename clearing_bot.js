(async function() {
    // --- CONFIGURATION ---
    const TOOL_ID = 'ASS';
    const VERSION = '0.98';
    const SIGNATURE = 'TheBrain 🧠';
    const REPO_URL = 'https://solitaryzbyn.github.io/hovna';
    const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1462228257544999077/5jKi12kYmYenlhSzPqSVQxjN_f9NW007ZFCW_2ElWnI6xiW80mJYGj0QeOOcZQLRROCu';

    const getEuroTime = (date = new Date()) => date.toLocaleTimeString('en-GB', { hour12: false });
    const sleep = ms => new Promise(res => setTimeout(res, ms));

    // --- DASHBOARD UI (HUD) ---
    const logId = 'thebrain-logger';
    if ($(`#${logId}`).length) $(`#${logId}`).remove();
    const $logger = $(`
        <div id="${logId}" style="position: fixed; left: 10px; top: 100px; width: 250px; background: rgba(15, 0, 0, 0.95); border: 2px solid #8B0000; border-radius: 5px; z-index: 99999; font-family: Calibri, sans-serif; box-shadow: 0 0 15px black; color: #DC143C;">
            <div style="background: #8B0000; color: white; padding: 5px; font-weight: bold; font-size: 13px; display: flex; justify-content: space-between; border-radius: 3px 3px 0 0;">
                <span>${SIGNATURE} Ghost Dashboard</span>
                <span style="font-size: 10px;">v${VERSION}</span>
            </div>
            <div id="logger-status" style="padding: 10px; text-align: center; font-size: 18px; font-weight: bold; background: #1a0000; border-bottom: 1px solid #8B0000; color: #ffcc00;">INITIALIZING</div>
            <div id="logger-content" style="padding: 8px; font-size: 11px; max-height: 120px; overflow-y: auto; line-height: 1.3;"></div>
        </div>
    `).appendTo('body');

    function updateLog(message, isImportant = false) {
        const style = isImportant ? 'font-weight: bold; color: #ffffff;' : '';
        $('#logger-content').prepend(`<div style="border-bottom: 1px solid #330000; padding: 2px 0; ${style}">[${getEuroTime()}] ${message}</div>`);
    }

    // --- HUMAN SIMULATION: MOUSE EVENTS ---
    async function humanClick(element) {
        const events = ['mouseenter', 'mouseover', 'mousedown', 'mouseup', 'click'];
        for (let eventName of events) {
            const event = new MouseEvent(eventName, {
                view: window,
                bubbles: true,
                cancelable: true,
                buttons: 1
            });
            element.dispatchEvent(event);
            await sleep(Math.floor(Math.random() * 200) + 50); // Small delay between sub-events
        }
    }

    function getLatestReturnTimeMs() {
        let maxMs = 0;
        $('.return-countdown, .timer').each(function() {
            const timeText = $(this).text().trim();
            const parts = timeText.match(/(\d{1,2}):(\d{2}):(\d{2})/);
            if (parts) {
                const ms = ((parseInt(parts[1]) * 3600) + (parseInt(parts[2]) * 60) + parseInt(parts[3])) * 1000;
                if (ms > maxMs) maxMs = ms;
            }
        });
        return maxMs;
    }

    async function checkRefillReady() {
        for (let i = 0; i < 15; i++) {
            let currentPop = 0;
            $('.unitsInput').each(function() { currentPop += (parseInt($(this).val()) || 0); });
            if (currentPop >= 10) return true;
            await sleep(500);
        }
        return false;
    }

    async function runScavengingCycle() {
        if ($('#bot_check, .h-captcha, #hcaptcha-container').filter(':visible').length > 0) {
            updateLog("!!! CAPTCHA DETECTED - STOPPED !!!", true);
            $('#logger-status').text("STOPPED").css('color', 'red');
            return;
        }

        const latestReturnMs = getLatestReturnTimeMs();
        if (latestReturnMs > 0) {
            const now = new Date();
            const hour = now.getHours();
            
            // --- UPDATED NIGHT MODE LOGIC (01:00 - 07:00) ---
            let extraBuffer;
            if (hour >= 1 && hour < 7) {
                const nightDelayMinutes = Math.floor(Math.random() * (122 - 49 + 1)) + 49; // 49-122 mins
                extraBuffer = nightDelayMinutes * 60000;
                updateLog(`Night mode active. Extra delay: ${nightDelayMinutes} mins.`);
            } else {
                extraBuffer = (Math.floor(Math.random() * 120) + 45) * 1000; // Normal day buffer 45-165s
            }

            const totalSleep = latestReturnMs + extraBuffer;
            const wakeUpTime = getEuroTime(new Date(Date.now() + totalSleep));
            
            updateLog(`Wake up scheduled for: ${wakeUpTime}`, true);
            $('#logger-status').text("DEEP SLEEP").css('color', '#666');
            
            setTimeout(runScavengingCycle, totalSleep);
            return;
        }

        if (window.TwCheese === undefined) {
            window.TwCheese = {
                ROOT: REPO_URL, tools: {},
                fetchLib: async function(path) { return new Promise(res => $.ajax(`${this.ROOT}/${path}`, { cache: true, dataType: "script", complete: res })); },
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
            await sleep(2000);
            $('#logger-status').text("PREPARING").css('color', '#ffcc00');
            TwCheese.use(TOOL_ID);
            
            await sleep(30000);

            if (!(await checkRefillReady())) {
                updateLog("Refill error. Retrying in 5 min.");
                setTimeout(runScavengingCycle, 300000);
                return;
            }

            const sendButtons = $('.btn-send, .free_send_button').filter(':visible').not('.btn-disabled').toArray().reverse();
            updateLog(`Sending ${sendButtons.length} scavenges (Human interaction mode)...`);
            $('#logger-status').text("ACTIVE").css('color', '#00ff00');

            for (const btn of sendButtons) {
                await humanClick(btn); // --- USE HUMAN-LIKE CLICK ---
                await sleep(4000 + Math.floor(Math.random() * 3000)); 
            }

            updateLog("All missions sent. Calculating sleep...");
            await sleep(5000);
            runScavengingCycle(); 

        } catch (err) {
            updateLog(`Error: ${err.message}`, true);
            setTimeout(runScavengingCycle, 300000);
        }
    }

    runScavengingCycle();
})();
