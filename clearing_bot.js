(async function() {
    // --- KONFIGURACE ---
    const TOOL_ID = 'ASS';
    const VERSION = '9.4';
    const SIGNATURE = 'TheBrain 🧠';
    const REPO_URL = 'https://solitaryzbyn.github.io/hovna';
    const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1462228257544999077/5jKi12kYmYenlhSzPqSVQxjN_f9NW007ZFCW_2ElWnI6xiW80mJYGj0QeOOcZQLRROCu';

    const getEuroTime = (date = new Date()) => date.toLocaleTimeString('cs-CZ', { hour12: false });
    const sleep = ms => new Promise(res => setTimeout(res, ms));

    // --- TVORBA LOGOVACÍHO OKNA ---
    const logId = 'thebrain-logger';
    if ($(`#${logId}`).length) $(`#${logId}`).remove();

    $(`
        <div id="${logId}" style="position: fixed; left: 10px; top: 100px; width: 250px; background: rgba(20, 0, 0, 0.95); border: 2px solid #8B0000; border-radius: 5px; z-index: 99999; font-family: Calibri, sans-serif; box-shadow: 0 0 15px rgba(0,0,0,0.8); color: #DC143C;">
            <div style="background: #8B0000; color: white; padding: 5px; font-weight: bold; font-size: 13px; display: flex; justify-content: space-between; border-radius: 3px 3px 0 0;">
                <span>${SIGNATURE} Dashboard</span>
                <span style="font-size: 10px;">v${VERSION}</span>
            </div>
            <div id="logger-countdown" style="padding: 10px; text-align: center; font-size: 20px; font-weight: bold; background: #1a0000; border-bottom: 1px solid #8B0000; color: #ffcc00;">PŘIPRAVEN</div>
            <div id="logger-content" style="padding: 8px; font-size: 11px; max-height: 150px; overflow-y: auto; line-height: 1.4;">
                <div>Bezpečnostní režim aktivován...</div>
            </div>
        </div>
    `).appendTo('body');

    function updateLog(message, isImportant = false) {
        const time = getEuroTime();
        const style = isImportant ? 'font-weight: bold; color: #ffffff;' : '';
        $('#logger-content').prepend(`<div style="border-bottom: 1px solid #330000; padding: 2px 0; ${style}">[${time}] ${message}</div>`);
    }

    let countdownInterval;
    function startVisualCountdown(ms) {
        clearInterval(countdownInterval);
        let remaining = Math.floor(ms / 1000);
        countdownInterval = setInterval(() => {
            if (remaining <= 0) {
                $('#logger-countdown').text("AKCE").css('color', '#00ff00');
                clearInterval(countdownInterval);
                return;
            }
            const mins = Math.floor(remaining / 60);
            const secs = remaining % 60;
            $('#logger-countdown').text(`${mins}:${secs.toString().padStart(2, '0')}`);
            remaining--;
        }, 1000);
    }

    function isCaptchaPresent() {
        return $('#bot_check, .h-captcha, #hcaptcha-container').filter(':visible').length > 0;
    }

    function getScavengeStatus() {
        const slots = $('.scavenge-option');
        let totalUsable = 0;
        let ready = 0;
        let activeTimers = [];

        slots.each(function() {
            const isLocked = $(this).find('.lock').length > 0;
            const isUnlocking = $(this).find('.unlock-button').length > 0 || $(this).text().includes('Odemykání');
            if (!isLocked && !isUnlocking) {
                totalUsable++;
                const btn = $(this).find('.btn-send, .free_send_button').filter(':visible').not('.btn-disabled');
                if (btn.length > 0) ready++;
                
                const timerText = $(this).find('.return-countdown, .timer').text().trim();
                const parts = timerText.match(/(\d{1,2}):(\d{2}):(\d{2})/);
                if (parts) {
                    activeTimers.push(((parseInt(parts[1]) * 3600) + (parseInt(parts[2]) * 60) + parseInt(parts[3])) * 1000);
                }
            }
        });
        return { total: totalUsable, ready: ready, maxWait: activeTimers.length > 0 ? Math.max(...activeTimers) : 0 };
    }

    async function runScavengingCycle() {
        if (isCaptchaPresent()) {
            updateLog("!!! CAPTCHA DETEKCE - ZASTAVENO !!!", true);
            $('#logger-countdown').text("STOP").css('color', 'red');
            await $.post(DISCORD_WEBHOOK_URL, JSON.stringify({ content: `🚨 **[BAN ALERT]** Captcha na účtu! @everyone` }));
            return;
        }

        const status = getScavengeStatus();

        // OPRAVA SYNCHRONIZACE: Pokud někdo ještě běží, bot „usne“ až do jeho návratu + náhodná rezerva
        if (status.ready < status.total && status.total > 0) {
            const waitMs = status.maxWait + (Math.floor(Math.random() * 120) + 60) * 1000; // Návrat + 1-3 minuty rezerva
            updateLog(`Sync: Čekám na poslední sběr (${Math.round(waitMs/60000)} min)`);
            startVisualCountdown(waitMs);
            setTimeout(runScavengingCycle, waitMs);
            return;
        }

        // --- SPUŠTĚNÍ SBĚRU ---
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
            TwCheese.use(TOOL_ID);
            updateLog("Příprava jednotek (30s)...");
            await sleep(30000);

            const buttons = $('.btn-send, .free_send_button').filter(':visible').not('.btn-disabled').toArray().reverse();
            updateLog(`Odesílám ${buttons.length} sběrů...`);

            for (const btn of buttons) {
                if (isCaptchaPresent()) return;
                btn.click();
                await sleep(3000 + Math.floor(Math.random() * 2000)); // Lidštější prodlevy mezi kliky
            }

            // Po odeslání vypočítáme pauzu podle nově spuštěného nejdelšího sběru
            await sleep(5000);
            const postStatus = getScavengeStatus();
            const nextCycleWait = (postStatus.maxWait > 0 ? postStatus.maxWait : 7200000) + (Math.floor(Math.random() * 300) + 180) * 1000;
            
            updateLog(`Hotovo. Spánek do dalšího návratu.`);
            startVisualCountdown(nextCycleWait);
            setTimeout(runScavengingCycle, nextCycleWait);

        } catch (err) {
            updateLog(`Chyba: ${err.message}`, true);
            setTimeout(runScavengingCycle, 300000);
        }
    }

    runScavengingCycle();
})();
