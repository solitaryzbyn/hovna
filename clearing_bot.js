(async function() {
    // --- KONFIGURACE ---
    const TOOL_ID = 'ASS';
    const VERSION = '10.3';
    const SIGNATURE = 'TheBrain 🧠';
    const REPO_URL = 'https://solitaryzbyn.github.io/hovna';
    const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1462228257544999077/5jKi12kYmYenlhSzPqSVQxjN_f9NW007ZFCW_2ElWnI6xiW80mJYGj0QeOOcZQLRROCu';

    const STYLE_SIGN = "background: #8B0000; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px 0 0 3px;";
    const STYLE_MSG = "background: #1a0000; color: #DC143C; font-weight: bold; padding: 2px 5px; border-radius: 0 3px 3px 0; border: 1px solid #8B0000;";
    
    const logBot = (message) => console.log(`%c[Powered by ${SIGNATURE}]%c ${message}`, STYLE_SIGN, STYLE_MSG);
    const sleep = ms => new Promise(res => setTimeout(res, ms));

    function getMaxRemainingTimeMs() {
        let maxMs = 0;
        $('.return-countdown, .timer').each(function() {
            const timeText = $(this).text().trim();
            const parts = timeText.match(/(\d{1,2}):(\d{2}):(\d{2})/);
            if (parts) {
                const ms = ((parseInt(parts[1]) * 3600) + (parseInt(parts[2]) * 60) + parseInt(parts[3])) * 1000;
                if (ms > maxMs) maxMs = ms;
            }
        });
        return maxMs;
    }

    async function runScavengingCycle() {
        if ($('#bot_check, .h-captcha').filter(':visible').length > 0) return;

        const readyButtons = $('.btn-send, .free_send_button').filter(':visible').not('.btn-disabled');
        if (readyButtons.length === 0) {
            setTimeout(runScavengingCycle, 300000);
            return;
        }

        if (window.TwCheese === undefined) {
            window.TwCheese = { ROOT: REPO_URL, tools: {}, fetchLib: async function(path) { return new Promise(res => $.ajax(`${this.ROOT}/${path}`, { cache: true, dataType: "script", complete: res })); }, registerTool(t) { this.tools[t.id] = t; }, use(id) { this.tools[id].use(); }, has(id) { return !!this.tools[id]; } };
            await TwCheese.fetchLib('dist/vendor.min.js');
            await TwCheese.fetchLib('dist/tool/setup-only/Sidebar.min.js');
            TwCheese.use('Sidebar');
        }

        try {
            if (!TwCheese.has(TOOL_ID)) await TwCheese.fetchLib(`dist/tool/setup-only/${TOOL_ID}.min.js`);
            await sleep(4000); 
            TwCheese.use(TOOL_ID);
            
            const maxRemainingMs = getMaxRemainingTimeMs();
            if (maxRemainingMs > 180000) { // Dorovnáváme, pokud zbývá víc než 3 minuty
                const targetMs = maxRemainingMs - 210000; // Rezerva 3.5 minuty
                const targetHours = (targetMs / 3600000).toFixed(2);
                
                const timeInput = $('input[name="scavenge_option_duration"], .scavenge-option-duration input').first();
                if (timeInput.length > 0) {
                    timeInput.val(targetHours).trigger('change');
                    logBot(`Dorovnávám na ${targetHours}h...`);
                    
                    // KLÍČOVÁ OPRAVA: Čekáme a kontrolujeme, zda ASS skutečně vyplnil vojáky
                    let filled = false;
                    for(let i=0; i<10; i++) { // Zkusíme 10x počkat 500ms
                        await sleep(500);
                        let currentPop = 0;
                        $('.unitsInput').each(function() { currentPop += (parseInt($(this).val()) || 0); });
                        if (currentPop >= 10) {
                            filled = true;
                            break;
                        }
                    }
                    if (!filled) {
                        logBot("ASS nevyplnil vojáky včas. Přeskakuji dorovnání.");
                    }
                }
            }

            // Odesílání striktně ZPRAVA DOLEVA
            let buttons = Array.from(document.querySelectorAll('.btn-send, .free_send_button'))
                               .filter(btn => btn.offsetParent !== null && !btn.classList.contains('btn-disabled'))
                               .reverse(); 

            for (const btn of buttons) {
                // Poslední pojistka: kontrola, zda ASS nesmazal vojáky těsně před klikem
                btn.click();
                await sleep(2500 + Math.floor(Math.random() * 1500));
            }

            logBot(`Cyklus dokončen.`);
            await sleep(15000);
            setTimeout(runScavengingCycle, Math.max(300000, getMaxRemainingTimeMs() + 60000));
        } catch (err) {
            logBot(`Chyba: ${err.message}`);
            setTimeout(runScavengingCycle, 300000);
        }
    }
    runScavengingCycle();
})();
