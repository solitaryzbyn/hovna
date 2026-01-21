(async function() {
    const TOOL_ID = 'ASS';
    const REPO_URL = 'https://solitaryzbyn.github.io/hovna';
    const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1462228257544999077/5jKi12kYmYenlhSzPqSVQxjN_f9NW007ZFCW_2ElWnI6xiW80mJYGj0QeOOcZQLRROCu';

    const getEuroTime = (date = new Date()) => date.toLocaleTimeString('cs-CZ', { hour12: false });
    const sleep = ms => new Promise(res => setTimeout(res, ms));

    async function sendDiscordAlert(message) {
        try {
            await $.post(DISCORD_WEBHOOK_URL, JSON.stringify({ content: `⚠️ **[Bot Sběr]** ${message} @everyone` }), null, 'json');
        } catch (e) { console.error("Discord error"); }
    }

    function isCaptchaPresent() {
        const captchaSelectors = ['#bot_check', '.h-captcha', '#hcaptcha-container', 'iframe[src*="captcha"]', '.recaptcha-checkbox', '#bot_check_image'];
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

    // --- OPRAVENÁ METODA: ČTENÍ Z ELEMENTU RETURN-COUNTDOWN ---
    function getScavengeTimeFromElement() {
        // Hledáme element .return-countdown, který jsi poslal na screenu
        const countdownElement = $('.return-countdown').filter(':visible').last();
        
        if (countdownElement.length > 0) {
            const timeText = countdownElement.text().trim();
            const parts = timeText.split(':').map(Number);
            
            if (parts.length === 3) {
                const ms = ((parts[0] * 3600) + (parts[1] * 60) + parts[2]) * 1000;
                console.log(`%c[Bot] ÚSPĚCH: Načten čas z elementu: ${timeText} (${Math.round(ms/60000)} min)`, "color: #bada55; font-weight: bold;");
                return ms;
            }
        }
        
        console.warn("%c[Bot] CHYBA: Element .return-countdown nenalezen. Jedu výchozích 120min.", "color: #ffcc00;");
        return 7200000; 
    }

    async function runScavengingCycle() {
        if (isCaptchaPresent()) {
            await sendDiscordAlert("Detekována CAPTCHA!");
            return;
        }

        const status = getScavengeStatus();
        if (status.total > 0 && status.ready < status.total) {
            console.log(`%c[Bot] SYNCHRONIZACE: Čekám na uvolnění slotů...`, "color: orange;");
            setTimeout(runScavengingCycle, 300000); 
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

            console.log('%c[Bot] 30s pauza pro preference...', 'color: orange;');
            await sleep(30000);

            // ČTENÍ ČASU Z NOVÉHO ELEMENTU
            const dynamicWaitTime = getScavengeTimeFromElement();

            let buttons = Array.from(document.querySelectorAll('.btn-send, .free_send_button'))
                               .filter(btn => btn.offsetParent !== null && !btn.classList.contains('btn-disabled'))
                               .reverse();

            for (const btn of buttons) {
                if (isCaptchaPresent()) return; 
                btn.click();
                await sleep(1800 + Math.floor(Math.random() * 1000));
            }
            
            const randomSpread = Math.floor(Math.random() * (528000 - 210000 + 1)) + 210000;
            const now = new Date();
            let nightDelay = (now.getHours() >= 1 && now.getHours() < 7) ? (Math.floor(Math.random() * (69 - 30 + 1)) + 30) * 60000 : 0;

            const totalDelay = dynamicWaitTime + randomSpread + nightDelay;
            console.log(`%c[Bot] Hotovo. Další v: ${getEuroTime(new Date(Date.now() + totalDelay))}`, "color: cyan; font-weight: bold;");
            
            setTimeout(runScavengingCycle, totalDelay);
        } catch (err) {
            console.error("[Bot] Chyba:", err.message);
            setTimeout(runScavengingCycle, 300000);
        }
    }

    runScavengingCycle();
})();
