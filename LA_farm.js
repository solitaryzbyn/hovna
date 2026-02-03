(async (ModuleLoader) => {
    'use strict';

    // Ochrana proti vícenásobnému spuštění
    if (document.getElementById("farm-bot-panel")) {
        return;
    }

    // Dependency loading
    await ModuleLoader.loadModule('utils/notify-utils');

    // Controls the window title
    TwFramework.setIdleTitlePreffix('FARMING', document.title);

    // Načtení proměnných
    let maxDistanceA = parseInt(localStorage.maxDistanceA) || 0;
    let maxDistanceB = parseInt(localStorage.maxDistanceB) || 0;
    let maxDistanceC = parseInt(localStorage.maxDistanceC) || 0;
    let switchSpeed = parseInt(localStorage.switchSpeed) || 0;
    let speed = parseInt(localStorage.speed) || 500;
    let stop = localStorage.stop === "false" ? false : true; 
    
    let activeMaxDistance = 0;
    let currentTemplate = ""; // "a", "b" nebo "c"

    // Bezpečné čtení hodnot jednotek z šablon (vstupy uživatele)
    const getTemplateUnit = (rowIdx, unitName) => {
        const input = document.querySelector(`#content_value table.vis:nth-of-type(1) tr:nth-of-type(${rowIdx+1}) input[name="${unitName}"]`);
        return input ? parseInt(input.value) : 0;
    };

    // Vytvoření panelu
    const panel = document.createElement("div");
    panel.id = "farm-bot-panel";
    panel.style = "background: #e3d5b8; border: 2px solid #7d510f; padding: 10px; margin: 10px 0; font-family: Verdana,Arial,sans-serif;";
    panel.innerHTML = `
        <h3 style="margin-top:0">Farm Bot v0.4</h3>
        <p>Max. vzdálenost A: <input id='distInputA' value='${maxDistanceA}' style='width:35px'> <button id='btnA' class='btn'>Uložit</button></p>
        <p>Max. vzdálenost B: <input id='distInputB' value='${maxDistanceB}' style='width:35px'> <button id='btnB' class='btn'>Uložit</button></p>
        <p>Max. vzdálenost C: <input id='distInputC' value='${maxDistanceC}' style='width:35px'> <button id='btnC' class='btn'>Uložit</button></p>
        <p>Přepnout vesnici (s): <input id='swSpd' value='${switchSpeed}' style='width:40px'> <button id='btnSw' class='btn'>Uložit</button></p>
        <p>Prodleva útoků (ms): <input id='atkSpd' value='${speed}' style='width:40px'> <button id='btnSpd' class='btn'>Uložit</button></p>
        <div style="margin-top:10px; border-top:1px solid #7d510f; padding-top:10px;">
            <button id='start-stop' class='btn' style='font-weight:bold; min-width:120px; height:30px;'></button>
        </div>
    `;

    const anchor = document.querySelector("#am_widget_Farm") || document.querySelector("#content_value h3");
    if (anchor) anchor.parentNode.insertBefore(panel, anchor);

    const updateUI = () => {
        const btn = document.getElementById("start-stop");
        btn.innerText = stop ? "SPUSTIT BOTA" : "ZASTAVIT BOTA";
        btn.style.background = stop ? "#218838" : "#c82333";
        btn.style.color = "white";
    };

    const getAvailableUnits = () => ({
        spear: parseInt(document.getElementById("spear")?.innerText) || 0,
        sword: parseInt(document.getElementById("sword")?.innerText) || 0,
        axe: parseInt(document.getElementById("axe")?.innerText) || 0,
        spy: parseInt(document.getElementById("spy")?.innerText) || 0,
        light: parseInt(document.getElementById("light")?.innerText) || 0,
        heavy: parseInt(document.getElementById("heavy")?.innerText) || 0
    });

    const checkStrategy = () => {
        const units = getAvailableUnits();
        const templA = { spear: getTemplateUnit(1, "spear"), sword: getTemplateUnit(1, "sword"), axe: getTemplateUnit(1, "axe"), spy: getTemplateUnit(1, "spy"), light: getTemplateUnit(1, "light"), heavy: getTemplateUnit(1, "heavy") };
        const templB = { spear: getTemplateUnit(2, "spear"), sword: getTemplateUnit(2, "sword"), axe: getTemplateUnit(2, "axe"), spy: getTemplateUnit(2, "spy"), light: getTemplateUnit(2, "light"), heavy: getTemplateUnit(2, "heavy") };

        const canSend = (t) => Object.keys(t).every(u => units[u] >= t[u]);

        if (canSend(templA) && maxDistanceA > 0) {
            currentTemplate = "a";
            activeMaxDistance = maxDistanceA;
        } else if (canSend(templB) && maxDistanceB > 0) {
            currentTemplate = "b";
            activeMaxDistance = maxDistanceB;
        } else {
            currentTemplate = "c";
            activeMaxDistance = maxDistanceC;
        }
    };

    const startFarming = () => {
        if (stop) return;
        checkStrategy();
        
        const rows = document.querySelectorAll("#plunder_list tbody tr[id^='village_']");
        let counter = 0;

        rows.forEach((row) => {
            const dist = parseFloat(row.cells[7]?.innerText) || 999;
            const alreadyAttacking = row.querySelector('img.tooltip[src*="attack.png"]') || row.querySelector('img[src*="command/attack.png"]');

            if (dist <= activeMaxDistance && !alreadyAttacking) {
                const btn = row.querySelector(`.farm_icon_${currentTemplate}`);
                if (btn && !btn.classList.contains('disabled')) {
                    counter++;
                    let wait = (speed * counter) - Math.floor(Math.random() * 100 + 450);
                    setTimeout(() => {
                        if (!stop) {
                            btn.click();
                            console.log(`%c[Bot] Útok odeslán šablonou ${currentTemplate.toUpperCase()} na vzdálenost ${dist}`, "color: green");
                        }
                    }, wait);
                }
            }
        });
    };

    // Handlery
    document.getElementById("start-stop").onclick = () => {
        stop = !stop;
        localStorage.stop = stop;
        updateUI();
        if (!stop) {
            console.log("%c[Bot] Spuštěno", "color: blue");
            startFarming();
        }
    };

    document.getElementById("btnA").onclick = () => { maxDistanceA = parseInt(document.getElementById("distInputA").value); localStorage.maxDistanceA = maxDistanceA; alert("Uloženo A"); };
    document.getElementById("btnB").onclick = () => { maxDistanceB = parseInt(document.getElementById("distInputB").value); localStorage.maxDistanceB = maxDistanceB; alert("Uloženo B"); };
    document.getElementById("btnC").onclick = () => { maxDistanceC = parseInt(document.getElementById("distInputC").value); localStorage.maxDistanceC = maxDistanceC; alert("Uloženo C"); };
    document.getElementById("btnSpd").onclick = () => { speed = parseInt(document.getElementById("atkSpd").value); localStorage.speed = speed; alert("Rychlost uložena"); };
    document.getElementById("btnSw").onclick = () => { switchSpeed = parseInt(document.getElementById("swSpd").value); localStorage.switchSpeed = switchSpeed; alert("Přepínání uloženo"); };

    updateUI();
    if (!stop) setTimeout(startFarming, 1000);

    if (switchSpeed > 0) {
        setTimeout(() => {
            if (!stop) {
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
