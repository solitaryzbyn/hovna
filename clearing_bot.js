(async function() {
    // --- KONFIGURACE ---
    const TOOL_ID = 'ASS';
    const VERSION = '9.5';
    const SIGNATURE = 'TheBrain 🧠';
    const REPO_URL = 'https://solitaryzbyn.github.io/hovna';
    const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1462228257544999077/5jKi12kYmYenlhSzPqSVQxjN_f9NW007ZFCW_2ElWnI6xiW80mJYGj0QeOOcZQLRROCu';

    const getEuroTime = (date = new Date()) => date.toLocaleTimeString('cs-CZ', { hour12: false });
    const sleep = ms => new Promise(res => setTimeout(res, ms));

    // --- DASHBOARD UI ---
    const logId = 'thebrain-logger';
    if ($(`#${logId}`).length) $(`#${logId}`).remove();
    const $logger = $(`
        <div id="${logId}" style="position: fixed; left: 10px; top: 100px; width: 250px; background: rgba(15, 0, 0, 0.95); border: 2px solid #8B0000; border-radius: 5px; z-index: 99999; font-family: Calibri, sans-serif; box-shadow: 0 0 15px black; color: #DC143C;">
            <div style="background: #8B0000; color: white; padding: 5px; font-weight: bold; font-size: 13px; display: flex; justify-content: space-between; border-radius: 3px 3px 0 0;">
                <span>${SIGNATURE} Ghost Dashboard</span>
                <span style="font-size: 10px;">v${VERSION}</span>
            </div>
            <div id="logger-status" style="padding: 10px; text-align: center; font-size: 18px; font-weight: bold; background: #1a0000; border-bottom: 1px solid #8B0000; color: #ffcc00;">INICIALIZACE</div>
            <div id="logger-content" style="padding: 8px; font-size: 11px; max-height: 120px; overflow-y: auto; line-height: 1.3;"></div>
        </div>
    `).appendTo('body');

    function updateLog(message, isImportant = false) {
        const style = isImportant ? 'font-weight: bold; color: #ffffff;' : '';
        $('#logger-content').prepend(`<div style="border-bottom: 1px solid #330000; padding: 2px 0; ${style}">[${getEuroTime()}] ${message}</div>`);
    }

    // --- STEALTH POMOCNÉ FUNKCE ---
    function getRemainingTimeMs() {
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

    async function checkRefillReady() {
        for (let i = 0; i < 15; i++) { // Zkusíme 15x počkat (celkem až 7.5s)
            let currentPop = 0;
            $('.unitsInput').each(function() { currentPop += (parseInt($(this).val()) || 0); });
            if (currentPop >= 10) return true;
            await sleep(500);
        }
        return false;
    }

    async function runScavengingCycle() {
        // Kontrola Captchy
        if ($('#bot_check, .h-captcha, #hcaptcha-container').filter(':visible').length > 0) {
            updateLog("!!! CAPTCHA DETEKCE - ZASTAVENO !!!", true);
            $('#logger-status').text("STOP").css('color', 'red');
            await $.post(DISCORD_WEBHOOK_URL, JSON.stringify({ content: `🚨 **[ALERT]** Captcha na účtu! @everyone` }));
            return;
        }

        // 1. ANALÝZA STAVU (Silent Check)
        const buttons = $('.btn-send, .free_send_button').filter(':visible').not('.btn-disabled');
        const remainingMs = getRemainingTimeMs();

        // 2. LOGIKA TICHÉHO SPÁNKU
        if (buttons.length === 0 && remainingMs > 0) {
            const extraBuffer = (Math.floor(Math.random() * 150) + 45) * 1000; // 45-150s lidská rezerva
            const totalSleep = remainingMs + extraBuffer;
            updateLog(`Tichý spánek: ${Math.round(totalSleep/60000)} min`);
            $('#logger-status').text("SPÁNEK").css('color', '#666');
            setTimeout(runScavengingCycle, totalSleep);
            return;
        }

        // 3. PŘÍPRAVA AKCE
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
            await sleep(2000);
            $('#logger-status').text("PŘÍPRAVA").css('color', '#ffcc00');
            TwCheese.use(TOOL_ID);
            
            updateLog("Čekám na výpočet jednotek (30s)...");
            await sleep(30000);

            // Verifikace re-fillu před odesláním
            const isReady = await checkRefillReady();
            if (!isReady) {
                updateLog("Chyba: ASS nevyplnil jednotky včas. Restart za 5 min.");
                setTimeout(runScavengingCycle, 300000);
                return;
            }

            // 4. ODESÍLÁNÍ (Human-like timing)
            const sendButtons = $('.btn-send, .free_send_button').filter(':visible').not('.btn-disabled').toArray().reverse();
            updateLog(`Odesílám ${sendButtons.length} sběrů (Zprava Doleva)...`);
            $('#logger-status').text("AKCE").css('color', '#00ff00');

            for (const btn of sendButtons) {
                btn.click();
                // Velmi variabilní pauza mezi kliky
                await sleep(3200 + Math.floor(Math.random() * 2500)); 
            }

            updateLog("Cyklus hotov. Výpočet spánku...");
            await sleep(5000); // Krátká pauza na protažení DOMu
            runScavengingCycle(); // Rekurzivní skok do spánku

        } catch (err) {
            updateLog(`Chyba: ${err.message}`, true);
            setTimeout(runScavengingCycle, 300000);
        }
    }

    runScavengingCycle();
})();
