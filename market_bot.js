(function () {
    const LIMIT_PRO_PRODEJ = 200; 
    const KOLIK_PRODAT = 800;    
    const MINIMUM_V_ALDEJI = 1200; 
    const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1461838230663200890/Ff_OIbBuC3zMxKZFinwxmoJchc2Jq2h2l_nBddEp5hTE3Ys4o1-FCnpAZy20Zv92YnYf";
    
    const nahodnyCas = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

    function posliNaDiscord(zprava) {
        fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: zprava })
        }).catch(err => console.error("Discord error:", err));
    }

    console.log("%c --- MOTOR 8.6: MERCHANT TIME TRACKER --- ", "color: white; background: #34495e; font-weight: bold;");

    function ziskejCasNavratuObchodniku() {
        // Najdeme všechny časy návratu v tabulce obchodníků
        let casy = Array.from(document.querySelectorAll('span.timer')).map(el => {
            let t = el.innerText.split(':'); // formát HH:MM:SS nebo MM:SS
            if (t.length === 3) return (parseInt(t[0]) * 3600) + (parseInt(t[1]) * 60) + parseInt(t[2]);
            if (t.length === 2) return (parseInt(t[0]) * 60) + parseInt(t[1]);
            return 60; // default 1 min
        });
        
        if (casy.length === 0) return 60; // Pokud žádné timery nevidí, zkusí to za minutu
        return Math.min(...casy); // Vrátí nejkratší čas v sekundách
    }

    function hlidatTrh() {
        if (document.getElementById('captcha') || document.querySelector('.h-captcha')) {
            posliNaDiscord("🆘 **CAPTCHA!** Bot stojí.");
            return;
        }

        // --- KONTROLA OBCHODNÍKŮ ---
        let obchodniciKapacita = parseInt($("#market_merchant_max_transport").text().replace(/\D/g, ''));
        if (isNaN(obchodniciKapacita) || obchodniciKapacita < KOLIK_PRODAT) {
            let vterinDoNavratu = ziskejCasNavratuObchodniku();
            let milivterin = (vterinDoNavratu * 1000) + nahodnyCas(5000, 15000); // Přidáme 5-15s rezervu
            
            console.log("Obchodníci jsou plní. Další se vrátí za " + vterinDoNavratu + "s. Bot jde spát.");
            setTimeout(() => { location.reload(); }, milivterin);
            return;
        }

        const suroviny = ["wood", "stone", "iron"];
        const cesky = { "wood": "Dřevo", "stone": "Hlína", "iron": "Železo" };
        
        let jeDostatekAlesponJedne = suroviny.some(typ => {
            let n = parseInt($("#" + typ).text().replace(/\D/g, ''));
            return !isNaN(n) && n >= MINIMUM_V_ALDEJI;
        });

        if (!jeDostatekAlesponJedne) {
            console.log("Sklady pod 1200. Čekám 5 minut...");
            setTimeout(hlidatTrh, 300000);
            return;
        }

        let akceProvedena = false;
        suroviny.forEach((typ) => {
            if (akceProvedena) return;
            let n = parseInt($("#" + typ).text().replace(/\D/g, ''));
            if (n < MINIMUM_V_ALDEJI) return;

            let k = PremiumExchange.data.capacity[typ];
            let s = PremiumExchange.data.stock[typ];
            let f = PremiumExchange.calculateMarginalPrice(s, k);
            let kurz = Math.floor(1 / f);

            if (kurz <= LIMIT_PRO_PRODEJ) {
                let input = $("input[name='sell_" + typ + "']");
                if (input.length > 0 && !document.querySelector('.btn-confirm-yes')) {
                    input.val(KOLIK_PRODAT).trigger('change');
                    akceProvedena = true;
                    setTimeout(() => {
                        $(".btn-premium-exchange-buy").click();
                        setTimeout(() => {
                            if ($(".btn-confirm-yes").is(':visible')) {
                                $(".btn-confirm-yes").click();
                                posliNaDiscord("💰 **PRODÁNO!** " + cesky[typ] + " za kurz " + kurz);
                                setTimeout(() => { location.reload(); }, 5000);
                            }
                        }, 2500);
                    }, 1000);
                }
            }
        });

        if (!akceProvedena) setTimeout(hlidatTrh, nahodnyCas(10000, 15000));
    }

    hlidatTrh();
})();
