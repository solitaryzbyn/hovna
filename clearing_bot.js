(async function() {
    // --- KONFIGURACE ---
    const TOOL_ID = 'ASS';
    const VERSION = '10.0';
    const SIGNATURE = 'TheBrain 🧠';
    const REPO_URL = 'https://solitaryzbyn.github.io/hovna';
    const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1462228257544999077/5jKi12kYmYenlhSzPqSVQxjN_f9NW007ZFCW_2ElWnI6xiW80mJYGj0QeOOcZQLRROCu';

    const STYLE_SIGN = "background: #8B0000; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px 0 0 3px;";
    const STYLE_MSG = "background: #1a0000; color: #DC143C; font-weight: bold; padding: 2px 5px; border-radius: 0 3px 3px 0; border: 1px solid #8B0000;";
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

    // --- NOVÁ FUNKCE: ZÍSKÁNÍ NEJDELŠÍHO ZBÝVAJÍCÍHO ČASU ---
    function getMaxRemainingTimeMs() {
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

    async function runScavengingCycle() {
        if (isCaptchaPresent()) {
            await sendDiscordAlert("Detekována CAPTCHA!");
            return;
        }

        const status = getScavengeStatus();
        
        // Pokud není nic připraveno ke kliknutí, čekáme standardně
        if (status.ready === 0) {
            const syncWait = Math.floor(Math.random() * (480000 - 300000 + 1)) + 300000;
            logBot(`Žádný volný slot. Kontrola za ${Math.round(syncWait/60000)} min...`);
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
            
            logBot(`Dorovnávám čas podle aktivních sběrů...`);
            
            // --- LOGIKA DOROVNÁNÍ ČASU ---
            const maxRemainingMs = getMaxRemainingTimeMs();
            if (maxRemainingMs > 300000) { // Pokud zbývá víc než 5 min
                const targetMs = maxRemainingMs - 210000; // Cíl: dorazit o 3.5 min dříve
                const targetHours = (targetMs / 3600000).toFixed(2);
                
                // Přepsání času v ASS rozhraní pro tento okamžik
                const timeInput = $('input[name="scavenge_option_duration"], .scavenge-option-duration input').first();
                if (timeInput.length > 0) {
                    timeInput.val(targetHours).trigger('change');
                    logBot(`Nastaven dorovnávací čas: ${targetHours}h`);
                    await sleep(2000); // Čas pro ASS na přepočet vojáků
                }
            }

            let buttons = Array.from(document.querySelectorAll('.btn-send, .free_send_button'))
                               .filter(btn => btn.offsetParent !== null && !btn.classList.contains('btn-disabled'))
                               .reverse();

            for (const btn of buttons) {
                if (isCaptchaPresent()) return; 
                btn.click();
                await sleep(2000 + Math.floor(Math.random() * 1500));
            }

            const fatigueWait = Math.floor(Math.random() * (20000 - 10000 + 1)) + 10000;
            logBot(`ÚNAVA: Vyčkávám ${fatigueWait/1000}s...`);
            await sleep(fatigueWait);

            // Výpočet dalšího startu podle nejdelšího sběru
            const totalDelay = getMaxRemainingTimeMs() + 120000; // Rezerva 2 minuty
            logBot(`Dorovnáno. Celková synchronizace v: ${getEuroTime(new Date(Date.now() + totalDelay))}`);
            
            setTimeout(runScavengingCycle, totalDelay);
        } catch (err) {
            logBot(`Chyba: ${err.message}`);
            setTimeout(runScavengingCycle, 300000);
        }
    }

    runScavengingCycle();
})();
