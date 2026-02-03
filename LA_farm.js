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
    let vUnits = {}; // Virtuální počítadlo jednotek

    const getTemplate = (id) => {
        const row = document.querySelector(`#content_value table.vis:nth-of-type(1) tr:nth-of-type(${id+1})`);
        if (!row) return null;
        return {
            spear: parseInt(row.querySelector('input[name="spear"]')?.value) || 0,
            sword: parseInt(row.querySelector('input[name="sword"]')?.value) || 0,
            axe: parseInt(row.querySelector('input[name="axe"]')?.value) || 0,
            spy: parseInt(row.querySelector('input[name="spy"]')?.value) || 0,
            light: parseInt(row.querySelector('input[name="light"]')?.value) || 0,
            heavy: parseInt(row.querySelector('input[name="heavy"]')?.value) || 0,
            archer: parseInt(row.querySelector('input[name="archer"]')?.value) || 0,
            marcher: parseInt(row.querySelector('input[name="marcher"]')?.value) || 0,
            knight: parseInt(row.querySelector('input[name="knight"]')?.value) || 0
        };
    };

    const panel = document.createElement("div");
    panel.id = "farm-bot-panel";
    panel.style = "background: #e3d5b8; border: 2px solid #7d510f; padding: 10px; margin: 10px 0; font-family: Verdana,Arial,sans-serif;";
    panel.innerHTML = `
        <h3 style="margin-top:0">Farm Bot v0.92</h3>
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

    const loadLiveUnits = () => {
        vUnits = {
            spear: parseInt(document.getElementById("spear")?.innerText) || 0,
            sword: parseInt(document.getElementById("sword")?.innerText) || 0,
            axe: parseInt(document.getElementById("axe")?.innerText) || 0,
            archer: parseInt(document.getElementById("archer")?.innerText) || 0,
            spy: parseInt(document.getElementById("spy")?.innerText) || 0,
            light: parseInt(document.getElementById("light")?.innerText) || 0,
            marcher: parseInt(document.getElementById("marcher")?.innerText) || 0,
            heavy: parseInt(document.getElementById("heavy")?.innerText) || 0,
            knight: parseInt(document.getElementById("knight")?.innerText) || 0
        };
        console.log("[Bot] Jednotky načteny:", vUnits);
    };

    const triggerSwitch = () => {
        if (switchSpeed > 0 && !stop) {
            console.log(`%c[Bot] Hotovo. Přepínám za ${switchSpeed}s...`, "color: blue");
            setTimeout(() => {
                const next = document.querySelector('.arrowRight') || document.querySelector('.groupRight');
                if (next) next.click(); else window.location.reload();
            }, switchSpeed * 1000);
        }
    };

    const startFarming = () => {
        if (stop || isProcessing) return;
        isProcessing = true;
        loadLiveUnits();
        
        const templA = getTemplate(1);
        const templB = getTemplate(2);
        const rows = Array.from(document.querySelectorAll("#plunder_list tbody tr[id^='village_']"));

        const processRow = (idx) => {
            if (stop || idx >= rows.length) {
                triggerSwitch();
                isProcessing = false;
                return;
            }

            const row = rows[idx];
            const dist = parseFloat(row.cells[7]?.innerText) || 999;
            const wall = row.cells[6]?.innerText.trim();
            const wallLvl = wall === "?" ? 0 : (parseInt(wall) || 0);

            // Kontrola zdi
            if (wall !== "?" && wallLvl > wallLimit) return processRow(idx + 1);

            let type = "";
            let cost = null;
            let maxD = 0;

            const canFit = (t) => Object.keys(t).every(u => vUnits[u] >= t[u]);

            if (canFit(templA) && maxDistanceA > 0 && dist <= maxDistanceA) {
                type = "a"; cost = templA; maxD = maxDistanceA;
            } else if (canFit(templB) && maxDistanceB > 0 && dist <= maxDistanceB) {
                type = "b"; cost = templB; maxD = maxDistanceB;
            } else if (maxDistanceC > 0 && dist <= maxDistanceC && (vUnits.light > 0 || vUnits.heavy > 0 || vUnits.axe > 0)) {
                type = "c"; cost = null; maxD = maxDistanceC;
            }

            const btn = row.querySelector(`.farm_icon_${type}`);
            const isAttacking = row.querySelector('img.tooltip[src*="attack.png"]');

            if (type && btn && !btn.classList.contains('disabled') && !isAttacking) {
                let wait = Math.floor(Math.random() * 100 + 450);
                setTimeout(() => {
                    if (!stop) {
                        btn.click();
                        if (cost) Object.keys(cost).forEach(u => vUnits[u] -= cost[u]);
                        console.log(`%c[Bot] Útok ${type.toUpperCase()} odeslán (${dist} polí)`, "color: green");
                        processRow(idx + 1);
                    }
                }, wait);
            } else {
                if (!type && idx < 5) { // Pokud hned na začátku nemáme jednotky ani na A/B/C
                    console.log("%c[Bot] Nedostatek jednotek pro další útoky.", "color: orange");
                    triggerSwitch();
                    isProcessing = false;
                    return;
                }
                processRow(idx + 1);
            }
        };
        processRow(0);
    };

    document.getElementById("start-stop").onclick = () => {
        stop = !stop; localStorage.stop = stop; updateUI();
        if (!stop) startFarming();
    };

    const save = (id, key) => { localStorage.setItem(key, parseInt(document.getElementById(id).value)); console.log(`[Bot] Uloženo: ${key}`); };
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
