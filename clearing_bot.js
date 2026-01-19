(async function() {
    const TOOL_ID = 'ASS';
    const REPO_URL = 'https://solitaryzbyn.github.io/hovna';
    const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1462228257544999077/5jKi12kYmYenlhSzPqSVQxjN_f9NW007ZFCW_2ElWnI6xiW80mJYGj0QeOOcZQLRROCu';

    const WAIT_TIME = 7200000; // 2 hodiny
    const getEuroTime = (date = new Date()) => date.toLocaleTimeString('cs-CZ', { hour12: false });
    const sleep = ms => new Promise(res => setTimeout(res, ms));

    // --- SYNCHRONIZAČNÍ DETEKCE (Čeká na úplně poslední návrat) ---
    function getLongestWaitTime() {
        let maxMs = 0;
        // Prohledá všechny časovače na stránce
        $('.scavenge-option, .status-specific').find('.timer').each(function() {
            if (window.Timing && typeof Timing.getReturnTime === 'function') {
                const remaining = Timing.getReturnTime($(this)); 
                if (remaining > maxMs) maxMs = remaining;
            }
        });
        return maxMs;
    }

    async function runScavengingCycle() {
        if (document.getElementById('bot_check') || document.querySelector('.h-captcha')) return;

        // KONTROLA SYNCHRONIZACE: Pokud někdo ještě běží, bot čeká na toho posledního
        const remainingMs = getLongestWaitTime();
        if (remainingMs > 1000) { 
            const totalWait = remainingMs + 25000; // Rezerva 25s pro bezpečné odblokování všech slotů
            console.log(`%c[Bot] Čekám na synchronizaci všech sběrů. Start všech 4 slotů v: ${getEuroTime(new Date(Date.now() + totalWait))}`, "color: orange; font-weight: bold;");
            setTimeout(runScavengingCycle, totalWait);
            return;
        }

        console.log(`%c[Bot] Všechny sběry dokončeny. Zahajuji hromadné odesílání: ${getEuroTime()}`, "color: yellow; font-weight: bold;");

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
            
            await sleep(3000); 
            TwCheese.use(TOOL_ID);

            console.log('%c[Bot] 30s delay pro ASS nastavení...', 'color: orange;');
            await sleep(30000);

            // ZPRAVA DOLEVA (Od nejtěžšího po nejlehčí)
            let buttons = Array.from(document.querySelectorAll('.btn-send, .free_send_button'))
                               .filter(btn => btn.offsetParent !== null && !btn.classList.contains('btn-disabled'))
                               .reverse();

            if (buttons.length < 4) {
                console.log(`%c[Bot] Pozor: K dispozici pouze ${buttons.length} sloty z 4. Odesílám co je volné.`, "color: #ff8000;");
            }

            let count = 0;
            for (const btn of buttons) {
                if (btn.offsetParent !== null && !btn.classList.contains('btn-disabled')) {
                    btn.click();
                    count++;
                    await sleep(1600 + Math.floor(Math.random() * 1000));
                }
            }
            
            const randomSpread = Math.floor(Math.random() * (528000 - 210000 + 1)) + 210000;
            
            const now = new Date();
            let nightDelay = 0;
            if (now.getHours() >= 1 && now.getHours() < 7) {
                nightDelay = (Math.floor(Math.random() * (69 - 30 + 1)) + 30) * 60000;
                console.log(`%c[Bot] Noční režim aktivní.`, "color: magenta;");
            }

            const totalDelay = WAIT_TIME + randomSpread + nightDelay;
            console.log(`%c[Bot] Hotovo. Všech ${count} sběrů odesláno. Další hromadný start v: ${getEuroTime(new Date(Date.now() + totalDelay))}`, "color: cyan; font-weight: bold;");
            
            setTimeout(runScavengingCycle, totalDelay);
        } catch (err) {
            console.error("[Bot] Chyba ASS, zkusím za 5 min:", err.message);
            setTimeout(runScavengingCycle, 300000);
        }
    }

    runScavengingCycle();
})();
