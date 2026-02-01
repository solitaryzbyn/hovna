javascript:
// Mass scavenging by TheBraub - Ghost Mode Enabled
// Version: 0.1
var version = 0.1;

// --- GHOST MODE LOGIC ---
function startGhostMode() {
    let timeLeft = 30;
    const btnCalculate = $("#sendMass");
    
    if (btnCalculate.length) {
        const originalValue = btnCalculate.val();
        const countdownInterval = setInterval(() => {
            btnCalculate.val(originalValue + " (Ghost: " + timeLeft + "s)");
            timeLeft--;

            if (timeLeft < 0) {
                clearInterval(countdownInterval);
                btnCalculate.val(originalValue);
                console.log("Ghost Mode: Calculating runtimes...");
                btnCalculate.click();

                // Čekání na vygenerování Launch Group tlačítka
                setTimeout(() => {
                    const btnLaunch = $("#sendMass[value*='" + langShinko[8] + "1']").first();
                    if (btnLaunch.length) {
                        console.log("Ghost Mode: Launching Group 1...");
                        btnLaunch.click();
                    } else {
                        // Zkusíme najít tlačítko v nově vytvořeném okně massScavengeFinal
                        const btnFinal = $("#massScavengeFinal #sendMass").first();
                        if (btnFinal.length) btnFinal.click();
                    }
                }, 1500);
            }
        }, 1000);
    }
}

// Původní kód scriptu (zkráceno pro přehlednost v odpovědi, ale v praxi běží celý)
serverTimeTemp = $("#serverDate")[0].innerText + " " + $("#serverTime")[0].innerText;
serverTime = serverTimeTemp.match(/^([0][1-9]|[12][0-9]|3[01])[\/\-]([0][1-9]|1[012])[\/\-](\d{4})( (0?[0-9]|[1][0-9]|[2][0-3])[:]([0-5][0-9])([:]([0-5][0-9]))?)?$/);
serverDate = Date.parse(serverTime[3] + "/" + serverTime[2] + "/" + serverTime[1] + serverTime[4]);
var is_mobile = !!navigator.userAgent.match(/iphone|android|blackberry/ig) || false;
var scavengeInfo;
var tempElementSelection="";

if (window.location.href.indexOf('screen=place&mode=scavenge_mass') < 0) {
    window.location.assign(game_data.link_base_pure + "place&mode=scavenge_mass");
}

$("#massScavengeSophie").remove();

var langShinko = [
    "Mass scavenging",
    "Select unit types/ORDER to scavenge with (drag units to order)",
    "Select categories to use",
    "When do you want your scav runs to return (approximately)?",
    "Runtime here",
    "Calculate runtimes for each page",
    "Creator: ",
    "Mass scavenging: send per 50 villages",
    "Launch group "
];

// ... (zbytek původního kódu pro nastavení LocalStorage, barev a UI) ...
// [Zde se vkládá celá logika UI z tvého původního scriptu]

// Spuštění Ghost Mode odpočtu po vykreslení UI
setTimeout(startGhostMode, 1000);
