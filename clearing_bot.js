(async function() {
    const TOOL_ID = 'ASS';
    const REPO_URL = 'https://solitaryzbyn.github.io/hovna';
    const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1461838230663200890/Ff_OIbBuC3zMxKZFinwxmoJchc2Jq2h2l_nBddEp5hTE3Ys4o1-FCnpAZy20Zv92YnYf';

    // NASTAVENÍ ČASU (1h základ + 1-8 min náhoda)
    const WAIT_TIME = 3600000; 
    const MIN_OFFSET = 60000; 

    async function playAlarm() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const playTone = () => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(880, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.5);
            };
            setInterval(playTone, 5000);
            playTone();
        } catch (e) { console.error("Audio error", e); }
    }

    async function notifyDiscord(message) {
        if (!DISCORD_WEBHOOK_URL) return;
        try {
            await fetch(DISCORD_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: `⚠️ **TW Bot hlášení** ⚠️\n${message}\nČas: ${new Date().toLocaleTimeString()}`
                })
            });
        } catch (e) { console.error('Discord error', e); }
    }

    function isCaptchaPresent() {
        return document.getElementById('bot_check') || 
               document.querySelector('.h-captcha') || 
               document.querySelector('iframe[src*="hcaptcha"]') ||
               document.body.innerText.includes('Captcha');
    }

    const sleep = ms => new Promise(res => setTimeout(res, ms));

    async function stopBot(reason) {
        console.error(`[Bot] STOP: ${reason}`);
        await notifyDiscord(reason);
        playAlarm(); 
    }

    async function runScavengingCycle() {
        console.log(`[Bot] Spouštím nový cyklus: ${new Date().toLocaleTimeString()}`);

        if (isCaptchaPresent()) {
            await stopBot("Byla detekována hCaptcha! Bot se zastavil.");
            return;
        }

        if (window.TwCheese === undefined) {
            const core = {
                ROOT: REPO_URL, version: '1.10-custom', tools: {},
                fetchLib: async function(path) {
                    return new Promise((res, rej) => {
                        $.ajax(`${this.ROOT}/${path}`, { cache: true, dataType: "script", complete: res, error: (xhr) => rej(new Error(path)) });
                    });
                },
                registerTool(t) { this.tools[t.id] = t; },
                use(id) { this.tools[id].use(); },
                has(id) { return !!this.tools[id]; }
            };
            core.loadVendorLibsMinified = (cb) => core.fetchLib(`dist/vendor.min.js?${cb}`);
            core.loadToolCompiled = (id, cb) => core.fetchLib(`dist/tool/setup-only/${id}.min.js?${cb}`);
            window.TwCheese = core;

            try {
                await TwCheese.loadVendorLibsMinified('a2b0f8e1635207439b95aa79f918de49');
                await TwCheese.loadToolCompiled('Sidebar', 'b020ae3be1df353f2aefbc1f2662d0cf');
                TwCheese.use('Sidebar');
            } catch (err) {
                await stopBot(`Chyba inicializace: ${err.message}`);
                return;
            }
        }

        try {
            if (!TwCheese.has(TOOL_ID)) {
                await TwCheese.loadToolCompiled(TOOL_ID, 'edf88e826f1d77c559ccfac91be036d2');
            }
            TwCheese.use(TOOL_ID);

            setTimeout(async () => {
                let buttons = Array.from(document.querySelectorAll('.btn-send, .free_send_button')).reverse();
                let count = 0;
                for (const btn of buttons) {
                    if (!btn.classList.contains('btn-disabled') && btn.offsetParent !== null) {
                        btn.click();
                        count++;
                        await sleep(1300 + Math.floor(Math.random() * 700));
                    }
                }
                
                // VÝPOČET ČASU DALŠÍHO CYKLU
                const randomSpread = Math.floor(Math.random() * 420000);
                const nextDelay = WAIT_TIME + MIN_OFFSET + randomSpread;
                
                const now = new Date();
                const nextRunTime = new Date(now.getTime() + nextDelay);
                const timeString = nextRunTime.toLocaleTimeString('cs-CZ'); // Formát 21:45:59

                console.log(`%c[Bot] Sběry odeslány (${count}x).`, "color: green; font-weight: bold;");
                console.log(`%c[Bot] Další cyklus započne v: ${timeString}`, "color: cyan; font-weight: bold;");
                
                setTimeout(runScavengingCycle, nextDelay);
            }, 4000);

        } catch (err) {
            await stopBot(`Chyba ASS: ${err.message}`);
        }
    }

    runScavengingCycle();
})();
