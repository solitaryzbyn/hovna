(function () {
    const LIMIT_PRO_PRODEJ = 200; 
    const KOLIK_PRODAT = 800;    
    const MINIMUM_V_ALDEJI = 1200; 
    const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1461838230663200890/Ff_OIbBuC3zMxKZFinwxmoJchc2Jq2h2l_nBddEp5hTE3Ys4o1-FCnpAZy20Zv92YnY";
    
    const nahodnyCas = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

    function pipni() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            oscillator.start(); oscillator.stop(audioCtx.currentTime + 0.5);
        } catch (e) {}
    }

    function posliNaDiscord(zprava) {
        fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: zprava })
        }).catch(err => console.error("Discord error:", err));
    }

    console.log("%c --- MOTOR 8.3: SMART STORAGE --- ", "color: white; background: #2c3e50; font-weight: bold;");

    function hlidatTrh() {
        if (document.getElementById('captcha') || document.querySelector('.h-captcha')) {
            pipni();
            posliNaDiscord("🆘 **CAPTCHA!** Bot se zastavil!");
            return;
        }

        const suroviny = ["wood", "stone", "iron"];
        const cesky = { "wood": "Dřevo", "stone": "Hlína", "iron": "Železo" };
        
        // --- KONTROLA SKLADU (GLOBÁLNÍ) ---
        let jeDostatekAlesponJedne = suroviny.some(typ => {
            return parseInt($("#" + typ).text().replace(/\D/g, '')) >= MINIMUM_V_ALDEJI;
        });

        if (!jeDostatekAlesponJedne) {
            console.log("Sklady jsou pod limitem 1200. Odpočívám 5-10 minut...");
            setTimeout(hlidatTrh, nahodnyCas(300000, 600000)); // Spánek 5-10 minut
            return;
        }

        // --- KONTROLA OBCHODNÍKŮ ---
        let obchodniciNaCeste = parseInt($("#market_merchant_max_transport").text().replace(/\D/g, ''));
        if (isNaN(obchodniciNaCeste) || obchodniciNaCeste < KOLIK_PRODAT) {
            console.log("Obchodníci jsou zaneprázdněni. Čekám...");
            setTimeout(hlidatTrh, nahodnyCas(30000, 60000));
            return;
        }

        let akceProvedena = false;

        suroviny.forEach((typ) => {
            if (akceProvedena) return;

            let surovinVAldeji = parseInt($("#" + typ).text().replace(/\D/g, ''));
            if (surovinVAldeji < MINIMUM_V_ALDEJI) return;

            let kapacita = PremiumExchange.data.capacity[typ];
            let sklad = PremiumExchange.data.stock[typ];
            let faktor = PremiumExchange.calculateMarginalPrice(sklad, kapacita);
            let aktualniKurz = Math.floor(1 / faktor);

            if (aktualniKurz <= LIMIT_PRO_PRODEJ) {
                let input = $("input[name='sell_" + typ + "']");
                if (input.length > 0 && !document.querySelector('.btn-confirm-yes')) {
                    pipni();
                    input.val(KOLIK_PRODAT).trigger('change');
                    akceProvedena = true;
                    setTimeout(() => {
                        $(".btn-premium-exchange-buy").click();
                        setTimeout(() => {
                            let confirmBtn = $(".btn-confirm-yes");
                            if (confirmBtn.length > 0 && confirmBtn.is(':visible')) {
                                confirmBtn.click();
                                posliNaDiscord("💰 **PRODÁNO!** " + cesky[typ] + " (Kurz: " + aktualniKurz + ")");
                                setTimeout(() => { location.reload(); }, 5000);
                            }
                        }, 2500);
                    }, 1000);
                }
            }
        });

        if (!akceProvedena) {
            setTimeout(hlidatTrh, nahodnyCas(10000, 15000));
        }
    }

    document.addEventListener("visibilitychange", () => { if (!document.hidden) hlidatTrh(); });
    hlidatTrh();
})();
