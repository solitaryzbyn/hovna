(async (ModuleLoader) => {
    'use strict';

    if (document.getElementById("farm-bot-panel")) return;

    await ModuleLoader.loadModule('utils/notify-utils');
    TwFramework.setIdleTitlePreffix('FARMING', document.title);

    let maxDistanceA = parseInt(localStorage.maxDistanceA) || 0;
    let maxDistanceB = parseInt(localStorage.maxDistanceB) || 0;
    let maxDistanceC = parseInt(localStorage.maxDistanceC) || 0;
    let switchSpeed = parseInt(localStorage.switchSpeed) || 0;
    let speed = parseInt(localStorage.speed) || 500;
    let wallLimit = parseInt(localStorage.wallLimit) || 0;
    let stop = localStorage.stop === "false" ? false : true; 
    
    let isProcessing = false;
    let errorDetected = false;

    const getTemplateUnit = (rowIdx, unitName) => {
        const input = document.querySelector(`#content_value table.vis:nth-of-type(1) tr:nth-of-type(${rowIdx+1}) input[name="${unitName}"]`);
        return input ? parseInt(input.value) : 0;
    };

    const panel = document.createElement("div");
    panel.id = "farm-bot-panel";
    panel.style = "background: #e3d5b8; border: 2px solid #7d510f; padding: 10px; margin: 10px 0; font-family: Verdana,Arial,sans-serif;";
    panel.innerHTML = `
        <h3 style="margin-top:0">Farm Bot v0.9</h3>
        <p>Max. vzdálenost A: <input id='distInputA' value='${maxDistanceA}' style='width:35px'> <button id='btnA' class='btn'>Uložit</button></p>
        <p>Max. vzdálenost B: <input id='distInputB' value='${maxDistanceB}' style='width:35px'> <button id='btnB' class='btn'>Uložit</button></p>
        <p>Max. vzdálenost C: <input id='distInputC' value='${maxDistanceC}' style='width:35px'> <button id='btnC' class='btn'>Uložit</button></p>
        <p>Limit opevnění (max): <input id='wallInput' value='${wallLimit}' style='width:35px'> <button id='btnWall' class='btn'>Uložit</button></p>
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

    const triggerSwitch = () => {
        if (switchSpeed > 0 && !stop) {
            console.log(`%c[Bot] Iniciuji přepnutí na další vesnici...`, "color: blue");
            setTimeout(() => {
                if (!stop) {
                    const next = document.querySelector('.arrowRight') || document.querySelector('.groupRight');
                    if (next) next.click(); else window.location.reload();
                }
            }, switchSpeed * 1000);
        }
    };

    // Sledování chybových zpráv přímo v UI hry
    const observeErrors = () => {
        const errorBox = document.querySelector('.error_box') || document.querySelector('#closable_box_content');
        if (errorBox && (errorBox.innerText.includes('jednotek') || errorBox.innerText.includes('maximálně'))) {
            if (!errorDetected) {
                errorDetected = true;
                console.log("%c[Bot] Hra hlásí nedostatek jednotek! Přepínám...", "color: red");
                triggerSwitch();
            }
        }
    };

    const startFarming = () => {
        if (stop || isProcessing) return;
        isProcessing = true;
        errorDetected = false;
        
        let units = getAvailableUnits();
        const templA = { spear: getTemplateUnit(1, "spear"), sword: getTemplateUnit(1, "sword"), axe: getTemplateUnit(1, "axe"), spy: getTemplateUnit(1, "spy"), light: getTemplateUnit(1, "light"), heavy: getTemplateUnit(1, "heavy") };
        const templB = { spear: getTemplateUnit(2, "spear"), sword: getTemplateUnit(2, "sword"), axe: getTemplateUnit(2, "axe"), spy: getTemplateUnit(2, "spy"), light: getTemplateUnit(2, "light"), heavy: getTemplateUnit(2, "heavy") };

        const rows = document.querySelectorAll("#plunder_list tbody tr[id^='village_']");
        let counter = 0;
        let lastTimeout = 0;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (stop || errorDetected) break;

            const wallCell = row.cells[6];
            if (wallCell) {
                const wallText = wallCell.innerText.trim();
                const wallLevel = wallText === "?" ? 0 : (parseInt(wallText) || 0);
                if (wallText !== "?" && wallLevel > wallLimit) continue;
            }

            let selectedTemplate = "";
            let currentMaxDist = 0;
            let currentCost = null;

            const canSend = (t) => Object.keys(t).every(u => units[u] >= t[u]);

            if (canSend(templA) && maxDistanceA > 0) {
                selectedTemplate = "a";
                currentMaxDist = maxDistanceA;
                currentCost = templA;
            } else if (canSend(templB) && maxDistanceB > 0) {
                selectedTemplate = "b";
                currentMaxDist = maxDistanceB;
                currentCost = templB;
            } else if (maxDistanceC > 0 && (units.light > 0 || units.heavy > 0 || units.axe > 0 || units.spy > 0)) { 
                selectedTemplate = "c";
                currentMaxDist = maxDistanceC;
                currentCost = null;
            } else {
                break; // Došlo vojsko dle virtuálního počtu
            }

            const dist = parseFloat(row.cells[7]?.innerText) || 999;
            const alreadyAttacking = row.querySelector('img.tooltip[src*="attack.png"]') || row.querySelector('img[src*="command/attack.png"]');

            if (dist <= currentMaxDist && !alreadyAttacking) {
                const btn = row.querySelector(`.farm_icon_${selectedTemplate}`);
                if (btn && !btn.classList.contains('disabled')) {
                    counter++;
                    if (currentCost) Object.keys(currentCost).forEach(u => units[u] -= currentCost[u]);

                    let wait = (speed * counter) - Math.floor(Math.random() * 100 + 450);
                    lastTimeout = Math.max(lastTimeout, wait);

                    setTimeout(() => {
                        if (!stop && !errorDetected) {
                            btn.click();
                            // Kontrola chyby hned po kliknutí
                            setTimeout(observeErrors, 100);
                        }
                    }, wait);
                }
            }
        }

        // Pokud nebylo co odeslat, přepni hned. Jinak počkej na doběhnutí timeoutů.
        if (counter === 0) {
            triggerSwitch();
        } else {
            setTimeout(() => {
                if (!errorDetected) triggerSwitch();
            }, lastTimeout + 1000);
        }
        
        isProcessing = false;
    };

    document.getElementById("start-stop").onclick = () => {
        stop = !stop;
        localStorage.stop = stop;
        updateUI();
        if (!stop) startFarming();
    };

    // Ukládání (opraveno na localStorage)
    const save = (id, key) => {
        let val = parseInt(document.getElementById(id).value);
        localStorage.setItem(key, val);
        console.log(`[Bot] ${key} uloženo: ${val}`);
    };

    document.getElementById("btnA").onclick = () => save("distInputA", "maxDistanceA");
    document.getElementById("btnB").onclick = () => save("distInputB", "maxDistanceB");
    document.getElementById("btnC").onclick = () => save("distInputC", "maxDistanceC");
    document.getElementById("btnWall").onclick = () => save("wallInput", "wallLimit");
    document.getElementById("btnSpd").onclick = () => save("atkSpd", "speed");
    document.getElementById("btnSw").onclick = () => save("swSpd", "switchSpeed");

    updateUI();
    if (!stop) setTimeout(startFarming, 1000);

})({
    loadModule: m => new Promise((res, rej) => {
        const url = `https://raw.githubusercontent.com/joaovperin/TribalWars/master/Modules/${m.replace('.', '/')}.js`;
        $.ajax({ method: "GET", url: url, dataType: "text" }).done(r => res(eval(r))).fail(() => rej());
    })
});
