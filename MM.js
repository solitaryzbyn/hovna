(async (ModuleLoader, notificationConfig) => {
    'use strict';

    //****************************** Configuration ******************************//
    const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1462130873586417857/tWUGkOsfGbXfQldQ0AGhUwapq6Fl9Zn5fvdECx1BLdV-ISrtoAQWgCkV9MyQIBNwNZ1o";
    const refreshMin = 5000; 
    const refreshMax = 9000; 
    const CRITICAL_THRESHOLD = 200;
    //*************************** End Configuration ***************************//

    await ModuleLoader.loadModule('utils/notify-utils');
    if (typeof TwFramework !== 'undefined') {
        TwFramework.setIdleTitlePreffix('PREMIUM_ALERT', document.title);
    }

    const sendDiscordMessage = async (msg, isCritical = false) => {
        const payload = { content: msg };
        const send = () => fetch(DISCORD_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (isCritical) {
            // Kritický alert pošle 3 zprávy hned po sobě
            await send(); await send(); await send();
        } else {
            await send();
        }
    };

    const _checkMarket = () => {
        try {
            const getTax = (id) => {
                const text = $(`#premium_exchange_rate_${id} div`).text();
                const match = /.*?(\d+).*/g.exec(text);
                return match ? parseInt(match[1]) : null;
            };

            let woodTax = getTax('wood'), stoneTax = getTax('stone'), ironTax = getTax('iron');
            if (woodTax === null) return;

            let criticalTriggered = []; // < 200
            let normalTriggered = [];   // < 500

            const resources = [
                { name: 'Dřevo', val: woodTax, id: 'DŘEVO' },
                { name: 'Hlína', val: stoneTax, id: 'HLÍNA' },
                { name: 'Železo', val: ironTax, id: 'ŽELEZO' }
            ];

            resources.forEach(res => {
                if (res.val <= CRITICAL_THRESHOLD) {
                    criticalTriggered.push(`${res.id}: ${res.val}`);
                } else if (res.val <= 500) {
                    normalTriggered.push(`${res.name} (${res.val})`);
                }
            });

            const now = Date.now();
            const lastAlert = parseInt(sessionStorage.getItem('lastMarketAlert') || 0);

            // 1. KRITICKÝ ALERT (pod 200) - 3x zpráva + zvuk útok
            if (criticalTriggered.length > 0 && (now - lastAlert > 30000)) {
                TribalWars.playSound("attack");
                sendDiscordMessage(`# 🚨 !!! KRITICKÁ HODNOTA POD ${CRITICAL_THRESHOLD} !!! 🚨\n# ⚡ ${criticalTriggered.join(' | ')} ⚡\n@everyone KUPUJ OKAMŽITĚ! 🟥🟥🟥`, true);
                sessionStorage.setItem('lastMarketAlert', now);
            } 
            // 2. BĚŽNÝ ALERT (pod 500) - 1x zpráva + zvuk slepička
            else if (normalTriggered.length > 0 && (now - lastAlert > 60000)) {
                TribalWars.playSound("chicken");
                sendDiscordMessage(`🔔 **Burza Alert (Pod 500):** ${normalTriggered.join(', ')} @everyone`, false);
                sessionStorage.setItem('lastMarketAlert', now);
            }
        } catch (e) { console.log("Hledám data trhu..."); }
    };

    // Vyčištění panelu a vložení nového
    $('.PEA-container-fixed').remove(); 
    $('#market_status_bar').after(notificationConfig);
    
    // Okamžitá kontrola
    _checkMarket();

    // Náhodný refresh 5-9 sekund
    const nextRefresh = Math.floor(Math.random() * (refreshMax - refreshMin + 1)) + refreshMin;
    setTimeout(() => {
        if (window.location.href.indexOf('mode=exchange') > -1) {
            window.location.reload();
        }
    }, nextRefresh);

})({
    loadModule: m => new Promise((res, rej) => {
        $.ajax({ url: `https://raw.githubusercontent.com/joaovperin/TribalWars/master/Modules/${m.replace('.', '/')}.js`, dataType: "text" })
         .done(data => res(eval(data))).fail(rej);
    })
}, `<div class="PEA-container-fixed" style="border: 2px solid #7d510f; padding: 15px; background: #e3d5b3; margin: 10px 0; border-radius: 5px;">
    <h3 style="margin:0; color: #4b2e04;">🛡️ Burza Monitor Aktivní</h3>
    <small>Hlídám ceny pod 500 a 200 | @everyone aktivní</small>
</div>`);
