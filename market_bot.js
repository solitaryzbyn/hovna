(function () {
    // --- KONFIGURACE ---
    const LIMIT_PRO_PRODEJ = 200; 
    const KOLIK_PRODAT = 1000;    
    const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1461838230663200890/Ff_OIbBuC3zMxKZFinwxmoJchc2Jq2h2l_nBddEp5hTE3Ys4o1-FCnpAZy20Zv92YnYf"; 
    
    const nahodnyCas = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

    console.log("%c --- MOTOR 8.0: MULTI-RESOURCE & DISCORD --- ", "color: white; background: #7289da; font-weight: bold;");

    function posliNaDiscord(zprava) {
        if (DISCORD_WEBHOOK_URL.startsWith("http")) {
            fetch(DISCORD_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: zprava })
            }).catch(err => console.error("Discord error:", err));
        }
    }

    function hlidatTrh() {
        if (document.getElementById('captcha') || document.querySelector('.h-captcha')) {
            posliNaDiscord("🆘 **POZOR!** Na trhu vyskočila Captcha! Musíš ji vyřešit ručně.");
            return;
        }

        const suroviny = ["wood", "stone", "iron"];
        const cesky = { "wood": "Dřevo", "stone": "Hlína", "iron": "Železo" };
        let prodanoNeco = false;

        suroviny.forEach((typ) => {
            if (prodanoNeco) return; // Prodáváme jednu surovinu za cyklus, aby to bylo nenápadné

            let kapacita = PremiumExchange.data.capacity[typ];
            let sklad = PremiumExchange.data.stock[typ];
            let faktor = PremiumExchange.calculateMarginalPrice(sklad, kapacita);
            let aktualniKurz = Math.floor(1 / faktor);

            console.log(cesky[typ] + ": " + aktualniKurz);

            if (aktualniKurz <= LIMIT_PRO_PRODEJ) {
                let input = $("input[name='sell_" + typ + "']");
                
                if (input.length > 0 && !document.querySelector('.btn-confirm-yes')) {
                    console.log("Prodávám " + cesky[typ] + " při kurzu " + aktualniKurz);
                    input.val(KOLIK_PRODAT).trigger('change');
                    prodanoNeco = true;

                    setTimeout(() => {
                        $(".btn-premium-exchange-buy").click();
                        setTimeout(() => {
                            let confirmBtn = $(".btn-confirm-yes");
                            if (confirmBtn.length > 0 && confirmBtn.is(':visible')) {
                                confirmBtn.click();
                                posliNaDiscord("💰 **Úspěšný prodej!** Prodáno " + KOLIK_PRODAT + " ks " + cesky[typ] + " za kurz " + aktualniKurz + ".");
                                setTimeout(() => { location.reload(); }, nahodnyCas(4000, 6000));
                            }
                        }, nahodnyCas(2000, 3000));
                    }, 1000);
                }
            }
        });

        if (!prodanoNeco) {
            setTimeout(hlidatTrh, nahodnyCas(10000, 20000));
        }
    }

    hlidatTrh();
})();
