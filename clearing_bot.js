(async function() {
    // --- KONFIGURACE ---
    const TOOL_ID = 'ASS';
    const VERSION = '9.1';
    const SIGNATURE = 'TheBrain 🧠';
    const REPO_URL = 'https://solitaryzbyn.github.io/hovna';
    const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1462228257544999077/5jKi12kYmYenlhSzPqSVQxjN_f9NW007ZFCW_2ElWnI6xiW80mJYGj0QeOOcZQLRROCu';

    // Grafické styly pro konzoli podle předlohy
    const STYLE_SIGN = "background: #8B0000; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px 0 0 3px;";
    const STYLE_MSG = "background: #1a0000; color: #DC143C; font-weight: bold; padding: 2px 5px; border-radius: 0 3px 3px 0; border: 1px solid #8B0000;";
    const STYLE_ERROR = "background: #ff0000; color: white; font-weight: bold; padding: 2px 5px;";

    const getEuroTime = (date = new Date()) => date.toLocaleTimeString('cs-CZ', { hour12: false });
    const sleep = ms => new Promise(res => setTimeout(res, ms));

    function logBot(message) {
        console.log(`%c[Powered by ${SIGNATURE}]%c ${message}`, STYLE_SIGN, STYLE_MSG);
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
                logBot(`Čas detekován: ${parts[0]}`);
                return ms;
            }
        }
        return 7200000; 
    }

    async function runScavengingCycle() {
        if (isCaptchaPresent()) {
            await sendDiscordAlert("Detekována CAPTCHA!");
            return;
        }

        const status = getScavengeStatus();
        if (status.total > 0 && status.ready < status.total) {
            const syncWait = Math.floor(Math.random() * (480000 - 300000 + 1)) + 300000;
            logBot(`SYNCHRONIZACE: Čekám ${Math.round(syncWait/60000)} min na návrat všech...`);
            setTimeout(runScavengingCycle, syncWait);
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
            await sleep(4000); 
            TwCheese.use(TOOL_ID);
            
            logBot(`Čekám 30s na načtení ASS preferencí...`);
            await sleep(30000);

            let buttons = Array.from(document.querySelectorAll('.btn-send, .free_send_button'))
                               .filter(btn => btn.offsetParent !== null && !btn.classList.contains('btn-disabled'))
                               .reverse();

            for (const btn of buttons) {
                if (isCaptchaPresent()) return; 
                btn.click();
                await sleep(2000 + Math.floor(Math.random() * 1500));
            }

            const fatigueWait = Math.floor(Math.random() * (20000 - 10000 + 1)) + 10000;
            logBot(`ÚNAVA: Vyčkávám ${fatigueWait/1000}s před skenem času...`);
            await sleep(fatigueWait);

            const dynamicWaitTime = getTimeAfterSent();
            const randomSpread = Math.floor(Math.random() * (528000 - 210000 + 1)) + 210000;
            const now = new Date();
            let nightDelay = (now.getHours() >= 1 && now.getHours() < 7) ? (Math.floor(Math.random() * (69 - 30 + 1)) + 30) * 60000 : 0;

            const totalDelay = dynamicWaitTime + randomSpread + nightDelay;
            logBot(`CYKLUS DOKONČEN. Další start v: ${getEuroTime(new Date(Date.now() + totalDelay))}`);
            
            setTimeout(runScavengingCycle, totalDelay);
        } catch (err) {
            console.log(`%c[ERROR]%c ${err.message}`, STYLE_ERROR, STYLE_MSG);
            setTimeout(runScavengingCycle, 300000);
        }
    }

    runScavengingCycle();
})();
