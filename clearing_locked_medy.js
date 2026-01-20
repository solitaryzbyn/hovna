(async function() {
    // --- KONFIGURACE A ZÁMEK ---
    const REQUIRED_PLAYER = 'kubasob';
    
    const TOOL_ID = 'ASS';
    const REPO_URL = 'https://solitaryzbyn.github.io/hovna';
    const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1462228257544999077/5jKi12kYmYenlhSzPqSVQxjN_f9NW007ZFCW_2ElWnI6xiW80mJYGj0QeOOcZQLRROCu';

    const WAIT_TIME = 7200000; // 2 hodiny
    const getEuroTime = (date = new Date()) => date.toLocaleTimeString('cs-CZ', { hour12: false });
    const sleep = ms => new Promise(res => setTimeout(res, ms));

    // --- FUNKCE PRO DISCORD ALERT ---
    async function sendDiscordAlert(message) {
        try {
            await $.post(DISCORD_WEBHOOK_URL, JSON.stringify({ content: `⚠️ **[Bot Sběr - ${REQUIRED_PLAYER}]** ${message} @everyone` }), null, 'json');
        } catch (e) { console.error("Discord error"); }
    }

    // --- DETEKCE ODEMČENÝCH SLOTŮ ---
    function getScavengeStatus() {
        const allSlots = $('.scavenge-option');
        let unlockedCount = 0;
        let readyToClick = 0;

        allSlots.each(function() {
            const isLocked = $(this).find('.lock').length > 0;
            const isUnlocking = $(this).find('.unlock-button').length > 0 || $(this).text().includes('Odemykání');

            if (!isLocked && !isUnlocking) {
                unlockedCount++; 
                const btn = $(this).find('.btn-send, .free_send_button').filter(':visible').not('.btn-disabled');
                if (btn.length > 0) readyToClick++;
            }
        });
        return { total: unlockedCount, ready: readyToClick };
    }

    async function runScavengingCycle() {
        // 1. KONTROLA ZÁMKU (Pouze Jméno)
        if (window.game_data.player.name !== REQUIRED_PLAYER) {
            const errorMsg = `Kritická chyba: Bot spuštěn na špatném účtu (${window.game_data.player.name})! Zastavuji...`;
            console.error(errorMsg);
            await sendDiscordAlert(errorMsg);
            return;
        }

        // 2. KONTROLA CAPTCHY
        if (document.getElementById('bot_check') || document.querySelector('.h-captcha')) {
            await sendDiscordAlert("Byla detekována CAPTCHA! Vyžaduje tvou pozornost.");
            return;
        }

        // 3. SYNCHRONIZACE ODEMČENÝCH SLOTŮ
        const status = getScavengeStatus();
        if (status.ready < status.total) {
            console.log(`%c[Bot] SYNCHRONIZACE: Volné ${status.ready}/${status.total} odemčených slotů. Čekám 5 minut...`, "color: orange; font-weight: bold;");
            setTimeout(runScavengingCycle, 300000);
            return;
        }

        console.log(`%c[Bot] POTVRZENO: Všech ${status.total} dostupných slotů je volných. Startuji: ${getEuroTime()}`, "color: yellow; font-weight: bold;");

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
            await sleep(4000); 
            TwCheese.use(TOOL_ID);

            console.log('%c[Bot] 30s delay pro preference...', 'color: orange;');
            await sleep(30000);

            let buttons = Array.from(document.querySelectorAll('.btn-send, .free_send_button'))
                               .filter(btn => btn.offsetParent !== null && !btn.classList.contains('btn-disabled'))
                               .reverse();

            let count = 0;
            for (const btn of buttons) {
                btn.click();
                count++;
                await sleep(1800 + Math.floor(Math.random() * 1000));
            }
            
            const randomSpread = Math.floor(Math.random() * (528000 - 210000 + 1)) + 210000;
            const now = new Date();
            let nightDelay = 0;
            if (now.getHours() >= 1 && now.getHours() < 7) {
                nightDelay = (Math.floor(Math.random() * (69 - 30 + 1)) + 30) * 60000;
            }

            const totalDelay = WAIT_TIME + randomSpread + nightDelay;
            console.log(`%c[Bot] Hotovo. Odesláno ${count} sběrů. Další v: ${getEuroTime(new Date(Date.now() + totalDelay))}`, "color: cyan; font-weight: bold;");
            
            setTimeout(runScavengingCycle, totalDelay);
        } catch (err) {
            console.error("[Bot] Chyba:", err.message);
            setTimeout(runScavengingCycle, 300000);
        }
    }

    runScavengingCycle();
})();
