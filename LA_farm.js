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

    const getTemplateUnit = (rowIdx, unitName) => {
        const input = document.querySelector(`#content_value table.vis:nth-of-type(1) tr:nth-of-type(${rowIdx+1}) input[name="${unitName}"]`);
        return input ? parseInt(input.value) : 0;
    };

    const panel = document.createElement("div");
    panel.id = "farm-bot-panel";
    panel.style = "background: #e3d5b8; border: 2px solid #7d510f; padding: 10px; margin: 10px 0; font-family: Verdana,Arial,sans-serif;";
    panel.innerHTML = `
        <h3 style="margin-top:0">Farm Bot v0.8</h3>
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
            console.log(`%c[Bot] Vojsko došlo nebo seznam dokončen. Přepínám za ${switchSpeed}s...`, "color: blue");
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
        
        let units = getAvailableUnits();
        const templA = { spear: getTemplateUnit(1, "spear"), sword: getTemplateUnit(1, "sword"), axe: getTemplateUnit(1, "axe"), spy: getTemplateUnit(1, "spy"), light: getTemplateUnit(1, "light"), heavy: getTemplateUnit(1, "heavy") };
        const templB = { spear: getTemplateUnit(2, "spear"), sword: getTemplateUnit(2, "sword"), axe: getTemplateUnit(2, "axe"), spy: getTemplateUnit(2, "spy"), light: getTemplateUnit(2, "light"), heavy: getTemplateUnit(2, "heavy") };

        const rows = document.querySelectorAll("#plunder_list tbody tr[id^='village_']");
        let counter = 0;
        let totalWait = 0;
        let canStillAttack = true;

        rows.forEach((row) => {
            if (stop || !canStillAttack) return;

            const wallCell = row.cells[6];
            if (wallCell) {
                const wallText = wallCell.innerText.trim();
                const wallLevel = wallText === "?" ? 0 : (parseInt(wallText) || 0);
                if (wallText !== "?" && wallLevel > wallLimit) return;
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
            } else if (maxDistanceC > 0 && (units.light > 0 || units.heavy > 0 || units.axe > 0)) { 
                selectedTemplate = "c";
                currentMaxDist = maxDistanceC;
                currentCost = null;
            } else {
                canStillAttack = false; // Došlo vojsko
                return;
            }

            const dist = parseFloat(row.cells[7]?.innerText) || 999;
            const alreadyAttacking = row.querySelector('img.tooltip[src*="attack.png"]') || row.querySelector('img[src*="command/attack.png"]');

            if (dist <= currentMaxDist && !alreadyAttacking) {
                const btn = row.querySelector(`.farm_icon_${selectedTemplate}`);
                if (btn && !btn.classList.contains('disabled')) {
                    counter++;
                    if (currentCost) Object.keys(currentCost).forEach(u => units[u] -= currentCost[u]);

                    let wait = (speed * counter) - Math.floor(Math.random() * 100 + 450);
                    totalWait = Math.max(totalWait, wait);

                    setTimeout(() => {
                        if (!stop) {
                            btn.click();
                            console.log(`%c[Bot] Útok odeslán (${selectedTemplate.toUpperCase()}) | Vzdálenost: ${dist}`, "color: green");
                        }
                    }, wait);
                }
            }
        });

        // Opravená logika přepnutí: pokud nebyly naplánovány žádné útoky (protože došlo vojsko), přepni hned
        if (counter === 0) {
            triggerSwitch();
        } else {
            // Pokud se útočilo, počkej na poslední útok a pak přepni
            setTimeout(triggerSwitch, totalWait + 500);
        }
        
        isProcessing = false;
    };

    document.getElementById("start-stop").onclick = () => {
        stop = !stop;
        localStorage.stop = stop;
        updateUI();
        if (!stop) startFarming();
    };

    document.getElementById("btnA").onclick = () => { maxDistanceA = parseInt(document.getElementById("distInputA").value); localStorage.maxDistanceA = maxDistanceA; };
    document.getElementById("btnB").onclick = () => { maxDistanceB = parseInt(document.getElementById("distInputB").value); localStorage.maxDistanceB = maxDistanceB; };
    document.getElementById("btnC").onclick = () => { maxDistanceC = parseInt(document.getElementById("distInputC").value); localStorage.maxDistanceC = maxDistanceC; };
    document.getElementById("btnWall").onclick = () => { wallLimit = parseInt(document.getElementById("wallInput").value); localStorage.wallLimit = wallLimit; };
    document.getElementById("btnSpd").onclick = () => { speed = parseInt(document.getElementById("atkSpd").value); localStorage.speed = speed; };
    document.getElementById("btnSw").onclick = () => { switchSpeed = parseInt(document.getElementById("swSpd").value); localStorage.switchSpeed = switchSpeed; };

    updateUI();
    if (!stop) setTimeout(startFarming, 1000);

})({
    loadModule: m => new Promise((res, rej) => {
        const url = `https://raw.githubusercontent.com/joaovperin/TribalWars/master/Modules/${m.replace('.', '/')}.js`;
        $.ajax({ method: "GET", url: url, dataType: "text" }).done(r => res(eval(r))).fail(() => rej());
    })
});
