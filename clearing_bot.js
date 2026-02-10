(async function() {
    // --- KONFIGURACE ---
    const TOOL_ID = 'ASS';
    const VERSION = '10.2';
    const SIGNATURE = 'TheBrain 🧠';
    const REPO_URL = 'https://solitaryzbyn.github.io/hovna';
    const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1462228257544999077/5jKi12kYmYenlhSzPqSVQxjN_f9NW007ZFCW_2ElWnI6xiW80mJYGj0QeOOcZQLRROCu';

    const STYLE_SIGN = "background: #8B0000; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px 0 0 3px;";
    const STYLE_MSG = "background: #1a0000; color: #DC143C; font-weight: bold; padding: 2px 5px; border-radius: 0 3px 3px 0; border: 1px solid #8B0000;";
    const getEuroTime = (date = new Date()) => date.toLocaleTimeString('cs-CZ', { hour12: false });
    const sleep = ms => new Promise(res => setTimeout(res, ms));

    function logBot(message) {
        console.log(`%c[Powered by ${SIGNATURE}]%c ${message}`, STYLE_SIGN, STYLE_MSG);
    }

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

        const allSlots = $('.scavenge-option');
        let readyToClick = allSlots.find('.btn-send, .free_send_button').filter(':visible').not('.btn-disabled');

        if (readyToClick.length === 0) {
            const syncWait = Math.floor(Math.random() * (480000 - 300000 + 1)) + 300000;
            logBot(`Vše běží. Kontrola za ${Math.round(syncWait/60000)} min...`);
            setTimeout(runScavengingCycle, syncWait);
            return;
        }

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
            
            // --- DOROVNÁNÍ ČASU ---
            const maxRemainingMs = getMaxRemainingTimeMs();
            if (maxRemainingMs > 120000) {
                const targetMs = Math.max(600000, maxRemainingMs - 210000); // 3.5 min rezerva
                const targetHours = (targetMs / 3600000).toFixed(2);
                
                const timeInput = $('input[name="scavenge_option_duration"], .scavenge-option-duration input').first();
                if (timeInput.length > 0) {
                    timeInput.val(targetHours).trigger('change');
                    logBot(`Dorovnávám čas: ${targetHours}h`);
                    await sleep(3500); // Čas pro ASS na re-fill vojáků
                }
            }

            // --- VÝBĚR TLAČÍTEK ZPRAVA DOLEVA ---
            // .reverse() zajistí, že začneme u Velkých sběračů
            let buttons = Array.from(document.querySelectorAll('.btn-send, .free_send_button'))
                               .filter(btn => btn.offsetParent !== null && !btn.classList.contains('btn-disabled'))
                               .reverse(); 

            logBot(`Odesílám ${buttons.length} sběrů (směr: zprava doleva)...`);

            for (const btn of buttons) {
                btn.click();
                await sleep(2500 + Math.floor(Math.random() * 1500));
            }

            const fatigueWait = Math.floor(Math.random() * (15000 - 10000 + 1)) + 10000;
            logBot(`Hotovo. Únava ${fatigueWait/1000}s...`);
            await sleep(fatigueWait);

            const nextCheck = getMaxRemainingTimeMs() + 60000;
            setTimeout(runScavengingCycle, Math.max(300000, nextCheck));
        } catch (err) {
            logBot(`Chyba: ${err.message}`);
            setTimeout(runScavengingCycle, 300000);
        }
    }

    runScavengingCycle();
})();
