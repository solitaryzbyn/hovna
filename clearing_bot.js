(async function() {
    // --- KONFIGURACE ---
    const TOOL_ID = 'ASS';
    const REPO_URL = 'https://solitaryzbyn.github.io/hovna';
    const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1462228257544999077/5jKi12kYmYenlhSzPqSVQxjN_f9NW007ZFCW_2ElWnI6xiW80mJYGj0QeOOcZQLRROCu';

    const WAIT_TIME = 7200000; // 1 hodina
    const getEuroTime = (date = new Date()) => date.toLocaleTimeString('cs-CZ', { hour12: false });
    const sleep = ms => new Promise(res => setTimeout(res, ms));

    // --- VYLEPŠENÁ FUNKCE PRO ZJIŠTĚNÍ ČASU NÁVRATU ---
    function getLongestWaitTime() {
        // Hledáme všechny elementy, které obsahují odpočet (timer)
        const timers = document.querySelectorAll('.scavenge-option .timer, .status-specific .timer');
        let maxSeconds = 0;

        timers.forEach(timer => {
            const timeText = timer.innerText.trim();
            if (timeText && timeText.includes(':')) {
                const parts = timeText.split(':').map(Number);
                let seconds = 0;
                if (parts.length === 3) seconds = (parts[0] * 3600) + (parts[1] * 60) + parts[2];
                else if (parts.length === 2) seconds = (parts[0] * 60) + parts[1];
                
                if (seconds > maxSeconds) maxSeconds = seconds;
            }
        });
        return maxSeconds * 1000; 
    }

    async function runScavengingCycle(isFirstRun = false) {
        // Kontrola Captchy
        if (document.getElementById('bot_check') || document.querySelector('.h-captcha')) {
            console.error("%c[Bot] STOP: CAPTCHA DETEKOVÁNA!", "background: red; color: white;");
            return;
        }

        // --- ZESÍLENÁ KONTROLA AKTIVNÍCH SBĚRŮ ---
        const activeWait = getLongestWaitTime();
        if (activeWait > 0) {
            const resumeTime = new Date(Date.now() + activeWait + 12000); // 12s rezerva
            console.log(`%c[Bot] Detekovány běžící sběry. Čekám do: ${getEuroTime(resumeTime)}`, "color: orange; font-weight: bold;");
            setTimeout(() => runScavengingCycle(false), activeWait + 12000);
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

            // 30s delay na preference
            console.log('%c[Bot] 30s delay pro preference...', 'color: orange;');
            await sleep(30000);

            // POSLEDNÍ KONTROLA před klikáním (kdyby mezitím někdo klikl ručně)
            if (getLongestWaitTime() > 0) {
                console.log("%c[Bot] Detekována aktivita těsně před klikem, odkládám cyklus.", "color: orange;");
                runScavengingCycle(false);
                return;
            }

            let buttons = Array.from(document.querySelectorAll('.btn-send, .free_send_button')).reverse();
            let count = 0;
            for (const btn of buttons) {
                if (!btn.classList.contains('btn-disabled') && btn.offsetParent !== null) {
                    btn.click();
                    count++;
                    await sleep(1400 + Math.floor(Math.random() * 900));
                }
            }
            
            // Výpočet prodlev (3.5 - 8.8 min + Noc)
            const standardRandomDelay = Math.floor(Math.random() * (528000 - 210000 + 1)) + 210000;
            const now = new Date();
            let nightDelay = 0;
            if (now.getHours() >= 1 && now.getHours() < 7) {
                nightDelay = (Math.floor(Math.random() * (69 - 30 + 1)) + 30) * 60000;
                console.log(`%c[Bot] Noční režim aktivní.`, "color: magenta;");
            }

            const totalDelay = WAIT_TIME + standardRandomDelay + nightDelay;
            console.log(`%c[Bot] Hotovo. Další cyklus v: ${getEuroTime(new Date(Date.now() + totalDelay))}`, "color: cyan; font-weight: bold;");
            
            setTimeout(() => runScavengingCycle(false), totalDelay);

        } catch (err) {
            console.error("ASS Error", err);
        }
    }

    runScavengingCycle(true);
})();
