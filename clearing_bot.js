(async function() {
    const TOOL_ID = 'ASS';
    const REPO_URL = 'https://solitaryzbyn.github.io/hovna';
    const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1462228257544999077/5jKi12kYmYenlhSzPqSVQxjN_f9NW007ZFCW_2ElWnI6xiW80mJYGj0QeOOcZQLRROCu';

    const WAIT_TIME = 7200000; // Základ 1 hodina

    async function playAlarm() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const playTone = () => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain); gain.connect(audioCtx.destination);
                osc.type = 'sawtooth'; osc.frequency.setValueAtTime(880, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
                osc.start(); osc.stop(audioCtx.currentTime + 0.5);
            };
            setInterval(playTone, 5000); playTone();
        } catch (e) { console.error("Audio error", e); }
    }

    async function notifyDiscord(message) {
        if (!DISCORD_WEBHOOK_URL) return;
        try {
            await fetch(DISCORD_WEBHOOK_URL, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: `⚠️ **TW Bot hlášení** ⚠️\n${message}\nČas: ${new Date().toLocaleTimeString()}` })
            });
        } catch (e) { console.error('Discord error', e); }
    }

    function isCaptchaPresent() {
        const captchaElements = [
            document.getElementById('bot_check'),
            document.querySelector('.h-captcha'),
            document.querySelector('#bot_check_image'),
            document.querySelector('iframe[src*="captcha"]')
        ];
        const hasElement = captchaElements.some(el => el !== null);
        const hasText = document.body.innerText.includes('Zadejte kód z obrázku') || 
                        document.body.innerText.includes('Captcha') || 
                        document.body.innerText.includes('vstoupit kód');
        return hasElement || hasText;
    }

    const sleep = ms => new Promise(res => setTimeout(res, ms));

    async function runScavengingCycle() {
        if (isCaptchaPresent()) {
            console.error("%c[Bot] CAPTCHA DETEKOVÁNA!", "background: red; color: white;");
            await notifyDiscord("!!! POZOR !!! Byla detekována CAPTCHA! Bot se vypnul.");
            playAlarm();
            return;
        }

        console.log(`%c[Bot] Cyklus spuštěn: ${new Date().toLocaleTimeString()}`, "color: yellow; font-weight: bold;");

        if (window.TwCheese === undefined) {
            window.TwCheese = {
                ROOT: REPO_URL, tools: {},
                fetchLib: async function(path) {
                    return new Promise((res) => $.ajax(`${this.ROOT}/${path}`, { cache: true, dataType: "script", complete: res }));
                },
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
            await sleep(30000); 

            let buttons = Array.from(document.querySelectorAll('.btn-send, .free_send_button')).reverse();
            let count = 0;
            for (const btn of buttons) {
                if (!btn.classList.contains('btn-disabled') && btn.offsetParent !== null) {
                    btn.click();
                    count++;
                    await sleep(1300 + Math.floor(Math.random() * 800));
                }
            }
            
            // --- VYLEPŠENÝ VÝPOČET PRODLEV ---
            
            // 1. Upravená náhoda: 3.5 min (210000 ms) až 8.8 min (528000 ms)
            const minMs = 210000;
            const maxMs = 528000;
            const standardRandomDelay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;

            // 2. Noční náhoda: 30 až 69 minut (1:00 - 7:00)
            const now = new Date();
            const hour = now.getHours();
            let nightDelay = 0;

            if (hour >= 1 && hour < 7) {
                const extraNightMinutes = Math.floor(Math.random() * (69 - 30 + 1)) + 30;
                nightDelay = extraNightMinutes * 60000;
                console.log(`%c[Bot] Noční režim: Extra ${extraNightMinutes} min pauzy.`, "color: magenta;");
            }

            const totalDelay = WAIT_TIME + standardRandomDelay + nightDelay;
            const nextRunTime = new Date(Date.now() + totalDelay);

            console.log(`%c[Bot] Sběry odeslány. Náhodný posun: ${(standardRandomDelay/60000).toFixed(2)} min.`, "color: green;");
            console.log(`%c[Bot] Další cyklus započne v: ${nextRunTime.toLocaleTimeString('cs-CZ')}`, "color: cyan; font-weight: bold;");
            
            setTimeout(runScavengingCycle, totalDelay);

        } catch (err) {
            console.error("ASS Error", err);
            await notifyDiscord(`Chyba: ${err.message}`);
        }
    }

    runScavengingCycle();
})();
