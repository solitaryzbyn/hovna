(async (ModuleLoader) => {
    'use strict';

    //****************************** Konfigurace ******************************//
    const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1462228257544999077/5jKi12kYmYenlhSzPqSVQxjN_f9NW007ZFCW_2ElWnI6xiW80mJYGj0QeOOcZQLRROCu";
    const minCheckInterval = 5000; 
    const maxCheckInterval = 10000; 
    //*************************** Konec Konfigurace ***************************//

    let isBotRunning = true;
    let lastResourceAlert = 0;

    const sendDiscordMessage = (content) => {
        fetch(DISCORD_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: `**[Paladin Bot]** ${content}` })
        }).catch(err => console.error("Discord error:", err));
    };

    const stopBot = (reason) => {
        isBotRunning = false;
        sendDiscordMessage(`🚨 **KRITICKÁ STOPKA: ${reason}** @everyone`);
        console.error("Bot zastaven:", reason);
        // V případě Captchy přestaneme i obnovovat stránku
    };

    const checkCaptcha = () => {
        const hasCaptcha = document.querySelector('iframe[src*="recaptcha"]') || 
                           document.querySelector('.recaptcha-checkbox') ||
                           document.querySelector('#bot_protection_image') ||
                           window.location.href.indexOf('bot_protection') > -1;
        if (hasCaptcha) {
            stopBot("Detekována CAPTCHA ochrana! Okamžitě se přihlas.");
            return true;
        }
        return false;
    };

    const getPlayerResources = () => {
        return {
            wood: parseInt(document.getElementById('storage_wood').textContent),
            stone: parseInt(document.getElementById('storage_stone').textContent),
            iron: parseInt(document.getElementById('storage_iron').textContent)
        };
    };

    const run = async () => {
        if (!isBotRunning) return;
        if (checkCaptcha()) return;

        // Kontrola, zda paladin právě netrénuje
        const isTraining = document.querySelector(".knight_timer") || document.querySelector("#knight_activity > span.icon.header.time");
        
        // Pokud netrénuje a vidíme tlačítko pro otevření menu tréninků
        const trainButton = document.querySelector(".btn-knight-train, .knight_train_gui");
        
        if (!isTraining) {
            // 1. Otevřít okno tréninku, pokud není otevřené
            if (!$('#popup_box_knight_regimens').is(':visible')) {
                console.log("Otevírám menu tréninku...");
                $('.btn-knight-train').click();
                setTimeout(run, 2000); // Počkat na načtení popupu
                return;
            }

            // 2. Najít první (nejlevnější/nejkratší) možnost v popupu
            const firstRegimen = $('#popup_box_knight_regimens .knight_regimen_container').first();
            if (firstRegimen.length) {
                // Získat cenu prvního tréninku
                const reqWood = parseInt(firstRegimen.find('.res.wood').text().replace('.', '')) || 0;
                const reqStone = parseInt(firstRegimen.find('.res.stone').text().replace('.', '')) || 0;
                const reqIron = parseInt(firstRegimen.find('.res.iron').text().replace('.', '')) || 0;

                const playerRes = getPlayerResources();

                // 3. Kontrola surovin
                if (playerRes.wood >= reqWood && playerRes.stone >= reqStone && playerRes.iron >= reqIron) {
                    console.log("Suroviny OK, spouštím nejkratší trénink.");
                    const startBtn = firstRegimen.find('.btn-confirm-ok');
                    if (startBtn.length) {
                        startBtn.click();
                        sendDiscordMessage("⚔️ Spuštěn nový trénink (nejkratší varianta).");
                        // Po kliknutí refresh za pár sekund pro jistotu
                        setTimeout(() => window.location.reload(), 3000);
                    }
                } else {
                    // Málo surovin
                    const now = Date.now();
                    if (now - lastResourceAlert > 1800000) { // Alert max každých 30 min
                        sendDiscordMessage(`⏳ Čekám na suroviny pro nejlevnější trénink (Potřeba: D:${reqWood}, H:${reqStone}, Ž:${reqIron}).`);
                        lastResourceAlert = now;
                    }
                    console.log("Nedostatek surovin, zkusím za 10 minut.");
                    setTimeout(run, 600000); // Počkat 10 min
                    return;
                }
            }
        }

        // Náhodný interval pro další kontrolu
        const nextInterval = Math.random() * (maxCheckInterval - minCheckInterval) + minCheckInterval;
        setTimeout(run, nextInterval);
    };

    // UI Panel pro vizuální kontrolu
    $('.pally-bot-status').remove();
    $('#content_value h2').first().after(`
        <div class="pally-bot-status" style="border: 2px solid #7d510f; padding: 10px; background: #e3d5b3; margin: 10px 0; border-radius: 5px;">
            <h3 style="margin:0; color: #4b2e04;">⚔️ Paladin Bot v2.0</h3>
            <p style="margin:5px 0 0 0;">Režim: <b>Dynamické hlídání surovin</b> | Captcha: <b>Aktivní ochrana</b></p>
        </div>
    `);

    run();

})({
    loadModule: m => new Promise((res, rej) => {
        $.ajax({ url: `https://raw.githubusercontent.com/joaovperin/TribalWars/master/Modules/${m.replace('.', '/')}.js`, dataType: "text" })
         .done(data => res(eval(data))).fail(rej);
    })
});
