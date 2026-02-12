/*
 * Script Name: Tribe Players Under Attack (Watchdog All-in-One)
 * Version: 0.4
 * Discord Webhook: Integrated
 * Check Interval: 25 - 46 minutes
 */

// 1. KNIHOVNA twSDK (Zkrácená verze nezbytná pro funkčnost watchdogu)
if (typeof twSDK === 'undefined') {
    window.twSDK = {
        delayBetweenRequests: 200,
        getAll: function (urls, onLoad, onDone, onError) {
            var numDone = 0;
            var lastRequestTime = 0;
            var minWaitTime = this.delayBetweenRequests;
            var self = this;
            loadNext();
            function loadNext() {
                if (numDone == urls.length) { onDone(); return; }
                let now = Date.now();
                let timeElapsed = now - lastRequestTime;
                if (timeElapsed < minWaitTime) {
                    setTimeout(loadNext, minWaitTime - timeElapsed);
                    return;
                }
                lastRequestTime = now;
                jQuery.get(urls[numDone]).done((data) => {
                    try { onLoad(numDone, data); ++numDone; loadNext(); } catch (e) { onError(e); }
                }).fail((xhr) => { onError(xhr); });
            }
        }
    };
}

(async function() {
    // --- KONFIGURACE ---
    const discordWebhookUrl = "https://discord.com/api/webhooks/1461838230663200890/Ff_OIbBuC3zMxKZFinwxmoJchc2Jq2h2l_nBddEp5hTE3Ys4o1-FCnpAZy20Zv92YnYf";
    const checkIntervalMin = 25; // 25 minut
    const checkIntervalMax = 46; // 46 minut
    const alertSoundUrl = "https://actions.google.com/sounds/v1/alarms/alarm_clock_beep.ogg";
    
    let lastAttackCounts = JSON.parse(localStorage.getItem('ra_watchdog_attacks') || "{}");

    function playAlert() {
        const audio = new Audio(alertSoundUrl);
        audio.play().catch(e => console.warn("Audio blocked, click on page to enable."));
    }

    async function notifyDiscord(playerName, totalIncs, newIncs) {
        const payload = {
            embeds: [{
                title: "⚠️ NOVÝ ÚTOK NA ČLENA KMENE",
                color: 15158332,
                fields: [
                    { name: "Hráč", value: playerName, inline: true },
                    { name: "Celkem příchozích", value: totalIncs.toString(), inline: true },
                    { name: "Nárůst o", value: `+${newIncs}`, inline: true }
                ],
                footer: { text: "Watchdog v0.4 - S09" },
                timestamp: new Date()
            }]
        };
        try {
            await fetch(discordWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (e) { console.error("Discord error", e); }
    }

    async function runWatchdogCycle() {
        console.log(`%c[Watchdog] Spouštím cyklus: ${new Date().toLocaleTimeString()}`, "color: orange; font-weight: bold;");
        
        let members = [];
        try {
            let url = `/game.php?village=${game_data.village.id}&screen=ally&mode=members_defense`;
            const resp = await jQuery.get(url);
            const options = jQuery(resp).find('.input-nicer option:not([disabled])');
            
            options.each(function() {
                if (!isNaN(parseInt(this.value))) {
                    let memberUrl = `/game.php?screen=ally&mode=members_defense&player_id=${this.value}&village=${game_data.village.id}`;
                    members.push({ id: this.value, name: this.text, url: memberUrl });
                }
            });
        } catch (e) {
            console.error("Chyba při načítání seznamu členů.");
        }

        if (members.length > 0) {
            const memberUrls = members.map(m => m.url);
            
            twSDK.getAll(
                memberUrls,
                function(index, data) {
                    const htmlDoc = jQuery.parseHTML(data);
                    const member = members[index];
                    let currentTotal = 0;

                    jQuery(htmlDoc).find('.table-responsive table tr').not(':first').each(function() {
                        const incsText = jQuery(this).find('td:last').text().trim();
                        const incs = parseInt(incsText) || 0;
                        currentTotal += incs;
                    });

                    let previousCount = lastAttackCounts[member.id] || 0;

                    if (currentTotal > previousCount) {
                        let diff = currentTotal - previousCount;
                        console.log(`%c[Alert] ${member.name}: ${previousCount} -> ${currentTotal} (+${diff})`, "color: red; font-weight: bold;");
                        playAlert();
                        notifyDiscord(member.name, currentTotal, diff);
                    }

                    lastAttackCounts[member.id] = currentTotal;
                },
                function() {
                    localStorage.setItem('ra_watchdog_attacks', JSON.stringify(lastAttackCounts));
                    const nextRunMin = Math.floor(Math.random() * (checkIntervalMax - checkIntervalMin + 1)) + checkIntervalMin;
                    console.log(`%c[Watchdog] Hotovo. Další kontrola za ${nextRunMin} minut.`, "color: green;");
                    setTimeout(runWatchdogCycle, nextRunMin * 60 * 1000);
                },
                function(err) { console.error("Chyba načítání dat", err); }
            );
        } else {
            console.warn("Žádní členové nenalezeni (pravděpodobně chybí oprávnění nebo nikdo nesdílí data).");
            setTimeout(runWatchdogCycle, checkIntervalMin * 60 * 1000);
        }
    }

    // Spuštění po verifikaci prostředí
    if (typeof game_data !== 'undefined' && game_data.screen === 'ally') {
        UI.SuccessMessage(`Watchdog v0.4 aktivován. Interval ${checkIntervalMin}-${checkIntervalMax} min.`);
        runWatchdogCycle();
    } else {
        UI.ErrorMessage("Watchdog musí být spuštěn v sekci Kmen -> Obrana!");
    }
})();
