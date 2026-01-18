// Nastavení
const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1461838230663200890/Ff_OIbBuC3zMxKZFinwxmoJchc2Jq2h2l_nBddEp5hTE3Ys4o1-FCnpAZy20Zv92YnY";
const CHECK_INTERVAL = [30 * 60 * 1000, 45 * 60 * 1000]; // 30-45 minut v ms

let botActive = true;

async function sendDiscordAlert(msg) {
    await fetch(DISCORD_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: `⚠️ **TW BOT ALERT:** ${msg}` })
    });
}

// Simulace lidského kliknutí a psaní
async function humanTypeAndClick(inputSelector, value) {
    const el = document.querySelector(inputSelector);
    if (!el) return;

    el.focus();
    await new Promise(r => setTimeout(r, Math.random() * 400 + 200));
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, Math.random() * 300 + 100));
    el.blur();
}

async function humanClick(btnSelector) {
    const btn = document.querySelector(btnSelector);
    if (!btn) return;

    const events = ['mousedown', 'mouseup', 'click'];
    for (let ev of events) {
        btn.dispatchEvent(new MouseEvent(ev, {
            view: window,
            bubbles: true,
            cancelable: true,
            buttons: 1
        }));
        await new Promise(r => setTimeout(r, Math.random() * 100 + 50));
    }
}

async function checkAndRecruit() {
    if (!botActive) return;

    // Kontrola CAPTCHY
    if (document.querySelector("#bot_check") || document.querySelector(".bot_check") || document.querySelector("#recaptcha")) {
        botActive = false;
        await sendDiscordAlert("Detekována CAPTCHA! Script se zastavuje.");
        return;
    }

    // Kontrola, zda se již něco rekrutuje (spear nebo sword ikona ve frontě)
    const recruiting = document.querySelector(".unit_sprite_smaller.spear, .unit_sprite_smaller.sword");
    
    if (!recruiting) {
        console.log("Fronta je prázdná, zahajuji rekrutaci...");

        // Výpočet surovin pro rovnoměrný odběr (Spear: 50w, 30c, 10i | Sword: 30w, 30c, 70i)
        // Rekrutujeme po malých dávkách (např. 10 a 10), aby to vypadalo přirozeně
        const amount = 10; 

        await humanTypeAndClick("input[name=spear]", amount.toString());
        await new Promise(r => setTimeout(r, Math.random() * 1500 + 500));
        await humanTypeAndClick("input[name=sword]", amount.toString());
        
        await new Promise(r => setTimeout(r, Math.random() * 2000 + 1000));
        await humanClick(".btn-recruit");
        
        console.log(`Rekrutováno ${amount} kopí a ${amount} šermířů.`);
    } else {
        console.log("Jednotky se stále rekrutují, čekám...");
    }

    // Naplánování další kontroly v náhodném rozmezí
    scheduleNext();
}

function scheduleNext() {
    if (!botActive) return;
    const delay = Math.floor(Math.random() * (CHECK_INTERVAL[1] - CHECK_INTERVAL[0] + 1) + CHECK_INTERVAL[0]);
    console.log(`Další kontrola za ${Math.round(delay / 60000)} minut.`);
    setTimeout(checkAndRecruit, delay);
}

// Spuštění po načtení stránky
(function() {
    console.log("Bot pro tichou rekrutaci aktivován.");
    // První kontrola proběhne krátce po spuštění
    setTimeout(checkAndRecruit, Math.random() * 5000 + 2000);
})();
