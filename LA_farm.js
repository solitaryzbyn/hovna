// ==UserScript==
// @name         Farm Bot - Dark Crimson Edition
// @namespace    http://tampermonkey.net/
// @version      0.139
// @description  Stealth farm bot for Tribal Wars with background stability and Dark Crimson UI.
// @author       TheBrain
// @match        *.divokekmeny.cz/game.php?*screen=am_farm*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=divokekmeny.cz
// @grant        none
// ==/UserScript==

/**
 * CHANGELOG v0.139:
 * [✓] Stealth Heartbeat implementation for background stability
 * [✓] Fixed multi-refresh issues during village switching
 * [✓] Dark Crimson UI with "Powered by TheBrain🧠" signature
 * [✓] Dynamic attack intervals (+/- 20%) to prevent detection
 * [✓] Improved starting village detection
 */

(async () => {
    'use strict';

    if (document.getElementById("farm-bot-panel")) return;

    // --- Configuration & State ---
    let cfg = {
        distA: parseInt(localStorage.maxDistanceA) || 0,
        swSpeed: parseInt(localStorage.switchSpeed) || 0,
        atkSpeed: parseInt(localStorage.speed) || 500,
        wallLimit: parseInt(localStorage.wallLimit) || 0,
        minWait: parseInt(localStorage.minWait) || 45,
        maxWait: parseInt(localStorage.maxWait) || 65,
        stop: localStorage.stop === "false" ? false : true,
        isWaiting: localStorage.isWaiting === "true"
    };

    let isRunning = false;
    const wait = (ms) => new Promise(res => setTimeout(res, ms));
    const urlParams = new URLSearchParams(window.location.search);

    // --- Stealth Heartbeat (Keeps tab active locally) ---
    setInterval(() => {
        if (!cfg.stop) {
            localStorage.setItem('bot_keepalive', Date.now());
        }
    }, 5000);

    // --- Priority Page Reset ---
    if (localStorage.needsPageReset === "true") {
        if (urlParams.get('Farm_page') !== '0') {
            localStorage.needsPageReset = "false";
            urlParams.set('Farm_page', '0');
            window.location.href = window.location.pathname + "?" + urlParams.toString();
            return; 
        } else {
            localStorage.needsPageReset = "false";
        }
    }

    // --- Cycle End Logic (Village Tracking) ---
    const currentId = urlParams.get("village");
    let visitedVillages = JSON.parse(localStorage.getItem("visitedVillages") || "[]");

    if (!cfg.stop && !cfg.isWaiting) {
        if (!visitedVillages.includes(currentId)) {
            visitedVillages.push(currentId);
            localStorage.setItem("visitedVillages", JSON.stringify(visitedVillages));
        } else if (visitedVillages.length > 1 && visitedVillages[0] === currentId) {
            localStorage.setItem("visitedVillages", "[]");
            const minutes = Math.floor(Math.random() * (cfg.maxWait - cfg.minWait + 1)) + cfg.minWait;
            localStorage.nextStartTime = Date.now() + (minutes * 60 * 1000);
            localStorage.isWaiting = "true";
            cfg.isWaiting = true;
        }
    }

    const getLiveUnits = () => {
        const units = ["spy", "light"];
        let current = {};
        units.forEach(u => {
            const el = document.getElementById(u);
            current[u] = el ? parseInt(el.innerText) : 0;
        });
        return current;
    };

    const getTemplate = () => {
        const row = document.querySelector(`#content_value table.vis:nth-of-type(1) tr:nth-of-type(2)`);
        return {
            spy: parseInt(row.querySelector('input[name="spy"]')?.value) || 0,
            light: parseInt(row.querySelector('input[name="light"]')?.value) || 0
        };
    };

    // --- UI Construction (Dark Crimson) ---
    const panel = document.createElement("div");
    panel.id = "farm-bot-panel";
    panel.style = "background: #2b0000; border: 2px solid #8b0000; color: #ffcccc; padding: 12px; margin: 10px 0; font-family: Verdana,Arial,sans-serif; font-size: 12px; border-radius: 4px; box-shadow: 0 4px 8px rgba(0,0,0,0.5);";
    panel.innerHTML = `
        <h3 style="margin-top:0; border-bottom: 1px solid #8b0000; padding-bottom: 5px; color: #ff4d4d;">Farm Bot v0.139</h3>
        <p id="bot-status" style="font-weight:bold; color: #ff8080;">Stav: Inicializace...</p>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
            <p style="margin:0;">Max. dist. A: <input id='inA' value='${cfg.distA}' style='width:30px; background:#4d0000; border:1px solid #8b0000; color:white;'></p>
            <p style="margin:0;">Limit zdi: <input id='inW' value='${cfg.wallLimit}' style='width:30px; background:#4d0000; border:1px solid #8b0000; color:white;'></p>
            <p style="margin:0;">Přepnout (s): <input id='inSw' value='${cfg.swSpeed}' style='width:30px; background:#4d0000; border:1px solid #8b0000; color:white;'></p>
            <p style="margin:0;">Prodleva (ms): <input id='inAtk' value='${cfg.atkSpeed}' style='width:40px; background:#4d0000; border:1px solid #8b0000; color:white;'></p>
            <p style="margin:0;">Čekat Min (m): <input id='inMinW' value='${cfg.minWait}' style='width:30px; background:#4d0000; border:1px solid #8b0000; color:white;'></p>
            <p style="margin:0;">Čekat Max (m): <input id='inMaxW' value='${cfg.maxWait}' style='width:30px; background:#4d0000; border:1px solid #8b0000; color:white;'></p>
        </div>
        <button id='save-all' class='btn' style='width:100%; margin-bottom:10px; background:#660000; color:white; border:1px solid #8b0000; cursor:pointer;'>Uložit nastavení</button>
        <div style="margin-top:5px; border-top:1px solid #8b0000; padding-top:10px; display: flex; justify-content: space-between;">
            <button id='start-stop' class='btn' style='font-weight:bold; min-width:140px; height:32px; border:none; border-radius:3px; cursor:pointer;'></button>
            <button id='reset-cycle' class='btn' style='background:#444; color:white; border:none; padding: 0 10px; cursor:pointer;'>Reset cyklu</button>
        </div>
        <p style="margin-top:10px; font-size: 10px; text-align: center; color: #8b0000; font-style: italic;">Powered by TheBrain🧠</p>
    `;
    document.querySelector("#am_widget_Farm")?.parentNode.insertBefore(panel, document.querySelector("#am_widget_Farm"));

    const updateUI = (msg = "") => {
        const btn = document.getElementById("start-stop");
        if (btn) {
            btn.innerText = cfg.stop ? "SPUSTIT BOTA" : "ZASTAVIT BOTA";
            btn.style.background = cfg.stop ? "#4d0000" : "#a30000";
            btn.style.color = "white";
        }
        if (msg) document.getElementById("bot-status").innerText = "Stav: " + msg;
    };

    const startWaitCountdown = () => {
        const timer = setInterval(() => {
            const diff = localStorage.nextStartTime - Date.now();
            if (diff <= 0 || cfg.stop) {
                clearInterval(timer);
                localStorage.isWaiting = "false";
                localStorage.removeItem("nextStartTime");
                localStorage.setItem("visitedVillages", "[]");
                if (!cfg.stop) location.reload();
            } else {
                const m = Math.floor(diff / 60000);
                const s = Math.floor((diff % 60000) / 1000);
                updateUI(`KOLO DOKONČENO. ČEKÁM: ${m}m ${s}s`);
            }
        }, 1000);
    };

    const triggerVillageSwitch = () => {
        updateUI("Přepínám vesnici...");
        localStorage.needsPageReset = "true";
        setTimeout(() => {
            const nextVill = document.querySelector('.arrowRight') || document.querySelector('.groupRight');
            if (nextVill) nextVill.click(); else window.location.reload();
        }, cfg.swSpeed * 1000);
    };

    const run = async () => {
        if (cfg.stop || isRunning) return;
        if (cfg.isWaiting) { startWaitCountdown(); return; }

        isRunning = true;
        updateUI("Farmím...");
        const templ = getTemplate();
        const rows = Array.from(document.querySelectorAll("#plunder_list tbody tr[id^='village_']"));
        let lastDistOnPage = 0;
        let forceSwitch = false;

        const initialUnits = getLiveUnits();
        if (initialUnits.light < templ.light || initialUnits.spy < templ.spy) {
            triggerVillageSwitch();
            isRunning = false;
            return;
        }

        for (const row of rows) {
            if (cfg.stop || forceSwitch) break;
            const unitsBefore = getLiveUnits();
            if (unitsBefore.light < templ.light || unitsBefore.spy < templ.spy) {
                forceSwitch = true;
                break;
            }
            const dist = parseFloat(row.cells[7]?.innerText) || 999;
            lastDistOnPage = dist;
            if (dist > cfg.distA) break;
            const wall = parseInt(row.cells[6]?.innerText) || 0;
            if (row.cells[6]?.innerText !== "?" && wall > cfg.wallLimit) continue;
            const btnA = row.querySelector(".farm_icon_a");
            const isAttacking = row.querySelector('img.tooltip[src*="attack.png"]');

            if (btnA && !btnA.classList.contains('farm_icon_disabled') && !isAttacking) {
                const min = cfg.atkSpeed * 0.8;
                const max = cfg.atkSpeed * 1.2;
                const randomWait = Math.floor(Math.random() * (max - min + 1) + min);
                await wait(randomWait);

                btnA.click();
                
                let confirmed = false;
                for (let attempt = 0; attempt < 10; attempt++) {
                    await wait(150);
                    const unitsNow = getLiveUnits();
                    if (unitsNow.light < unitsBefore.light || unitsNow.spy < unitsBefore.spy) {
                        confirmed = true;
                        break;
                    }
                }
                if (!confirmed) { forceSwitch = true; break; }
            }
        }

        if (!cfg.stop) {
            if (forceSwitch) {
                triggerVillageSwitch();
            } else {
                const nav = Array.from(document.querySelectorAll(".paged-nav-item"));
                const currPage = urlParams.get('Farm_page') ? parseInt(urlParams.get('Farm_page')) : 0;
                const next = nav.find(l => l.href && l.href.includes(`Farm_page=${currPage + 1}`));
                if (next && lastDistOnPage <= cfg.distA) {
                    next.click();
                } else {
                    triggerVillageSwitch();
                }
            }
        }
        isRunning = false;
    };

    document.getElementById("start-stop").onclick = () => {
        cfg.stop = !cfg.stop; localStorage.stop = cfg.stop;
        if (cfg.stop) { 
            localStorage.setItem("visitedVillages", "[]");
            localStorage.isWaiting = "false";
            localStorage.removeItem("nextStartTime");
        }
        updateUI(); if (!cfg.stop) run();
    };

    document.getElementById("save-all").onclick = () => {
        localStorage.maxDistanceA = document.getElementById("inA").value;
        localStorage.wallLimit = document.getElementById("inW").value;
        localStorage.switchSpeed = document.getElementById("inSw").value;
        localStorage.speed = document.getElementById("inAtk").value;
        localStorage.minWait = document.getElementById("inMinW").value;
        localStorage.maxWait = document.getElementById("inMaxW").value;
        alert("Nastavení uloženo.");
        location.reload();
    };

    document.getElementById("reset-cycle").onclick = () => {
        localStorage.setItem("visitedVillages", "[]");
        localStorage.isWaiting = "false"; localStorage.removeItem("nextStartTime");
        localStorage.needsPageReset = "false"; location.reload();
    };

    updateUI(); if (!cfg.stop) run();
})();
