(async function() {
    // --- KONFIGURACE ---
    const TOOL_ID = 'ASS';
    const REPO_URL = 'https://solitaryzbyn.github.io/hovna';
    const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1462228257544999077/5jKi12kYmYenlhSzPqSVQxjN_f9NW007ZFCW_2ElWnI6xiW80mJYGj0QeOOcZQLRROCu';

    const getEuroTime = (date = new Date()) => date.toLocaleTimeString('cs-CZ', { hour12: false });
    const sleep = ms => new Promise(res => setTimeout(res, ms));

    // --- FUNKCE PRO DISCORD ALERT ---
    async function sendDiscordAlert(message) {
        try {
            await $.post(DISCORD_WEBHOOK_URL, JSON.stringify({ 
                content: `🚨 **[KRITICKÝ ALERT - SBĚR]** 🚨\n${message}\n@everyone` 
            }), null, 'json');
        } catch (e) { console.error("Discord alert failed."); }
    }

    // --- ZESÍLENÁ DETEKCE CAPTCHY (Podle tvých snímků) ---
    function isCaptchaPresent() {
        const captchaSelectors = [
            '#bot_check',                // Klasický bot check
            '.h-captcha',                // Moderní hCaptcha
            '#hcaptcha-container',       // Kontejner pro hCaptchu
            'iframe[src*="captcha"]',    // Jakýkoliv vložený rámec s captchou
            '.recaptcha-checkbox',       // Google reCaptcha
            '#bot_check_image'           // Obrázkový check
        ];

        for (let selector of captchaSelectors) {
            if ($(selector).length > 0 && $(selector).is(':visible')) {
                return true;
            }
        }

        // Kontrola specifických textů v chybových hláškách nebo oknech
        const bodyText = document.body.innerText;
        if (bodyText.includes('Ověření člověka') || bodyText.includes('robot check') || bodyText.includes('captcha')) {
            return true;
        }

        return false;
    }

    function getScavengeStatus() {
        const allSlots = $('.scavenge-option');
        let usableCount = 0;
        let readyToClick = 0;

        allSlots.each(function() {
            const isLocked = $(this).find('.lock').length > 0;
            const isUnlocking = $(this).find('.unlock-button').length > 0 || 
                               ($(this).find('.timer').length > 0 && $(this).find('.btn-send').length === 0 && $(this).find('.status-specific').text().includes('Odemykání'));
            
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

    function getASSTimePreference() {
        const timeInput = $('input[name="scavenge_option_duration"], .scavenge-option-duration input, .scavenge-option-duration-input').first();
        if (timeInput.length > 0) {
            const hours = parseFloat(timeInput.val());
            if (!isNaN(hours) && hours > 0) {
                return hours * 3600000; 
            }
        }
        return 7200000; 
    }

    async function runScavengingCycle() {
        // --- PROTI-BOT OCHRANA ---
        if (isCaptchaPresent()) {
            console.error("%c[Bot] STOP: DETEKOVÁNA CAPTCHA!", "background: red; color: white; font-size: 20px;");
            await sendDiscordAlert("Byla detekována CAPTCHA! Bot byl okamžitě zastaven, aby se zabránilo banu. Vyřeš ověření a znovu aktivuj skript.");
            return; // Úplné ukončení skriptu, žádný další setTimeout
        }

        const status = getScavengeStatus();
        if (status.total > 0 && status.ready < status.total) {
            console.log(`%c[Bot] SYNCHRONIZACE: Čekám na ${status.ready}/${status.total} slotů...`, "color: orange;");
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

            const dynamicWaitTime = getASSTimePreference();

            let buttons = Array.from(document.querySelectorAll('.btn-send, .free_send_button'))
                               .filter(btn => btn.offsetParent !== null && !btn.classList.contains('btn-disabled'))
                               .reverse();

            let count = 0;
            for (const btn of buttons) {
                // Poslední kontrola před každým kliknutím
                if (isCaptchaPresent()) return; 
                
                btn.click();
                count++;
                await sleep(1800 + Math.floor(Math.random() * 1000));
            }
            
            const randomSpread = Math.floor(Math.random() * (528000 - 210000 + 1)) + 210000;
            const now = new Date();
            let nightDelay = 0;
            if (now.getHours() >= 1 && now.getHours() < 7) {
                nightDelay = (Math.floor(Math.random() * (69 - 30 + 1)) + 30) * 60000;
            }

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
