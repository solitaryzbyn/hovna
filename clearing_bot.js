(async function() {
    const TOOL_ID = 'ASS';
    const REPO_URL = 'https://solitaryzbyn.github.io/hovna';
    const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1462228257544999077/5jKi12kYmYenlhSzPqSVQxjN_f9NW007ZFCW_2ElWnI6xiW80mJYGj0QeOOcZQLRROCu';

    const WAIT_TIME = 7200000; // 2 hodiny
    const getEuroTime = (date = new Date()) => date.toLocaleTimeString('cs-CZ', { hour12: false });
    const sleep = ms => new Promise(res => setTimeout(res, ms));

    // --- STRIKTNÍ DETEKCE (Skenuje text časovačů v každém slotu) ---
    function isAnythingStillRunning() {
        let maxMs = 0;
        // Hledáme texty HH:MM:SS v polích sběru
        const timerTexts = $('.scavenge-option, .status-specific').find('.timer, span[data-endtime], .status-specific span').toArray();
        
        for (let t of timerTexts) {
            const text = $(t).text().trim();
            // Pokud text obsahuje dvojtečky (formát času), považujeme sběr za běžící
            if (text.match(/\d{1,2}:\d{2}:\d{2}/)) {
                const parts = text.split(':').map(Number);
                const ms = ((parts[0] * 3600) + (parts[1] * 60) + parts[2]) * 1000;
                if (ms > maxMs) maxMs = ms;
            }
        }
        return maxMs;
    }

    async function runScavengingCycle() {
        if (document.getElementById('bot_check') || document.querySelector('.h-captcha')) return;

        // Kontrola, zda opravdu všechno stojí
        const remainingMs = isAnythingStillRunning();
        if (remainingMs > 0) {
            const totalWait = remainingMs + 30000; // Rezerva 30s pro jistotu
            console.log(`%c[Bot] DETEKCE: Sběry stále běží. Čekám na poslední návrat do: ${getEuroTime(new Date(Date.now() + totalWait))}`, "color: orange; font-weight: bold;");
            setTimeout(runScavengingCycle, totalWait);
            return;
        }

        console.log(`%c[Bot] Ověřeno. Všechny sloty jsou volné. Zahajuji: ${getEuroTime()}`, "color: yellow; font-weight: bold;");

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
            
            await sleep(4000); // Prodloužená pauza pro stabilizaci ASS
            TwCheese.use(TOOL_ID);

            console.log('%c[Bot] 30s delay pro ASS preference...', 'color: orange;');
            await sleep(30000);

            // Znovu kontrola těsně před klikáním (pojistka)
            if (isAnythingStillRunning() > 0) {
                console.log("%c[Bot] Chyba synchronizace, restartuji čekání.", "color: red;");
                runScavengingCycle();
                return;
            }

            let buttons = Array.from(document.querySelectorAll('.btn-send, .free_send_button'))
                               .filter(btn => btn.offsetParent !== null && !btn.classList.contains('btn-disabled'))
                               .reverse();

            let count = 0;
            for (const btn of buttons) {
                if (btn.offsetParent !== null && !btn.classList.contains('btn-disabled')) {
                    btn.click();
                    count++;
                    await sleep(1800 + Math.floor(Math.random() * 1000));
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
            console.log(`%c[Bot] Hotovo. Odesláno ${count} sběrů. Další v: ${getEuroTime(new Date(Date.now() + totalDelay))}`, "color: cyan; font-weight: bold;");
            
            setTimeout(runScavengingCycle, totalDelay);
        } catch (err) {
            console.error("[Bot] Chyba:", err.message);
            setTimeout(runScavengingCycle, 300000);
        }
    }

    runScavengingCycle();
})();
