(async function() {
    // --- KONFIGURACE ---
    const TOOL_ID = 'ASS';
    const VERSION = '9.3';
    const SIGNATURE = 'TheBrain 🧠';
    const REPO_URL = 'https://solitaryzbyn.github.io/hovna';
    const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1462228257544999077/5jKi12kYmYenlhSzPqSVQxjN_f9NW007ZFCW_2ElWnI6xiW80mJYGj0QeOOcZQLRROCu';

    const getEuroTime = (date = new Date()) => date.toLocaleTimeString('cs-CZ', { hour12: false });
    const sleep = ms => new Promise(res => setTimeout(res, ms));

    // --- TVORBA LOGOVACÍHO OKNA ---
    const logId = 'thebrain-logger';
    if ($(`#${logId}`).length) $(`#${logId}`).remove();

    const $logger = $(`
        <div id="${logId}" style="position: fixed; left: 10px; top: 100px; width: 250px; background: rgba(26, 0, 0, 0.9); border: 2px solid #8B0000; border-radius: 5px; z-index: 99999; font-family: Calibri, sans-serif; box-shadow: 0 0 10px black; color: #DC143C;">
            <div style="background: #8B0000; color: white; padding: 5px; font-weight: bold; font-size: 13px; display: flex; justify-content: space-between; border-radius: 3px 3px 0 0;">
                <span>${SIGNATURE} Dashboard</span>
                <span style="font-size: 10px;">v${VERSION}</span>
            </div>
            <div id="logger-countdown" style="padding: 10px; text-align: center; font-size: 20px; font-weight: bold; background: #2a0000; border-bottom: 1px solid #8B0000; color: #ffcc00;">
                PŘIPRAVEN
            </div>
            <div id="logger-content" style="padding: 8px; font-size: 11px; max-height: 200px; overflow-y: auto; line-height: 1.4;">
                <div>Bot byl spuštěn...</div>
            </div>
        </div>
    `).appendTo('body');

    function updateLog(message, isImportant = false) {
        const time = getEuroTime();
        const style = isImportant ? 'font-weight: bold; color: #ffffff;' : '';
        $('#logger-content').prepend(`<div style="border-bottom: 1px solid #330000; padding: 2px 0; ${style}">[${time}] ${message}</div>`);
        console.log(`%c[${SIGNATURE}]%c ${message}`, "background: #8B0000; color: white; padding: 2px 5px;", "color: #DC143C;");
    }

    let countdownInterval;
    function startVisualCountdown(ms, targetTime) {
        clearInterval(countdownInterval);
        let remaining = Math.floor(ms / 1000);
        updateLog(`Další start naplánován na ${targetTime}`, true);

        countdownInterval = setInterval(() => {
            if (remaining <= 0) {
                $('#logger-countdown').text("STARTUJI...");
                clearInterval(countdownInterval);
                return;
            }
            const mins = Math.floor(remaining / 60);
            const secs = remaining % 60;
            $('#logger-countdown').text(`${mins}:${secs.toString().padStart(2, '0')}`);
            remaining--;
        }, 1000);
    }

    async function sendDiscordAlert(message) {
        try {
            await $.post(DISCORD_WEBHOOK_URL, JSON.stringify({ content: `🚨 **[Bot Sběr]** ${message} @everyone` }), null, 'json');
        } catch (e) { console.error("Discord error"); }
    }

    function isCaptchaPresent() {
        const captchaSelectors = ['#bot_check', '.h-captcha', '#hcaptcha-container'];
        for (let selector of captchaSelectors) {
            if ($(selector).length > 0 && $(selector).is(':visible')) return true;
        }
        return false;
    }

    function getScavengeStatus() {
        const allSlots = $('.scavenge-option');
        let usableCount = 0, readyToClick = 0;
        allSlots.each(function() {
            const isLocked = $(this).find('.lock').length > 0;
            const isUnlocking = $(this).find('.unlock-button').length > 0 || $(this).text().includes('Odemykání');
            if (!isLocked && !isUnlocking) {
                usableCount++; 
                if ($(this).find('.btn-send, .free_send_button').filter(':visible').not('.btn-disabled').length > 0) readyToClick++;
            }
        });
        return { total: usableCount, ready: readyToClick };
    }

    function getTimeAfterSent() {
        const countdownElement = $('.return-countdown, .timer').filter(':visible').first();
        if (countdownElement.length > 0) {
            const timeText = countdownElement.text().trim();
            const parts = timeText.match(/(\d{1,2}):(\d{2}):(\d{2})/);
            if (parts) {
                const ms = ((parseInt(parts[1]) * 3600) + (parseInt(parts[2]) * 60) + parseInt(parts[3])) * 1000;
                return ms;
            }
        }
        return 7200000; 
    }

    async function runScavengingCycle() {
        if (isCaptchaPresent()) {
            updateLog("DETEKCE CAPTCHA - ZASTAVENO!", true);
            $('#logger-countdown').text("STOP").css('color', 'red');
            await sendDiscordAlert("Detekována CAPTCHA!");
            return;
        }

        const status = getScavengeStatus();
        if (status.total > 0 && status.ready < status.total) {
            const syncWait = Math.floor(Math.random() * (480000 - 300000 + 1)) + 300000;
            const targetTime = getEuroTime(new Date(Date.now() + syncWait));
            
            updateLog(`Synchronizace: Čekám na návrat slotů (${status.ready}/${status.total})`);
            startVisualCountdown(syncWait, targetTime);
            
            setTimeout(runScavengingCycle, syncWait);
            return;
        }

        if (window.TwCheese === undefined) {
            updateLog("Načítám knihovny TwCheese...");
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
            await sleep(4000); 
            TwCheese.use(TOOL_ID);
            
            updateLog("Čekám 30s na ASS preference...");
            await sleep(30000);

            let buttons = Array.from(document.querySelectorAll('.btn-send, .free_send_button'))
                               .filter(btn => btn.offsetParent !== null && !btn.classList.contains('btn-disabled'))
                               .reverse();

            updateLog(`Odesílám ${buttons.length} sběrů...`);
            for (const btn of buttons) {
                if (isCaptchaPresent()) return; 
                btn.click();
                await sleep(2000 + Math.floor(Math.random() * 1500));
            }

            const fatigueWait = Math.floor(Math.random() * (20000 - 10000 + 1)) + 10000;
            updateLog(`Únava po odeslání: ${fatigueWait/1000}s`);
            await sleep(fatigueWait);

            const dynamicWaitTime = getTimeAfterSent();
            const randomSpread = Math.floor(Math.random() * (528000 - 210000 + 1)) + 210000;
            const now = new Date();
            let nightDelay = (now.getHours() >= 1 && now.getHours() < 7) ? (Math.floor(Math.random() * (69 - 30 + 1)) + 30) * 60000 : 0;

            const totalDelay = dynamicWaitTime + randomSpread + nightDelay;
            const finalTargetTime = getEuroTime(new Date(Date.now() + totalDelay));
            
            updateLog(`Cyklus dokončen.`);
            startVisualCountdown(totalDelay, finalTargetTime);
            
            setTimeout(runScavengingCycle, totalDelay);
        } catch (err) {
            updateLog(`Chyba: ${err.message}`, true);
            setTimeout(runScavengingCycle, 300000);
        }
    }

    runScavengingCycle();
})();
