(async function() {
    const TOOL_ID = 'ASS';
    const REPO_URL = 'https://solitaryzbyn.github.io/hovna';
    const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1462228257544999077/5jKi12kYmYenlhSzPqSVQxjN_f9NW007ZFCW_2ElWnI6xiW80mJYGj0QeOOcZQLRROCu';

    const WAIT_TIME = 7200000; // Základ 2 hodiny
    const getEuroTime = (date = new Date()) => date.toLocaleTimeString('cs-CZ', { hour12: false }); //
    const sleep = ms => new Promise(res => setTimeout(res, ms));

    // --- AGRESIVNÍ DETEKCE PŘES HERNÍ SYSTÉM (Jako u obchodníků) ---
    function getLongestWaitTime() {
        let maxMs = 0;
        // Prohledá všechny aktivní odpočty na stránce sběru
        $('.scavenge-option, .status-specific').find('.timer').each(function() {
            if (window.Timing && typeof Timing.getReturnTime === 'function') {
                const remaining = Timing.getReturnTime($(this)); 
                if (remaining > maxMs) maxMs = remaining;
            }
        });
        return maxMs;
    }

    async function runScavengingCycle() {
        // Kontrola Captchy
        if (document.getElementById('bot_check') || document.querySelector('.h-captcha')) {
            console.error("%c[Bot] STOP: CAPTCHA!", "background: red; color: white;");
            return;
        }

        // Kontrola, zda jsou sběrači venku
        const remainingMs = getLongestWaitTime();
        if (remainingMs > 2000) { 
            const totalWait = remainingMs + 15000; // Rezerva 15s
            console.log(`%c[Bot] Sběrači jsou aktivní. Čekám do: ${getEuroTime(new Date(Date.now() + totalWait))}`, "color: orange; font-weight: bold;");
            setTimeout(runScavengingCycle, totalWait);
            return;
        }

        console.log(`%c[Bot] Start cyklu (2h): ${getEuroTime()}`, "color: yellow; font-weight: bold;");

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
            
            // Stabilizační pauza proti chybě "reading focus"
            await sleep(3000); 
            TwCheese.use(TOOL_ID);

            console.log('%c[Bot] 30s delay pro preference...', 'color: orange;'); //
            await sleep(30000);

            // ZPRAVA DOLEVA (Reverse)
            let buttons = Array.from(document.querySelectorAll('.btn-send, .free_send_button'))
                               .filter(btn => btn.offsetParent !== null && !btn.classList.contains('btn-disabled'))
                               .reverse();

            let count = 0;
            for (const btn of buttons) {
                if (btn.offsetParent !== null && !btn.classList.contains('btn-disabled')) {
                    btn.click();
                    count++;
                    await sleep(1500 + Math.floor(Math.random() * 1000)); // Lidské prodlevy
                }
            }
            
            // Náhodný posun 3.5 - 8.8 min
            const standardRandomDelay = Math.floor(Math.random() * (528000 - 210000 + 1)) + 210000;
            
            // Noční pauza 1:00 - 7:00 (30-69 min)
            const now = new Date();
            let nightDelay = 0;
            if (now.getHours() >= 1 && now.getHours() < 7) {
                nightDelay = (Math.floor(Math.random() * (69 - 30 + 1)) + 30) * 60000;
                console.log(`%c[Bot] Noční režim aktivní.`, "color: magenta;");
            }

            const totalDelay = WAIT_TIME + standardRandomDelay + nightDelay;
            console.log(`%c[Bot] Hotovo. Další v: ${getEuroTime(new Date(Date.now() + totalDelay))}`, "color: cyan; font-weight: bold;");
            
            setTimeout(runScavengingCycle, totalDelay);
        } catch (err) {
            console.error("[Bot] Chyba ASS, zkusím za 5 min:", err.message);
            setTimeout(runScavengingCycle, 300000);
        }
    }

    runScavengingCycle();
})();
