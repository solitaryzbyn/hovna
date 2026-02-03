(async (ModuleLoader) => {
    'use strict';

    // Ochrana proti vícenásobnému spuštění - pokud panel existuje, skript se ukončí
    if (document.getElementById("farm-bot-panel")) {
        console.log("%c[Bot] Panel již existuje, nespouštím znovu.", "color: orange");
        return;
    }

    // Dependency loading
    await ModuleLoader.loadModule('utils/notify-utils');

    // Controls the window title
    TwFramework.setIdleTitlePreffix('FARMING', document.title);

    // Načtení proměnných z localStorage
    let maxDistanceA = parseInt(localStorage.maxDistanceA) || 0;
    let maxDistanceB = parseInt(localStorage.maxDistanceB) || 0;
    let maxDistanceC = parseInt(localStorage.maxDistanceC) || 0;
    let maxDistance = maxDistanceA;
    let switchSpeed = parseInt(localStorage.switchSpeed) || 0;
    let speed = parseInt(localStorage.speed) || 500;
    let stop = localStorage.stop === "false" ? false : true; // Defaultně zastaveno
    
    let butABoo, butBBoo, removeUnitsFrom, farmButton;
    let x = 0;

    // Pomocná funkce pro bezpečné čtení hodnot z inputů (oprava chyby z konzole)
    const getUnitValue = (formIdx, unitName) => {
        const input = document.querySelector(`#content_value form:nth-of-type(${formIdx}) input[name="${unitName}"]`);
        return input ? parseInt(input.value) : 0;
    };

    // Vytvoření ovládacího panelu
    const distanceInputDiv = document.createElement("div");
    distanceInputDiv.id = "farm-bot-panel";
    distanceInputDiv.style = "background: #e3d5b8; border: 2px solid #7d510f; padding: 10px; margin: 10px 0; font-family: Verdana,Arial,sans-serif;";
    
    distanceInputDiv.innerHTML = `
        <h3 style="margin-top:0">Farm Bot v0.3</h3>
        <p>Max. vzdálenost A: <input id='distInputA' value='${maxDistanceA}' style='width:35px'> <button id='buttonDistA' class='btn'>Uložit</button> <span id='textA'></span></p>
        <p>Max. vzdálenost B: <input id='distInputB' value='${maxDistanceB}' style='width:35px'> <button id='buttonDistB' class='btn'>Uložit</button> <span id='textB'></span></p>
        <p>Max. vzdálenost C: <input id='distInputC' value='${maxDistanceC}' style='width:35px'> <button id='buttonDistC' class='btn'>Uložit</button> <span id='textC'></span></p>
        <p>Přepnout vesnici (s): <input id='switchSpeed' value='${switchSpeed}' style='width:40px'> <button id='switchSpeedOk' class='btn'>Uložit</button> <span id='textSwitch'></span></p>
        <p>Prodleva útoků (ms): <input id='speed' value='${speed}' style='width:40px'> <button id='speedOk' class='btn'>Uložit</button> <span id='textSpeed'></span></p>
        <div style="margin-top:10px; border-top:1px solid #7d510f; padding-top:10px;">
            <button id='start-stop' class='btn' style='font-weight:bold; min-width:120px; height:30px;'></button>
        </div>
    `;

    const anchor = document.querySelector("#am_widget_Farm") || document.querySelector("#content_value h3");
    if (anchor) anchor.parentNode.insertBefore(distanceInputDiv, anchor);

    // Definice šablon (bezpečné načtení)
    let farmA = { spear: getUnitValue(1, "spear"), sword: getUnitValue(1, "sword"), axe: getUnitValue(1, "axe"), spy: getUnitValue(1, "spy"), light: getUnitValue(1, "light"), heavy: getUnitValue(1, "heavy") };
    let farmB = { spear: getUnitValue(2, "spear"), sword: getUnitValue(2, "sword"), axe: getUnitValue(2, "axe"), spy: getUnitValue(2, "spy"), light: getUnitValue(2, "light"), heavy: getUnitValue(2, "heavy") };

    // Načtení vojska v aktuální vsi
    const getVillUnit = (id) => parseInt(document.getElementById(id)?.innerText) || 0;
    let unitInVill = { spear: getVillUnit("spear"), sword: getVillUnit("sword"), axe: getVillUnit("axe"), spy: getVillUnit("spy"), light: getVillUnit("light"), heavy: getVillUnit("heavy") };

    const updateStatus = () => {
        const btn = document.getElementById("start-stop");
        if (stop) {
            btn.innerText = "SPUSTIT BOTA";
            btn.style.background = "#218838";
            btn.style.color = "white";
        } else {
            btn.innerText = "ZASTAVIT BOTA";
            btn.style.background = "#c82333";
            btn.style.color = "white";
        }
    };

    const checkUnits = () => {
        const hasUnits = (templ) => Object.keys(templ).every(u => unitInVill[u] >= templ[u]);
        butABoo = hasUnits(farmA);
        butBBoo = hasUnits(farmB);

        if (butABoo && $('#am_widget_Farm a.farm_icon_a').length > 0 && maxDistanceA > 0) {
            farmButton = $('#am_widget_Farm a.farm_icon_a');
            maxDistance = maxDistanceA;
            removeUnitsFrom = farmA;
        } else if (butBBoo && $('#am_widget_Farm a.farm_icon_b').length > 0 && maxDistanceB > 0) {
            farmButton = $('#am_widget_Farm a.farm_icon_b');
            maxDistance = maxDistanceB;
            removeUnitsFrom = farmB;
        } else {
            farmButton = $('#am_widget_Farm a.farm_icon_c');
            maxDistance = maxDistanceC;
            removeUnitsFrom = null;
        }
    };

    const startFarming = () => {
        if (stop) return;
        const rows = document.querySelectorAll("#plunder_list > tbody > tr.row_a, #plunder_list > tbody > tr.row_b");
        
        rows.forEach((row, i) => {
            const dist = parseFloat(row.cells[7]?.innerText) || 999;
            if (dist <= maxDistance) {
                const btn = $(row).find(farmButton.selector);
                if (btn.length && !row.querySelector('img.tooltip')) {
                    let wait = (speed * ++x) - Math.floor(Math.random() * (550 - 450 + 1) + 450);
                    setTimeout(() => {
                        if (!stop) {
                            btn.click();
                            console.log(`%c[Bot] Útok odeslán na vzdálenost ${dist}`, "color: green");
                        }
                    }, wait);
                }
            }
        });
    };

    // Eventy tlačítek
    document.getElementById("start-stop").onclick = () => {
        stop = !stop;
        localStorage.stop = stop;
        updateStatus();
        if (!stop) {
            console.log("%c[Bot] Bot byl spuštěn", "color: blue");
            checkUnits();
            startFarming();
        } else {
            console.log("%c[Bot] Bot byl zastaven", "color: orange");
        }
    };

    $("#buttonDistA").click(() => { maxDistanceA = parseInt($("#distInputA").val()); localStorage.maxDistanceA = maxDistanceA; $("#textA").text("Uloženo"); });
    $("#buttonDistB").click(() => { maxDistanceB = parseInt($("#distInputB").val()); localStorage.maxDistanceB = maxDistanceB; $("#textB").text("Uloženo"); });
    $("#buttonDistC").click(() => { maxDistanceC = parseInt($("#distInputC").val()); localStorage.maxDistanceC = maxDistanceC; $("#textC").text("Uloženo"); });
    $("#speedOk").click(() => { speed = parseInt($("#speed").val()); localStorage.speed = speed; $("#textSpeed").text("Uloženo"); });
    $("#switchSpeedOk").click(() => { switchSpeed = parseInt($("#switchSpeed").val()); localStorage.switchSpeed = switchSpeed; $("#textSwitch").text("Uloženo"); });

    // Inicializace
    updateStatus();
    if (!stop) startFarming();

    // Automatické přepínání vesnic
    if (switchSpeed > 0) {
        setTimeout(() => {
            if (!stop) {
                console.log("%c[Bot] Přepínám vesnici...", "color: blue");
                const next = document.querySelector('.arrowRight') || document.querySelector('.groupRight');
                if (next) next.click(); else window.location.reload();
            }
        }, switchSpeed * 1000);
    }

})({
    loadModule: m => new Promise((res, rej) => {
        const url = `https://raw.githubusercontent.com/joaovperin/TribalWars/master/Modules/${m.replace('.', '/')}.js`;
        $.ajax({ method: "GET", url: url, dataType: "text" }).done(r => res(eval(r))).fail(() => rej());
    })
});
