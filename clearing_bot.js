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

    // --- AGRESIVNÍ DETEKCE ČASU Z ASS (v4.0) ---
    function getASSTimePreference() {
        let detectedTime = null;

        // 1. Zkusíme nejdřív najít políčko podle běžných názvů v ASS
        const assInputs = $('input').filter(function() {
            const name = ($(this).attr('name') || "").toLowerCase();
            const id = ($(this).attr('id') || "").toLowerCase();
            const cls = ($(this).attr('class') || "").toLowerCase();
            return name.includes('duration') || id.includes('duration') || cls.includes('duration');
        });

        if (assInputs.length > 0) {
            // Vezmeme první nalezené políčko, které má v sobě číslo
            assInputs.each(function() {
                const val = parseFloat($(this).val());
                if (!isNaN(val) && val > 0 && val < 24) { // Čas musí být rozumný (0-24h)
                    detectedTime = val;
                    return false; // ukončí loop
                }
            });
        }

        if (detectedTime !== null) {
            console.log(`%c[Bot] ÚSPĚCH: Detekován čas v rozhraní: ${detectedTime}h`, "color: #bada55; font-weight: bold;");
            return detectedTime * 3600000; 
        }

        // 2. Fallback: Pokud bot nic nenašel, vypíše chybu do konzole, abys věděl, že jede postaru
        console.warn("%c[Bot] CHYBA: Čas v ASS nenalezen. Jedu výchozích 120min.", "color: #ffcc00; font-weight: bold;");
        return 7200000; 
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

    async function runScavengingCycle() {
        if (isCaptchaPresent()) {
            console.error("%c[Bot] STOP: CAPTCHA!", "background: red; color: white;");
            await sendDiscordAlert("Byla detekována CAPTCHA! Bot byl okamžitě zastaven.");
            return;
        }

        const status = getScavengeStatus();
        if (status.total > 0 && status.ready < status.total) {
            console.log(`%c[Bot] SYNCHRONIZACE: Čekám na uvolnění ${status.ready}/${status.total} slotů...`, "color: orange;");
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

            // PAUZA 30s na aplikaci preferencí
            console.log('%c[Bot] 30s pauza pro načtení nastavení...', 'color: orange;');
            for(let i=30; i>0; i--) {
                if(i % 10 === 0) console.log(`%c[Bot] Zbývá ${i}s...`, 'color: gray;');
                await sleep(1000);
            }

            // --- TADY SE DĚJE DYNAMICKÉ ČTENÍ ---
            const dynamicWaitTime = getASSTimePreference();

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
