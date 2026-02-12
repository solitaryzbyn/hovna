/*
 * Script Name: Tribe Players Under Attack (Watchdog v0.6 - UI & Manual Trigger)
 * Version: 0.6
 */

if (typeof twSDK === 'undefined') {
    window.twSDK = {
        delayBetweenRequests: 250,
        getAll: function (urls, onLoad, onDone, onError) {
            var numDone = 0;
            var lastRequestTime = 0;
            var self = this;
            loadNext();
            function loadNext() {
                if (numDone == urls.length) { onDone(); return; }
                let now = Date.now();
                if (now - lastRequestTime < self.delayBetweenRequests) {
                    setTimeout(loadNext, self.delayBetweenRequests - (now - lastRequestTime));
                    return;
                }
                lastRequestTime = now;
                jQuery.get(urls[numDone]).done((data) => {
                    try { onLoad(numDone, data); ++numDone; loadNext(); } catch (e) { onError(e); }
                }).fail((xhr) => { onError(xhr); });
            }
        },
        renderBox: function(content) {
            const id = 'raWatchdogUI';
            const html = `
                <div id="${id}" class="vis" style="margin: 15px 0; border: 1px solid #7d510f; background: #f4e4bc;">
                    <div class="ih" style="background: #c1a264; padding: 5px; font-weight: bold; border-bottom: 1px solid #7d510f; display: flex; justify-content: space-between; align-items: center;">
                        <span>🛡️ Tribe Watchdog v0.6</span>
                        <button id="manualScanBtn" class="btn" style="padding: 2px 5px; cursor: pointer;">Scanovat nyní</button>
                    </div>
                    <div id="${id}Content" style="padding: 10px;">${content}</div>
                </div>`;
            if (jQuery('#'+id).length) jQuery('#'+id+'Content').html(content);
            else jQuery('#content_value').prepend(html);
        }
    };
}

(async function() {
    const discordWebhookUrl = "https://discord.com/api/webhooks/1461838230663200890/Ff_OIbBuC3zMxKZFinwxmoJchc2Jq2h2l_nBddEp5hTE3Ys4o1-FCnpAZy20Zv92YnYf";
    const checkIntervalMin = 25;
    const checkIntervalMax = 46;
    const alertSoundUrl = "https://actions.google.com/sounds/v1/alarms/alarm_clock_beep.ogg";
    
    let lastAttackCounts = JSON.parse(localStorage.getItem('ra_watchdog_attacks') || "{}");
    let isScanning = false;
    let timerId = null;

    function playAlert() {
        const audio = new Audio(alertSoundUrl);
        audio.play().catch(() => console.warn("Zvuk zablokován - klikni do stránky!"));
    }

    async function notifyDiscord(playerName, totalIncs, newIncs) {
        const payload = {
            embeds: [{
                title: "⚠️ NOVÝ ÚTOK NA ČLENA KMENE",
                color: 15158332,
                fields: [
                    { name: "Hráč", value: playerName, inline: true },
                    { name: "Celkem útoků", value: totalIncs.toString(), inline: true },
                    { name: "Nárůst", value: `+${newIncs}`, inline: true }
                ],
                timestamp: new Date()
            }]
        };
        fetch(discordWebhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }

    async function runWatchdogCycle() {
        if (isScanning) return;
        isScanning = true;
        clearTimeout(timerId);

        twSDK.renderBox("⏳ Probíhá hromadná kontrola útoků...");
        let members = [];
        try {
            const resp = await jQuery.get(`/game.php?village=${game_data.village.id}&screen=ally&mode=members_defense`);
            jQuery(resp).find('.input-nicer option:not([disabled])').each(function() {
                if (!isNaN(parseInt(this.value))) {
                    members.push({ id: this.value, name: this.text, url: `/game.php?screen=ally&mode=members_defense&player_id=${this.value}` });
                }
            });
        } catch (e) { console.error("Chyba seznamu"); }

        if (members.length > 0) {
            let logHTML = '<table class="vis" width="100%"><tr><th>Hráč</th><th>Útoky</th><th>Status</th></tr>';
            twSDK.getAll(members.map(m => m.url), 
                function(index, data) {
                    const member = members[index];
                    let currentTotal = 0;
                    jQuery(jQuery.parseHTML(data)).find('.table-responsive table tr').not(':first').each(function() {
                        currentTotal += parseInt(jQuery(this).find('td:last').text()) || 0;
                    });
                    
                    let status = "✅ Beze změny";
                    let previous = lastAttackCounts[member.id] || 0;
                    if (currentTotal > previous) {
                        let diff = currentTotal - previous;
                        status = `<b style="color:red;">🔥 NOVÉ (+${diff})</b>`;
                        playAlert();
                        notifyDiscord(member.name, currentTotal, diff);
                    }
                    logHTML += `<tr><td>${member.name}</td><td>${currentTotal}</td><td>${status}</td></tr>`;
                    lastAttackCounts[member.id] = currentTotal;
                },
                function() {
                    localStorage.setItem('ra_watchdog_attacks', JSON.stringify(lastAttackCounts));
                    isScanning = false;
                    const wait = Math.floor(Math.random() * (checkIntervalMax - checkIntervalMin + 1)) + checkIntervalMin;
                    twSDK.renderBox(logHTML + `</table><p style="margin-top:10px;">😴 Tiché monitorování aktivní. Další automatický scan za <b>${wait} minut</b>.</p>`);
                    
                    jQuery('#manualScanBtn').click(function() { runWatchdogCycle(); });
                    timerId = setTimeout(runWatchdogCycle, wait * 60 * 1000);
                },
                function(err) { isScanning = false; console.error(err); }
            );
        }
    }

    if (game_data.screen === 'ally') {
        runWatchdogCycle();
    } else {
        UI.ErrorMessage("Spusť skript v sekci Kmen -> Obrana!");
    }
})();
