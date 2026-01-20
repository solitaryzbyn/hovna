(async function() {
    const TOOL_ID = 'ASS';
    const REPO_URL = 'https://solitaryzbyn.github.io/hovna';
    const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1462228257544999077/5jKi12kYmYenlhSzPqSVQxjN_f9NW007ZFCW_2ElWnI6xiW80mJYGj0QeOOcZQLRROCu';

    const getEuroTime = (date = new Date()) => date.toLocaleTimeString('cs-CZ', { hour12: false });
    const sleep = ms => new Promise(res => setTimeout(res, ms));

    async function sendDiscordAlert(message) {
        try {
            await $.post(DISCORD_WEBHOOK_URL, JSON.stringify({ content: `⚠️ **[Bot Sběr]** ${message} @everyone` }), null, 'json');
        } catch (e) { console.error("Discord error"); }
    }

    function getScavengeStatus() {
        const allSlots = $('.scavenge-option');
        let usableCount = 0;
        let readyToClick = 0;

        allSlots.each(function() {
            const isLocked = $(this).find('.lock').length > 0;
            const isUnlocking = $(this).find('.unlock-button').length > 0 || 
                               ($(this).find('.timer').length > 0 && $(this).find('.btn-send').length === 0 && $(this).find('.status-specific').text().includes('Odemykání'));
            
            const hasSendButton = $(this).find('.btn-send, .free_send_button').length > 0;
            const isScavenging = $(this).find('.status-specific').text().includes('Sběr') || $(this).find('.timer').length > 0;

            if (!isLocked && !isUnlocking && (hasSendButton || isScavenging)) {
                usableCount++; 
                const btn = $(this).find('.btn-send, .free_send_button').filter(':visible').not('.btn-disabled');
                if (btn.length > 0) readyToClick++;
            }
        });
        return { total: usableCount, ready: readyToClick };
    }

    // --- FUNKCE PRO ČTENÍ ČASU Z ASS ---
    function getASSTimePreference() {
        // Hledáme políčko pro délku trvání v rozhraní ASS
        const timeInput = $('input[name="scavenge_option_duration"], .scavenge-option-duration input').first();
        if (timeInput.length > 0) {
            const hours = parseFloat(timeInput.val());
            if (!isNaN(hours) && hours > 0) {
                console.log(`%c[Bot] Úspěšně načten čas z ASS: ${hours}h`, "color: #bada55; font-weight: bold;");
                return hours * 3600000; 
            }
        }
        console.log("%c[Bot] Nepodařilo se načíst čas z ASS, používám výchozí 2h.", "color: #ff8000;");
        return 7200000; 
    }

    async function runScavengingCycle() {
        if (document.getElementById('bot_check') || document.querySelector('.h-captcha')) {
            await sendDiscordAlert("Byla detekována CAPTCHA!");
            return;
        }

        const status = getScavengeStatus();
        if (status.total > 0 && status.ready < status.total) {
            console.log(`%c[Bot] SYNCHRONIZACE: Čekám na uvolnění všech ${status.total} slotů...`, "color: orange;");
            setTimeout(runScavengingCycle, 300000);
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

            // --- KLÍČOVÝ BOD: Čekáme 30s na aplikaci tvých preferencí ---
            console.log('%c[Bot] 30s pauza pro načtení tvého nastavení v ASS...', 'color: orange;');
            await sleep(30000);

            // TEPRVE TEĎ čteme nastavený čas z políčka
            const dynamicWaitTime = getASSTimePreference();

            let buttons = Array.from(document.querySelectorAll('.btn-send, .free_send_button'))
                               .filter(btn => btn.offsetParent !== null && !btn.classList.contains('btn-disabled'))
                               .reverse();

            let count = 0;
            for (const btn of buttons) {
                btn.click();
                count++;
                await sleep(1800 + Math.floor(Math.random() * 1000));
            }
            
            // Lidské prodlevy (3.5 - 8.8 min)
            const randomSpread = Math.floor(Math.random() * (528000 - 210000 + 1)) + 210000;
            const now = new Date();
            let nightDelay = 0;
            if (now.getHours() >= 1 && now.getHours() < 7) {
                nightDelay = (Math.floor(Math.random() * (69 - 30 + 1)) + 30) * 60000;
            }

            const totalDelay = dynamicWaitTime + randomSpread + nightDelay;
            console.log(`%c[Bot] Hotovo. Další cyklus za cca ${Math.round(totalDelay/60000)} min v: ${getEuroTime(new Date(Date.now() + totalDelay))}`, "color: cyan; font-weight: bold;");
            
            setTimeout(runScavengingCycle, totalDelay);
        } catch (err) {
            console.error("[Bot] Chyba:", err.message);
            setTimeout(runScavengingCycle, 300000);
        }
    }

    runScavengingCycle();
})();
