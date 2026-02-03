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

    // Funkce pro čtení jednotek ze šablon
    const getTemplateUnit = (rowIdx, unitName) => {
        const input = document.querySelector(`#content_value table.vis:nth-of-type(1) tr:nth-of-type(${rowIdx+1}) input[name="${unitName}"]`);
        return input ? parseInt(input.value) : 0;
    };

    // UI Panel
    const panel = document.createElement("div");
    panel.id = "farm-bot-panel";
    panel.style = "background: #e3d5b8; border: 2px solid #7d510f; padding: 10px; margin: 10px 0; font-family: Verdana,Arial,sans-serif;";
    panel.innerHTML = `
        <h3 style="margin-top:0">Farm Bot v0.91</h3>
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

    // Funkce pro real-time kontrolu jednotek přímo z DOMu hry
    const getLiveUnits = () => ({
        spear: parseInt(document.getElementById("spear")?.innerText) || 0,
        sword: parseInt(document.getElementById("sword")?.innerText) || 0,
        axe: parseInt(document.getElementById("axe")?.innerText) || 0,
        spy: parseInt(document.getElementById("spy")?.innerText) || 0,
        light: parseInt(document.getElementById("light")?.innerText) || 0,
        heavy: parseInt(document.getElementById("heavy")?.innerText) || 0
    });

    const triggerSwitch = () => {
        if (switchSpeed > 0 && !stop) {
            console.log(`%c[Bot] Končím v této vsi. Přepínám za ${switchSpeed}s...`, "color: blue");
            setTimeout(() => {
                if (!stop) {
                    const next = document.querySelector('.arrowRight') || document.querySelector('.groupRight');
                    if (next) next.click(); else window.location.reload();
                }
            }, switchSpeed * 1000);
        }
    };

    const startFarming = () => {
        if (stop || isProcessing) return;
        isProcessing = true;
        
        const templA = { spear: getTemplateUnit(1, "spear"), sword: getTemplateUnit(1, "sword"), axe: getTemplateUnit(1, "axe"), spy: getTemplateUnit(1, "spy"), light: getTemplateUnit(1, "light"), heavy: getTemplateUnit(1, "heavy") };
        const templB = { spear: getTemplateUnit(2, "spear"), sword: getTemplateUnit(2, "sword"), axe: getTemplateUnit(2, "axe"), spy: getTemplateUnit(2, "spy"), light: getTemplateUnit(2, "light"), heavy: getTemplateUnit(2, "heavy") };

        const rows = Array.from(document.querySelectorAll("#plunder_list tbody tr[id^='village_']"));
        let counter = 0;
        let lastActionTime = 0;

        // Pomocná funkce pro postupné odesílání
        const processRow = (index) => {
            if (stop || index >= rows.length) {
                setTimeout(triggerSwitch, 500);
                isProcessing = false;
                return;
            }

            const row = rows[index];
            const liveUnits = getLiveUnits();
            
            // Kontrola opevnění
            const wallCell = row.cells[6];
            if (wallCell) {
                const wallText = wallCell.innerText.trim();
                const wallLevel = wallText === "?" ? 0 : (parseInt(wallText) || 0);
                if (wallText !== "?" && wallLevel > wallLimit) return processRow(index + 1);
            }

            let selectedTemplate = "";
            let currentMaxDist = 0;

            const canSend = (t) => Object.keys(t).every(u => liveUnits[u] >= t[u]);

            if (canSend(templA) && maxDistanceA > 0) {
                selectedTemplate = "a";
                currentMaxDist = maxDistanceA;
            } else if (canSend(templB) && maxDistanceB > 0) {
                selectedTemplate = "b";
                currentMaxDist = maxDistanceB;
            } else if (maxDistanceC > 0 && (liveUnits.light > 0 || liveUnits.heavy > 0 || liveUnits.axe > 0 || liveUnits.spy > 0)) { 
                selectedTemplate = "c";
                currentMaxDist = maxDistanceC;
            }

            const dist = parseFloat(row.cells[7]?.innerText) || 999;
            const alreadyAttacking = row.querySelector('img.tooltip[src*="attack.png"]') || row.querySelector('img[src*="command/attack.png"]');

            if (selectedTemplate && dist <= currentMaxDist && !alreadyAttacking) {
                const btn = row.querySelector(`.farm_icon_${selectedTemplate}`);
                if (btn && !btn.classList.contains('disabled')) {
                    counter++;
                    let wait = Math.floor(Math.random() * (550 - 450 + 1) + 450);
                    
                    setTimeout(() => {
                        if (!stop) {
                            btn.click();
                            console.log(`%c[Bot] Útok odeslán (${selectedTemplate.toUpperCase()}) | Vzdálenost: ${dist}`, "color: green");
                            processRow(index + 1); // Jdeme na další řádek až po kliknutí
                        }
                    }, wait);
                    return;
                }
            }
            // Pokud řádek nevyhovuje, jdeme hned na další
            processRow(index + 1);
        };

        processRow(0);
    };

    document.getElementById("start-stop").onclick = () => {
        stop = !stop;
        localStorage.stop = stop;
        updateUI();
        if (!stop) {
            console.log("%c[Bot] Spuštěno", "color: blue");
            startFarming();
        }
    };

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
