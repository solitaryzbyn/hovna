(async (ModuleLoader, notificationConfig) => {
    'use strict';

    //****************************** Configuration ******************************//
    const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1462130873586417857/tWUGkOsfGbXfQldQ0AGhUwapq6Fl9Zn5fvdECx1BLdV-ISrtoAQWgCkV9MyQIBNwNZ1o";
    const refreshMin = 5000; 
    const refreshMax = 9000; 
    const CRITICAL_THRESHOLD = 200;
    //*************************** End Configuration ***************************//

    await ModuleLoader.loadModule('utils/notify-utils');
    TwFramework.setIdleTitlePreffix('PREMIUM_ALERT', document.title);

    const sendDiscordMessage = async (msg, isCritical = false) => {
        const payload = { content: msg };
        const send = () => fetch(DISCORD_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (isCritical) {
            await send(); await send(); await send();
        } else {
            await send();
        }
    };

    const _checkMarket = () => {
        try {
            const getTax = (id) => parseInt(/.*?(\d+).*/g.exec($(`#premium_exchange_rate_${id} div`).text())[1]);
            let woodTax = getTax('wood'), stoneTax = getTax('stone'), ironTax = getTax('iron');

            let criticalTriggered = [];
            let normalTriggered = [];

            if (woodTax <= CRITICAL_THRESHOLD) criticalTriggered.push(`DŘEVO: ${woodTax}`);
            if (stoneTax <= CRITICAL_THRESHOLD) criticalTriggered.push(`HLÍNA: ${stoneTax}`);
            if (ironTax <= CRITICAL_THRESHOLD) criticalTriggered.push(`ŽELEZO: ${ironTax}`);

            if (woodTax <= 500 && woodTax > CRITICAL_THRESHOLD) normalTriggered.push(`Dřevo (${woodTax})`);
            if (stoneTax <= 500 && stoneTax > CRITICAL_THRESHOLD) normalTriggered.push(`Hlína (${stoneTax})`);
            if (ironTax <= 500 && ironTax > CRITICAL_THRESHOLD) normalTriggered.push(`Železo (${ironTax})`);

            const now = Date.now();
            const lastAlert = parseInt(sessionStorage.getItem('lastMarketAlert') || 0);

            // 1. KRITICKÝ ALERT (pod 200) - 3x zpráva + @everyone
            if (criticalTriggered.length > 0 && (now - lastAlert > 30000)) {
                sendDiscordMessage(`# 🚨 !!! KRITICKÁ HODNOTA POD ${CRITICAL_THRESHOLD} !!! 🚨\n# ⚡ ${criticalTriggered.join(' | ')} ⚡\n@everyone KUPUJ OKAMŽITĚ! 🟥🟥🟥`, true);
                sessionStorage.setItem('lastMarketAlert', now);
            } 
            // 2. BĚŽNÝ ALERT (pod 500) - 1x zpráva + @everyone
            else if (normalTriggered.length > 0 && (now - lastAlert > 60000)) {
                sendDiscordMessage(`🔔 **Burza Alert (Pod 500):** ${normalTriggered.join(', ')} @everyone`, false);
                sessionStorage.setItem('lastMarketAlert', now);
            }
        } catch (e) { console.log("Čekám na načtení dat z trhu..."); }
    };

    $('.PEA-container-fixed').remove(); 
    $('#market_status_bar').after(notificationConfig);

    _checkMarket();

    const nextRefresh = Math.floor(Math.random() * (refreshMax - refreshMin + 1)) + refreshMin;
    console.log(`Příští refresh za ${nextRefresh / 1000}s. Monitoring aktivní.`);
    
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
    <p style="margin: 5px 0 0 0;">Upozornění pod 500 i 200 s @everyone aktivní.</p>
</div>`);
