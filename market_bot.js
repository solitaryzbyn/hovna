(function () {
    const LIMIT_PRO_PRODEJ = 350; 
    const KOLIK_PRODAT = 1000;    
    const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1461838230663200890/Ff_OIbBuC3zMxKZFinwxmoJchc2Jq2h2l_nBddEp5hTE3Ys4o1-FCnpAZy20Zv92YnY"; // Tvůj Webhook
    
    const nahodnyCas = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

    // --- FUNKCE PRO ZVUK ---
    function pipni() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // Tón A5
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.5);
        } catch (e) { console.log("Audio nebylo povoleno prohlížečem."); }
    }

    function posliNaDiscord(zprava) {
        fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: zprava })
        }).catch(err => console.error("Discord error:", err));
    }

    console.log("%c --- MOTOR 8.1: ANTI-SLEEP MODE --- ", "color: white; background: #e67e22; font-weight: bold;");

    function hlidatTrh() {
        if (document.hidden) {
            console.log("Karta je skrytá, ale bot stále hlídá (omezeně prohlížečem).");
        }

        if (document.getElementById('captcha') || document.querySelector('.h-captcha')) {
            pipni();
            posliNaDiscord("🆘 **POZOR!** Na trhu vyskočila Captcha!");
            return;
        }

        const suroviny = ["wood", "stone", "iron"];
        let prodanoNeco = false;

        suroviny.forEach((typ) => {
            if (prodanoNeco) return;
            let kapacita = PremiumExchange.data.capacity[typ];
            let sklad = PremiumExchange.data.stock[typ];
            let faktor = PremiumExchange.calculateMarginalPrice(sklad, kapacita);
            let aktualniKurz = Math.floor(1 / faktor);

            if (aktualniKurz <= LIMIT_PRO_PRODEJ) {
                let input = $("input[name='sell_" + typ + "']");
                if (input.length > 0 && !document.querySelector('.btn-confirm-yes')) {
                    pipni();
                    input.val(KOLIK_PRODAT).trigger('change');
                    prodanoNeco = true;
                    setTimeout(() => {
                        $(".btn-premium-exchange-buy").click();
                        setTimeout(() => {
                            let confirmBtn = $(".btn-confirm-yes");
                            if (confirmBtn.length > 0 && confirmBtn.is(':visible')) {
                                confirmBtn.click();
                                posliNaDiscord("💰 **PRODÁNO!** " + typ + " za kurz " + aktualniKurz);
                                setTimeout(() => { location.reload(); }, 5000);
                            }
                        }, 2500);
                    }, 1000);
                }
            }
        });

        if (!prodanoNeco) {
            setTimeout(hlidatTrh, nahodnyCas(10000, 15000));
        }
    }

    // Page Visibility API - Reakce na přepnutí okna
    document.addEventListener("visibilitychange", function() {
        if (!document.hidden) {
            console.log("Vítej zpět! Bot obnovuje okamžitou kontrolu.");
            hlidatTrh(); 
        }
    });

    hlidatTrh();
})();
