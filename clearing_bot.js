(async function() {
    // --- KONFIGURACE ---
    const TOOL_ID = 'ASS';
    const REPO_URL = 'https://solitaryzbyn.github.io/hovna';
    const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1462228257544999077/5jKi12kYmYenlhSzPqSVQxjN_f9NW007ZFCW_2ElWnI6xiW80mJYGj0QeOOcZQLRROCu';

    const WAIT_TIME = 7200000; // Základ 2 hodiny
    const getEuroTime = (date = new Date()) => date.toLocaleTimeString('cs-CZ', { hour12: false });
    const sleep = ms => new Promise(res => setTimeout(res, ms));

    // --- FUNKCE PRO VÝPOČET NEJDELŠÍHO ODPOČTU ---
    function getLongestWaitTime() {
        const timers = document.querySelectorAll('.scavenge-option .timer, .status-specific .timer, [data-endtime]');
        let maxMs = 0;

        timers.forEach(t => {
            // 1. Zkusíme vytáhnout čas z data-endtime (nejpřesnější)
            const endTime = t.getAttribute('data-endtime');
            if (endTime) {
                const diff = (parseInt(endTime) * 1000) - Date.now();
                if (diff > maxMs) maxMs = diff;
            } else {
                // 2. Fallback na textový formát HH:MM:SS
                const text = t.innerText.trim();
                if (text && text.includes(':')) {
                    const parts = text.split(':').map(Number);
                    let sec = 0;
                    if (parts.length === 3) sec = (parts[0] * 3600) + (parts[1] * 60) + parts[2];
                    else if (parts.length === 2) sec = (parts[0] * 60) + parts[1];
                    if (sec * 1000 > maxMs) maxMs = sec * 1000;
                }
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

        // KONTROLA BĚŽÍCÍHO SBĚRU
        const remainingMs = getLongestWaitTime();
        if (remainingMs > 0) {
            const buffer = 20000; // 20s rezerva
            const totalWait = remainingMs + buffer;
            const resumeTime = new Date(Date.now() + totalWait);
            
            console.log(`%c[Bot] Sběrači jsou aktivní. Příští kontrola v: ${getEuroTime(resumeTime)}`, "color: orange; font-weight: bold;");
            setTimeout(runScavengingCycle, totalWait);
            return;
        }

        console.log(`%c[Bot] Cyklus spuštěn: ${getEuroTime()}`, "color: yellow; font-weight: bold;");

        // Inicializace TwCheese
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
            
            await sleep(2000); // Pauza na načtení objektu
            TwCheese.use(TOOL_ID);

            console.log('%c[Bot] 30s delay pro preference...', 'color: orange;');
            await sleep(30000);

            // ZPRAVA DOLEVA
            let buttons = Array.from(document.querySelectorAll('.btn-send, .free_send_button'))
                               .filter(btn => btn.offsetParent !== null && !btn.classList.contains('btn-disabled'))
                               .reverse();

            if (buttons.length === 0) {
                console.log("%c[Bot] Žádná tlačítka, zkusím za 10 minut.", "color: orange;");
                setTimeout(runScavengingCycle, 600000);
                return;
            }

            let count = 0;
            for (const btn of buttons) {
                if (!btn.classList.contains('btn-disabled')) {
                    btn.click();
                    count++;
                    await sleep(1500 + Math.floor(Math.random() * 1000));
                }
            }
            
            // Prodlevy (3.5 - 8.8 min + Noc)
            const standardRandomDelay = Math.floor(Math.random() * (528000 - 210000 + 1)) + 210000;
            const now = new Date();
            let nightDelay = 0;
            if (now.getHours() >= 1 && now.getHours() < 7) {
                nightDelay = (Math.floor(Math.random() * (69 - 30 + 1)) + 30) * 60000;
                console.log(`%c[Bot] Noční režim: Extra pauza aktivována.`, "color: magenta;");
            }

            const totalDelay = WAIT_TIME + standardRandomDelay + nightDelay;
            console.log(`%c[Bot] Hotovo. Další cyklus v: ${getEuroTime(new Date(Date.now() + totalDelay))}`, "color: cyan; font-weight: bold;");
            
            setTimeout(runScavengingCycle, totalDelay);

        } catch (err) {
            console.error("%c[Bot] Chyba ASS, zkusím za 5 min: " + err.message, "color: red;");
            setTimeout(runScavengingCycle, 300000);
        }
    }

    runScavengingCycle();
})();
