(async function() {
    // --- KONFIGURACE ---
    const TOOL_ID = 'ASS';
    const REPO_URL = 'https://solitaryzbyn.github.io/hovna';
    const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1462228257544999077/5jKi12kYmYenlhSzPqSVQxjN_f9NW007ZFCW_2ElWnI6xiW80mJYGj0QeOOcZQLRROCu';

    const WAIT_TIME = 7200000; // Nastaveno na 2 hodiny (v ms)
    const getEuroTime = (date = new Date()) => date.toLocaleTimeString('cs-CZ', { hour12: false });
    const sleep = ms => new Promise(res => setTimeout(res, ms));

    // --- AGRESIVNÍ DETEKCE BĚŽÍCÍCH SBĚRŮ ---
    function getLongestWaitTime() {
        const timers = document.querySelectorAll('.scavenge-option .timer, .status-specific .timer, .timer[data-endtime]');
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

        // Kontrola aktivních sběrů (přidána větší rezerva 20s pro stabilitu)
        const activeWait = getLongestWaitTime();
        if (activeWait > 0) {
            const resumeTime = new Date(Date.now() + activeWait + 20000);
            console.log(`%c[Bot] Sběrači jsou stále venku. Čekám do: ${getEuroTime(resumeTime)}`, "color: orange; font-weight: bold;");
            setTimeout(() => runScavengingCycle(false), activeWait + 20000);
            return;
        }

        console.log(`%c[Bot] Cyklus spuštěn (2h režim): ${getEuroTime()}`, "color: yellow; font-weight: bold;");

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

            console.log('%c[Bot] 30s delay pro stabilitu ASS...', 'color: orange;');
            await sleep(30000);

            // ZPRAVA DOLEVA + Kontrola existence tlačítek
            let buttons = Array.from(document.querySelectorAll('.btn-send, .free_send_button'))
                               .filter(btn => btn.offsetParent !== null && !btn.classList.contains('btn-disabled'))
                               .reverse();

            if (buttons.length === 0) {
                console.log("%c[Bot] Žádná volná tlačítka nenalezena, zkusím to za 5 minut.", "color: orange;");
                setTimeout(() => runScavengingCycle(false), 300000);
                return;
            }

            let count = 0;
            for (const btn of buttons) {
                // Poslední pojistka před klikem
                if (btn.offsetParent !== null && !btn.classList.contains('btn-disabled')) {
                    btn.click();
                    count++;
                    await sleep(1500 + Math.floor(Math.random() * 1000));
                }
            }
            
            // Náhodný posun 3.5 - 8.8 min
            const standardRandomDelay = Math.floor(Math.random() * (528000 - 210000 + 1)) + 210000;
            
            // Noční pauza 1:00 - 7:00 (30-69 min)
            const now = new Date();
            let nightDelay = 0;
            if (now.getHours() >= 1 && now.getHours() < 7) {
                nightDelay = (Math.floor(Math.random() * (69 - 30 + 1)) + 30) * 60000;
                console.log(`%c[Bot] Noční režim: Extra pauza přidána.`, "color: magenta;");
            }

            const totalDelay = WAIT_TIME + standardRandomDelay + nightDelay;
            console.log(`%c[Bot] Odesláno ${count} sběrů. Další v: ${getEuroTime(new Date(Date.now() + totalDelay))}`, "color: cyan; font-weight: bold;");
            
            setTimeout(() => runScavengingCycle(false), totalDelay);

        } catch (err) {
            console.error("Kritická chyba, restartuji cyklus za minutu...", err);
            setTimeout(() => runScavengingCycle(false), 60000);
        }
    }

    runScavengingCycle(true);
})();
