/*
 * Script Name: Tribe Players Under Attack (Watchdog Parallel Edition)
 * Version: 0.3
 * Note: Use at your own risk. This script automates browser actions.
 */

(async function() {
    // --- KONFIGURACE ---
    const discordWebhookUrl = "https://discord.com/api/webhooks/1461838230663200890/Ff_OIbBuC3zMxKZFinwxmoJchc2Jq2h2l_nBddEp5hTE3Ys4o1-FCnpAZy20Zv92YnYf";
    const checkIntervalMin = 25; // Minimální pauza (minuty)
    const checkIntervalMax = 46; // Maximální pauza (minuty)
    const alertSoundUrl = "https://actions.google.com/sounds/v1/alarms/alarm_clock_beep.ogg";
    
    let lastAttackCounts = JSON.parse(localStorage.getItem('ra_watchdog_attacks') || "{}");

    function playAlert() {
        const audio = new Audio(alertSoundUrl);
        audio.play().catch(e => console.log("Audio play blocked by browser."));
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
        console.log(`[Watchdog] Spouštím hromadnou kontrolu všech hráčů: ${new Date().toLocaleTimeString()}`);
        
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
            
            // Spuštění hromadného načtení všech hráčů naráz (využití twSDK logiky)
            twSDK.getAll(
                memberUrls,
                function(index, data) {
                    // Tato funkce se spustí pro každého staženého hráče
                    const htmlDoc = jQuery.parseHTML(data);
                    const member = members[index];
                    let currentTotal = 0;

                    jQuery(htmlDoc).find('.table-responsive table tr').not(':first').each(function() {
                        const incs = parseInt(jQuery(this).find('td:last').text().trim()) || 0;
                        currentTotal += incs;
                    });

                    let previousCount = lastAttackCounts[member.id] || 0;

                    if (currentTotal > previousCount) {
                        let diff = currentTotal - previousCount;
                        console.log(`[Watchdog] ALERT: ${member.name} (+${diff})`);
                        playAlert();
                        notifyDiscord(member.name, currentTotal, diff);
                    }

                    lastAttackCounts[member.id] = currentTotal;
                },
                function() {
                    // Tato funkce se spustí po dokončení úplně všech požadavků
                    localStorage.setItem('ra_watchdog_attacks', JSON.stringify(lastAttackCounts));
                    
                    const nextRunMs = (checkIntervalMin * 60 * 1000) + (Math.random() * (checkIntervalMax - checkIntervalMin) * 60 * 1000);
                    console.log(`[Watchdog] Hromadná kontrola hotova. Další za ${Math.round(nextRunMs/60000)} minut.`);
                    setTimeout(runWatchdogCycle, nextRunMs);
                },
                function(err) {
                    console.error("Chyba při hromadném načítání", err);
                }
            );
        }
    }

    if (typeof game_data !== 'undefined' && typeof twSDK !== 'undefined') {
        UI.SuccessMessage(`Watchdog v0.3 spuštěn (interval ${checkIntervalMin}-${checkIntervalMax} min).`);
        runWatchdogCycle();
    } else {
        UI.ErrorMessage("Chyba: twSDK nenalezeno nebo nejsi ve hře!");
    }
})();
