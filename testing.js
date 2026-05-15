(async function() {
    // --- CONFIGURATION ---
    const TOOL_ID = 'ASS';
    const VERSION = '1.15';
    const SIGNATURE = 'TheBrain 🧠';
    const REPO_URL = 'https://solitaryzbyn.github.io/hovna';
    const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1462228257544999077/5jKi12kYmYenlhSzPqSVQxjN_f9NW007ZFCW_2ElWnI6xiW80mJYGj0QeOOcZQLRROCu';

    const getEuroTime = (date = new Date()) => date.toLocaleTimeString('en-GB', { hour12: false });
    const sleep = ms => new Promise(res => setTimeout(res, ms));

    let failureCount = 0;
    let isProcessing = false;
    let isFirstRun = true;
    let nextRunTime = 0; 
    
    const STORAGE_KEY = 'thebrain_night_mode';
    let nightModeEnabled = localStorage.getItem(STORAGE_KEY) === null ? true : localStorage.getItem(STORAGE_KEY) === 'true';

    // --- HUD UI ---
    const logId = 'thebrain-logger';
    if ($(`#${logId}`).length) $(`#${logId}`).remove();

    // CSS animace pro šipku
    if (!$('#thebrain-arrow-style').length) {
        $('<style id="thebrain-arrow-style">').text(`
            @keyframes thebrain-blink {
                0%, 100% { opacity: 1; transform: translateX(0px); }
                50% { opacity: 0.5; transform: translateX(-6px); }
            }
            #thebrain-arrow-indicator {
                animation: thebrain-blink 0.8s ease-in-out infinite;
                display: flex;
                align-items: center;
                gap: 6px;
                pointer-events: none;
            }
            #thebrain-arrow-indicator .arrow-svg {
                width: 28px;
                height: 22px;
            }
        `).appendTo('head');
    }

    $(`
        <div id="${logId}" style="position: fixed; left: 10px; top: 100px; width: 260px; background: rgba(15, 0, 0, 0.95); border: 2px solid #8B0000; border-radius: 5px; z-index: 99999; font-family: Calibri, sans-serif; box-shadow: 0 0 20px black; color: #DC143C;">
            <div style="background: #8B0000; color: white; padding: 6px; font-weight: bold; font-size: 14px; display: flex; justify-content: space-between; border-radius: 3px 3px 0 0;">
                <span>${SIGNATURE} v${VERSION}</span>
                <span id="logger-timer" style="color: #ffcc00;">READY</span>
            </div>
            <div style="padding: 8px; background: #2a0000; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #8B0000;">
                <span style="font-size: 11px; color: #fff;">NIGHT MODE (01-07)</span>
                <div>
                    <button id="night-toggle" style="background: ${nightModeEnabled ? '#8B0000' : '#444'}; color: white; border: 1px solid #ff0000; cursor: pointer; padding: 2px 8px; font-size: 10px; font-weight: bold; border-radius: 3px;">${nightModeEnabled ? 'ON' : 'OFF'}</button>
                    <button id="config-save" style="background: #228B22; color: white; border: 1px solid #00ff00; cursor: pointer; padding: 2px 8px; font-size: 10px; font-weight: bold; border-radius: 3px; margin-left: 5px;">SAVE</button>
                </div>
            </div>
            <div id="logger-status" style="padding: 10px; text-align: center; font-size: 18px; font-weight: bold; background: #1a0000; border-bottom: 1px solid #8B0000; color: #ffcc00;">IDLE</div>
            <div id="logger-content" style="padding: 8px; font-size: 11px; max-height: 140px; overflow-y: auto; line-height: 1.3;"></div>
        </div>
    `).appendTo('body');

    // --- FUNKCE PRO ŠIPKU NA PREFERENCES TAB ---
    function injectPreferencesArrow() {
        if ($('#thebrain-pref-arrow').length) return;

        // Hledáme preferences tab - různé možné selektory pro různé verze hry
        const prefSelectors = [
            'a[href*="preferences"]',
            'a[href*="settings"]',
            '#menu_row2 a:contains("Preferences")',
            '#menu_row2 a:contains("preferences")',
            '.tab_link:contains("Preferences")',
            'a.tab:contains("Preferences")',
            '#contentContainer a[href*="pref"]',
        ];

        let $prefTab = $();
        for (const sel of prefSelectors) {
            try {
                $prefTab = $(sel).first();
                if ($prefTab.length) break;
            } catch(e) {}
        }

        const arrowHtml = `
            <div id="thebrain-pref-arrow" style="
                position: absolute;
                z-index: 99998;
                display: flex;
                align-items: center;
                gap: 5px;
                pointer-events: none;
            ">
                <div id="thebrain-arrow-indicator">
                    <svg class="arrow-svg" viewBox="0 0 28 22" xmlns="http://www.w3.org/2000/svg">
                        <polygon points="0,3 18,3 18,0 28,11 18,22 18,19 0,19" fill="#FF0000" stroke="#8B0000" stroke-width="1.5"/>
                    </svg>
                    <span style="
                        font-family: Calibri, sans-serif;
                        font-size: 13px;
                        font-weight: bold;
                        color: #FF0000;
                        text-shadow: 0 0 6px #000, 1px 1px 0 #000;
                        white-space: nowrap;
                        letter-spacing: 1px;
                    ">CLICK HERE</span>
                </div>
            </div>
        `;

        $('body').append(arrowHtml);
        const $arrow = $('#thebrain-pref-arrow');

        if ($prefTab.length) {
            // Umístit šipku vedle tabu
            const offset = $prefTab.offset();
            const tabW = $prefTab.outerWidth();
            const tabH = $prefTab.outerHeight();
            $arrow.css({
                top: (offset.top + tabH / 2 - 11) + 'px',
                left: (offset.left - 150) + 'px',
            });
        } else {
            // Záložní pozice pokud tab nenajdeme - na začátek stránky
            $arrow.css({ top: '10px', left: '10px' });
        }
    }

    // Spustit po načtení DOM
    $(document).ready(function() {
        setTimeout(injectPreferencesArrow, 800);
    });

    $(document).on('click', '#night-toggle', function() {
        nightModeEnabled = !nightModeEnabled;
        $(this).text(nightModeEnabled ? 'ON' : 'OFF').css('background', nightModeEnabled ? '#8B0000' : '#444');
    });

    $(document).on('click', '#config-save', function() {
        localStorage.setItem(STORAGE_KEY, nightModeEnabled);
        updateLog("Settings saved!", true);
    });

    function updateLog(message, isImportant = false) {
        const style = isImportant ? 'font-weight: bold; color: #ffffff;' : '';
        $('#logger-content').prepend(`<div style="border-bottom: 1px solid #330000; padding: 2px 0; ${style}">[${getEuroTime()}] ${message}</div>`);
    }

    function getLatestReturnTimeMs() {
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
        for (let i = 0; i < 20; i++) { 
            let currentPop = 0;
            $('.unitsInput').each(function() { currentPop += (parseInt($(this).val()) || 0); });
            if (currentPop >= 10) return true;
            await sleep(500);
        }
        return false;
    }

    async function startAction() {
        if (isProcessing) return;
        isProcessing = true;
        $('#logger-status').text("ACTIVE").css('color', '#00ff00');

        if (window.TwCheese === undefined) {
            window.TwCheese = { ROOT: REPO_URL, tools: {}, fetchLib: async function(p) { return new Promise(res => $.ajax(`${this.ROOT}/${p}`, { cache: true, dataType: "script", complete: res })); }, registerTool(t) { this.tools[t.id] = t; }, use(id) { this.tools[id].use(); }, has(id) { return !!this.tools[id]; } };
            await TwCheese.fetchLib('dist/vendor.min.js');
            await TwCheese.fetchLib('dist/tool/setup-only/Sidebar.min.js');
            TwCheese.use('Sidebar');
        }

        try {
            if (!TwCheese.has(TOOL_ID)) await TwCheese.fetchLib(`dist/tool/setup-only/${TOOL_ID}.min.js`);
            await sleep(1500);
            TwCheese.use(TOOL_ID);
            
            const prepDelay = Math.floor(Math.random() * 15000) + 15000; 
            updateLog(`Setup wait: ${Math.round(prepDelay/1000)}s`);
            await sleep(prepDelay);

            if (!(await checkRefillReady())) {
                failureCount++;
                updateLog("Troops not ready. Delaying.");
                nextRunTime = Date.now() + 120000;
                isProcessing = false;
                return;
            }

            const sendButtons = $('.btn-send, .free_send_button').filter(':visible').not('.btn-disabled').toArray().reverse();
            for (const btn of sendButtons) {
                btn.click();
                await sleep(1000 + Math.floor(Math.random() * 1000)); 
            }

            failureCount = 0;
            isFirstRun = false;
            updateLog("Missions sent.", true);
            await sleep(10000); 
            calculateNextRun(); 
            isProcessing = false;

        } catch (err) {
            failureCount++;
            updateLog(`Error: ${err.message}`);
            nextRunTime = Date.now() + 60000;
            isProcessing = false;
        }
    }

    function calculateNextRun() {
        const latestReturnMs = getLatestReturnTimeMs();
        
        if (isFirstRun && latestReturnMs === 0) {
            updateLog("Instant start: Waiting only for setup.");
            nextRunTime = Date.now() + 1000;
            return;
        }

        const now = new Date();
        const hour = now.getHours();
        let buffer;
        if (nightModeEnabled && hour >= 1 && hour < 7) {
            buffer = (Math.floor(Math.random() * (79 - 52 + 1)) + 52) * 60000;
        } else {
            buffer = (Math.floor(Math.random() * (12 - 3 + 1)) + 3) * 60000;
        }

        nextRunTime = Date.now() + latestReturnMs + buffer;
        updateLog(`Scheduled at: ${getEuroTime(new Date(nextRunTime))}`);
    }

    function startHeartbeat() {
        calculateNextRun(); 
        
        setInterval(() => {
            const now = Date.now();
            const remaining = nextRunTime - now;

            if (remaining <= 0 && !isProcessing) {
                $('#logger-timer').text("READY");
                startAction();
            } else if (!isProcessing) {
                let m = Math.floor(remaining / 60000);
                let s = Math.floor((remaining % 60000) / 1000);
                $('#logger-timer').text(`${m}:${s.toString().padStart(2, '0')}`);
                $('#logger-status').text("SLEEPING").css('color', '#666');
            }
        }, 1000);
    }

    startHeartbeat();
})();
