(async function() {
    // --- CONFIGURATION ---
    const TOOL_ID = 'ASS';
    const VERSION = '1.0';
    const SIGNATURE = 'TheBrain 🧠';
    const REPO_URL = 'https://solitaryzbyn.github.io/hovna';
    const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1462228257544999077/5jKi12kYmYenlhSzPqSVQxjN_f9NW007ZFCW_2ElWnI6xiW80mJYGj0QeOOcZQLRROCu';

    const getEuroTime = (date = new Date()) => date.toLocaleTimeString('en-GB', { hour12: false });
    const sleep = ms => new Promise(res => setTimeout(res, ms));

    let failureCount = 0;
    let countdownInterval;

    // --- HUD UI ---
    const logId = 'thebrain-logger';
    if ($(`#${logId}`).length) $(`#${logId}`).remove();
    const $logger = $(`
        <div id="${logId}" style="position: fixed; left: 10px; top: 100px; width: 260px; background: rgba(15, 0, 0, 0.95); border: 2px solid #8B0000; border-radius: 5px; z-index: 99999; font-family: Calibri, sans-serif; box-shadow: 0 0 20px black; color: #DC143C;">
            <div style="background: #8B0000; color: white; padding: 6px; font-weight: bold; font-size: 14px; display: flex; justify-content: space-between; border-radius: 3px 3px 0 0;">
                <span>${SIGNATURE} Final v${VERSION}</span>
                <span id="logger-timer" style="color: #ffcc00;">00:00</span>
            </div>
            <div id="logger-status" style="padding: 10px; text-align: center; font-size: 18px; font-weight: bold; background: #1a0000; border-bottom: 1px solid #8B0000; color: #ffcc00;">READY</div>
            <div id="logger-content" style="padding: 8px; font-size: 11px; max-height: 140px; overflow-y: auto; line-height: 1.3;"></div>
        </div>
    `).appendTo('body');

    function updateLog(message, isImportant = false) {
        const style = isImportant ? 'font-weight: bold; color: #ffffff;' : '';
        $('#logger-content').prepend(`<div style="border-bottom: 1px solid #330000; padding: 2px 0; ${style}">[${getEuroTime()}] ${message}</div>`);
    }

    function startVisualTimer(ms) {
        clearInterval(countdownInterval);
        let remaining = Math.floor(ms / 1000);
        countdownInterval = setInterval(() => {
            if (remaining <= 0) {
                clearInterval(countdownInterval);
                return;
            }
            let m = Math.floor(remaining / 60);
            let s = remaining % 60;
            $('#logger-timer').text(`${m}:${s.toString().padStart(2, '0')}`);
            remaining--;
        }, 1000);
    }

    // --- STEALTH CLICK SIMULATION ---
    async function humanClick(element) {
        const events = ['mouseenter', 'mouseover', 'mousedown', 'mouseup', 'click'];
        for (let eventName of events) {
            const ev = new MouseEvent(eventName, { view: window, bubbles: true, cancelable: true, buttons: 1 });
            element.dispatchEvent(ev);
            await sleep(Math.floor(Math.random() * 150) + 50);
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
        for (let i = 0; i < 20; i++) { // Increased wait for ASS to 10s
            let currentPop = 0;
            $('.unitsInput').each(function() { currentPop += (parseInt($(this).val()) || 0); });
            if (currentPop >= 10) return true;
            await sleep(500);
        }
        return false;
    }

    async function runScavengingCycle() {
        if (failureCount >= 3) {
            updateLog("EMERGENCY SHUTDOWN - 3 FAILURES", true);
            $('#logger-status').text("SHUTDOWN").css('color', 'red');
            await $.post(DISCORD_WEBHOOK_URL, JSON.stringify({ content: `🛑 **[BOT STOPPED]** 3 failures on account. @everyone` }));
            return;
        }

        if ($('#bot_check, .h-captcha, #hcaptcha-container').filter(':visible').length > 0) {
            updateLog("CAPTCHA DETECTED!", true);
            $('#logger-status').text("CAPTCHA").css('color', 'red');
            return;
        }

        // --- HARD SYNC POINT ---
        const latestReturnMs = getLatestReturnTimeMs();
        if (latestReturnMs > 0) {
            const now = new Date();
            const hour = now.getHours();
            
            let extraBuffer;
            if (hour >= 1 && hour < 7) {
                extraBuffer = (Math.floor(Math.random() * (122 - 49 + 1)) + 49) * 60000;
                updateLog(`Night mode: adding ${Math.round(extraBuffer/60000)}m delay`);
            } else {
                extraBuffer = (Math.floor(Math.random() * 90) + 30) * 1000; // 30-120s human buffer
            }

            const totalSleep = latestReturnMs + extraBuffer;
            updateLog(`Waiting for all troops. Wake up: ${getEuroTime(new Date(Date.now() + totalSleep))}`, true);
            $('#logger-status').text("DEEP SLEEP").css('color', '#666');
            startVisualTimer(totalSleep);
            setTimeout(runScavengingCycle, totalSleep);
            return;
        }

        // --- EXECUTION ---
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
            $('#logger-status').text("SYNCING").css('color', '#ffcc00');
            TwCheese.use(TOOL_ID);
            
            updateLog("Waiting for ASS calculation...");
            await sleep(25000);

            if (!(await checkRefillReady())) {
                failureCount++;
                updateLog(`Troops not ready (${failureCount}/3). Retrying in 2m.`);
                setTimeout(runScavengingCycle, 120000);
                return;
            }

            const sendButtons = $('.btn-send, .free_send_button').filter(':visible').not('.btn-disabled').toArray().reverse();
            if (sendButtons.length === 0) {
                updateLog("No buttons available. Re-checking.");
                setTimeout(runScavengingCycle, 60000);
                return;
            }

            updateLog(`Sending ${sendButtons.length} missions...`);
            $('#logger-status').text("ACTIVE").css('color', '#00ff00');

            for (const btn of sendButtons) {
                await humanClick(btn);
                await sleep(1500 + Math.floor(Math.random() * 2000)); // Controlled 1.5 - 3.5s delay
            }

            failureCount = 0;
            updateLog("Cycle finished successfully.");
            await sleep(5000);
            runScavengingCycle(); 

        } catch (err) {
            failureCount++;
            updateLog(`Error: ${err.message}`);
            setTimeout(runScavengingCycle, 120000);
        }
    }

    runScavengingCycle();
})();
