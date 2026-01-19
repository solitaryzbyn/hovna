(async function() {
    const TOOL_ID = 'ASS';
    const REPO_URL = 'https://solitaryzbyn.github.io/hovna';
    const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1462228257544999077/5jKi12kYmYenlhSzPqSVQxjN_f9NW007ZFCW_2ElWnI6xiW80mJYGj0QeOOcZQLRROCu';

    const WAIT_TIME = 7200000; // 2 hodiny
    const getEuroTime = (date = new Date()) => date.toLocaleTimeString('cs-CZ', { hour12: false });
    const sleep = ms => new Promise(res => setTimeout(res, ms));

    // --- NOVÁ STRATEGIE: POČÍTÁNÍ TLAČÍTEK ---
    function getAvailableButtonsCount() {
        // Hledáme pouze viditelná a ne-zakázaná tlačítka pro start sběru
        return $('.btn-send, .free_send_button').filter(function() {
            return $(this).is(':visible') && !$(this).hasClass('btn-disabled') && $(this).offsetParent() !== null;
        }).length;
    }

    async function runScavengingCycle() {
        if (document.getElementById('bot_check') || document.querySelector('.h-captcha')) return;

        // KONTROLA: Musí být volné všechny 4 sloty
        const freeSlots = getAvailableButtonsCount();
        
        if (freeSlots < 4) {
            console.log(`%c[Bot] SYNCHRONIZACE: Volné pouze ${freeSlots}/4 sloty. Čekám 5 minut na návrat ostatních...`, "color: orange; font-weight: bold;");
            setTimeout(runScavengingCycle, 300000); // Kontrola každých 5 minut, dokud nejsou všichni doma
            return;
        }

        console.log(`%c[Bot] POTVRZENO: Všechny 4 sloty jsou volné. Startuji: ${getEuroTime()}`, "color: yellow; font-weight: bold;");

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

            console.log('%c[Bot] 30s delay pro ASS preference...', 'color: orange;');
            await sleep(30000);

            // ZPRAVA DOLEVA (Otočené pořadí)
            let buttons = Array.from(document.querySelectorAll('.btn-send, .free_send_button'))
                               .filter(btn => btn.offsetParent !== null && !btn.classList.contains('btn-disabled'))
                               .reverse();

            // Finální kontrola počtu těsně před klikem
            if (buttons.length < 4) {
                console.log("%c[Bot] Chyba synchronizace na poslední chvíli, restartuji.", "color: red;");
                runScavengingCycle();
                return;
            }

            let count = 0;
            for (const btn of buttons) {
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
