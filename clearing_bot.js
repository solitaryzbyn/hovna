(async function() {
    // --- KONFIGURACE ---
    const TOOL_ID = 'ASS';
    const REPO_URL = 'https://solitaryzbyn.github.io/hovna';
    const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1462228257544999077/5jKi12kYmYenlhSzPqSVQxjN_f9NW007ZFCW_2ElWnI6xiW80mJYGj0QeOOcZQLRROCu';

    const getEuroTime = (date = new Date()) => date.toLocaleTimeString('cs-CZ', { hour12: false });
    const sleep = ms => new Promise(res => setTimeout(res, ms));

    async function sendDiscordAlert(message) {
        try {
            await $.post(DISCORD_WEBHOOK_URL, JSON.stringify({ 
                content: `🚨 **[KRITICKÝ ALERT - SBĚR]** 🚨\n${message}\n@everyone` 
            }), null, 'json');
        } catch (e) { console.error("Discord alert failed."); }
    }

    function isCaptchaPresent() {
        const captchaSelectors = ['#bot_check', '.h-captcha', '#hcaptcha-container', 'iframe[src*="captcha"]', '.recaptcha-checkbox', '#bot_check_image'];
        for (let selector of captchaSelectors) {
            if ($(selector).length > 0 && $(selector).is(':visible')) return true;
        }
        const bodyText = document.body.innerText;
        return bodyText.includes('Ověření člověka') || bodyText.includes('robot check') || bodyText.includes('captcha');
    }

    function getScavengeStatus() {
        const allSlots = $('.scavenge-option');
        let usableCount = 0;
        let readyToClick = 0;

        allSlots.each(function() {
            const isLocked = $(this).find('.lock').length > 0;
            const isUnlocking = $(this).find('.unlock-button').length > 0 || ($(this).find('.timer').length > 0 && $(this).find('.btn-send').length === 0 && $(this).find('.status-specific').text().includes('Odemykání'));
            const hasSendButton = $(this).find('.btn-send, .free_send_button').length > 0;
            const isScavenging = $(this).find('.status-specific').text().includes('Sběr') || $(this).find('.timer').length > 0;

            if (!isLocked && !isUnlocking && (hasSendButton || isScavenging)) {
                usableCount++; 
                const btn = $(this).find('.btn-send, .free_send_button').filter(':visible').not('.btn-disabled');
                if (btn.length > 0) readyToClick++;
            }
        });
        return { total: usableCount, ready: readyToClick };
    }

    // --- OPRAVENÉ ČTENÍ ČASU (V6.0) ---
    function getScavengeTimeFromActiveButton() {
        // Najdeme tlačítko, na které se bude klikat jako první (vpravo)
        const activeButtons = $('.btn-send, .free_send_button').filter(':visible').not('.btn-disabled');
        const firstBtn = activeButtons.last(); 
        
        if (firstBtn.length > 0) {
            // Hledáme časový údaj přímo v textu tohoto tlačítka
            const btnText = firstBtn.text();
            const timeMatch = btnText.match(/(\d{1,2}):(\d{2}):(\d{2})/);

            if (timeMatch) {
                const ms = ((parseInt(timeMatch[1]) * 3600) + (parseInt(timeMatch[2]) * 60) + parseInt(timeMatch[3])) * 1000;
                console.log(`%c[Bot] Detekován čas PŘÍMO NA TLAČÍTKU: ${timeMatch[0]} (${Math.round(ms/60000)} min)`, "color: #bada55; font-weight: bold;");
                return ms;
            }
        }
        
        console.warn("%c[Bot] Čas na tlačítku nenalezen, fallback na 120min.", "color: #ffcc00;");
        return 7200000; 
    }

    async function runScavengingCycle() {
        if (isCaptchaPresent()) {
            await sendDiscordAlert("Byla detekována CAPTCHA!");
            return;
        }

        const status = getScavengeStatus();
        if (status.total > 0 && status.ready < status.total) {
            console.log(`%c[Bot] SYNCHRONIZACE: Čekám na sloty (${status.ready}/${status.total})...`, "color: orange;");
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
            for(let i=30; i>0; i--) {
                if(i % 10 === 0) console.log(`%c[Bot] Zbývá ${i}s...`, 'color: gray;');
                await sleep(1000);
            }

            // Čtení času z konkrétního tlačítka před odesláním
            const dynamicWaitTime = getScavengeTimeFromActiveButton();

            let buttons = Array.from(document.querySelectorAll('.btn-send, .free_send_button'))
                               .filter(btn => btn.offsetParent !== null && !btn.classList.contains('btn-disabled'))
                               .reverse();

            let count = 0;
            for (const btn of buttons) {
                if (isCaptchaPresent()) return; 
                btn.click();
                count++;
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
