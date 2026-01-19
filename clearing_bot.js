(async function() {
    // --- KONFIGURACE ---
    const TOOL_ID = 'ASS';
    const REPO_URL = 'https://solitaryzbyn.github.io/hovna';
    const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1462228257544999077/5jKi12kYmYenlhSzPqSVQxjN_f9NW007ZFCW_2ElWnI6xiW80mJYGj0QeOOcZQLRROCu';

    const WAIT_TIME = 7200000; // Základ 1 hodina
    const getEuroTime = (date = new Date()) => date.toLocaleTimeString('cs-CZ', { hour12: false });

    const sleep = ms => new Promise(res => setTimeout(res, ms));

    // --- Funkce pro zjištění času návratu sběračů ---
    function getLongestWaitTime() {
        const timers = document.querySelectorAll('.scavenge-option .timer');
        let maxSeconds = 0;

        timers.forEach(timer => {
            const timeParts = timer.innerText.split(':').map(Number);
            if (timeParts.length === 3) {
                const seconds = (timeParts[0] * 3600) + (timeParts[1] * 60) + timeParts[2];
                if (seconds > maxSeconds) maxSeconds = seconds;
            }
        });
        return maxSeconds * 1000; // Převod na milisekundy
    }

    async function runScavengingCycle(isFirstRun = false) {
        // Detekce běžících sběrů při prvním spuštění
        if (isFirstRun) {
            const initialWait = getLongestWaitTime();
            if (initialWait > 0) {
                const resumeTime = new Date(Date.now() + initialWait + 10000); // +10s rezerva
                console.log(`%c[Bot] Sběrači jsou aktivní. Čekám na návrat nejdélejšího do: ${getEuroTime(resumeTime)}`, "color: orange; font-weight: bold;");
                setTimeout(() => runScavengingCycle(false), initialWait + 10000);
                return;
            }
        }

        // Kontrola Captchy
        if (document.getElementById('bot_check') || document.querySelector('.h-captcha')) {
            console.error("%c[Bot] STOP: CAPTCHA DETEKOVÁNA!", "background: red; color: white;");
            // Zde by mohl být alarm nebo Discord notifikace
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
            TwCheese.use(TOOL_ID);

            console.log('%c[Bot] 30s delay pro preference...', 'color: orange;');
            await sleep(30000); // Pauza na ruční nastavení preferencí

            let buttons = Array.from(document.querySelectorAll('.btn-send, .free_send_button')).reverse();
            let count = 0;
            for (const btn of buttons) {
                if (!btn.classList.contains('btn-disabled') && btn.offsetParent !== null) {
                    btn.click();
                    count++;
                    await sleep(1300 + Math.floor(Math.random() * 800)); // Lidské prodlevy
                }
            }
            
            // --- VÝPOČET PRODLEV (3.5 - 8.8 min + Noc) ---
            const standardRandomDelay = Math.floor(Math.random() * (528000 - 210000 + 1)) + 210000;

            const now = new Date();
            let nightDelay = 0;
            if (now.getHours() >= 1 && now.getHours() < 7) {
                nightDelay = (Math.floor(Math.random() * (69 - 30 + 1)) + 30) * 60000; // Noční pauza 30-69 min
                console.log(`%c[Bot] Noční režim: Přidávám extra pauzu.`, "color: magenta;");
            }

            const totalDelay = WAIT_TIME + standardRandomDelay + nightDelay;
            const nextRunTime = new Date(Date.now() + totalDelay);

            console.log(`%c[Bot] Hotovo. Odesláno ${count} sběrů.`, "color: green; font-weight: bold;");
            console.log(`%c[Bot] Další cyklus započne v: ${getEuroTime(nextRunTime)}`, "color: cyan; font-weight: bold;");
            
            setTimeout(() => runScavengingCycle(false), totalDelay);

        } catch (err) {
            console.error("ASS Error", err);
        }
    }

    runScavengingCycle(true);
})();
