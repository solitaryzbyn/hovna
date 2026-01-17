(async function() {
    const TOOL_ID = 'ASS';
    const REPO_URL = 'https://solitaryzbyn.github.io/hovna';
    const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1461838230663200890/Ff_OIbBuC3zMxKZFinwxmoJchc2Jq2h2l_nBddEp5hTE3Ys4o1-FCnpAZy20Zv92YnYf'; // <-- SEM VLOŽ URL

    const WAIT_TIME = 7200000; // 2 hodiny
    const RANDOM_VARIATION = Math.floor(Math.random() * 300000); 

    // Funkce pro odeslání zprávy na Discord
    async function notifyDiscord(message) {
        if (!DISCORD_WEBHOOK_URL || DISCORD_WEBHOOK_URL.includes('ZDE_VLOZ')) return;
        
        try {
            await fetch(DISCORD_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: `⚠️ **TW Bot hlášení** ⚠️\n${message}\nČas: ${new Date().toLocaleTimeString()}`
                })
            });
        } catch (e) {
            console.error('Nepodařilo se odeslat zprávu na Discord', e);
        }
    }

    // Funkce pro kontrolu Captchy
    function isCaptchaPresent() {
        return document.getElementById('bot_check') || 
               document.querySelector('.h-captcha') || 
               document.querySelector('iframe[src*="hcaptcha"]') ||
               document.body.innerText.includes('Captcha');
    }

    async function runScavenging() {
        console.log('[Bot] Kontrola Captchy...');

        // 1. KONTROLA CAPTCHY
        if (isCaptchaPresent()) {
            console.error('[Bot] ZJIŠTĚNA CAPTCHA! Zastavuji vše.');
            await notifyDiscord("Byla detekována hCaptcha! Bot se zastavil a čeká na tvůj zásah.");
            return; // Ukončí funkci, čímž se nespustí setTimeout pro další refresh
        }

        // 2. INICIALIZACE TW CHEESE (pokud neexistuje)
        if (window.TwCheese === undefined) {
            const core = {
                ROOT: REPO_URL,
                version: '1.10-1-rev-custom',
                tools: {},
                fetchLib: async function(path) {
                    return new Promise((res, rej) => {
                        $.ajax(`${this.ROOT}/${path}`, {
                            cache: true,
                            dataType: "script",
                            complete: res,
                            error: (xhr) => rej(new Error(`Chyba načítání: ${path}`))
                        });
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
                await notifyDiscord(`Chyba při inicializaci skriptu: ${err.message}`);
                return;
            }
        }

        // 3. SPUŠTĚNÍ SBĚRU
        try {
            if (!TwCheese.has(TOOL_ID)) {
                await TwCheese.loadToolCompiled(TOOL_ID, 'edf88e826f1d77c559ccfac91be036d2');
            }
            TwCheese.use(TOOL_ID);
            console.log('[Bot] Sběr úspěšně spuštěn.');
        } catch (err) {
            await notifyDiscord(`Chyba při spouštění nástroje ASS: ${err.message}`);
            return;
        }

        // 4. PLANOVÁNÍ DALŠÍHO KOLA
        const nextRun = WAIT_TIME + RANDOM_VARIATION;
        console.log(`[Bot] Další refresh za ${Math.round(nextRun / 60000)} minut.`);
        
        setTimeout(() => {
            // Kontrola Captchy těsně před refreshem pro jistotu
            if (!isCaptchaPresent()) {
                location.reload();
            } else {
                notifyDiscord("Captcha se objevila před refreshem. Zastavuji.");
            }
        }, nextRun);
    }

    runScavenging();
})();
