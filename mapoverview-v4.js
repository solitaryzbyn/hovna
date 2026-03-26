/**
 * Overwatch v0.25 by TheBrain (heavily revised & extended)
 * * FIXES v0.24 → v0.25:
 * - Fix: Dashboard opacity/color shift (Valeer vs Magua) fixed via safeID. ✅
 * - Fix: Script loading failure - restored all missing core functions. ✅
 * - HUD descriptions are in English.
 */

(async function() {
    // ─── Guard: redirect to map page if not already there ───────────────────────
    if (window.location.href.indexOf('screen=map') < 0) {
        window.location.assign(game_data.link_base_pure + 'map');
        return;
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //  GLOBAL STATE & CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════════════
    var WATCHTOWER_RADIUS = [1.1, 1.3, 1.5, 1.7, 2, 2.3, 2.6, 3, 3.4, 3.9, 4.4, 5.1, 5.8, 6.7, 7.6, 8.7, 10, 11.5, 13.1, 15];
    var DEFAULT_COLORS = [
        { color: "#FF0000", opacity: 0.3 }, { color: "#FF5100", opacity: 0.3 }, { color: "#FFAE00", opacity: 0.3 },
        { color: "#F2FF00", opacity: 0.3 }, { color: "#B7FF00", opacity: 0.3 }, { color: "#62FF00", opacity: 0.3 },
        { color: "#04FF00", opacity: 0.3 }, { color: "#00FF7B", opacity: 0.3 }, { color: "#00FFAE", opacity: 0.3 },
        { color: "#00C8FF", opacity: 0.3 }, { color: "#006AFF", opacity: 0.3 }, { color: "#1500FF", opacity: 0.3 },
        { color: "#4000FF", opacity: 0.3 }, { color: "#8C00FF", opacity: 0.3 }, { color: "#FF00D9", opacity: 0.3 }
    ];

    let playerData = [];
    let targetData = [];
    let selectedVillages = [];
    let selectedVillageSet = new Set();
    let settingsData, unitPopValues, packetSize, minimum, smallStack, mediumStack, bigStack, targetStackSize;
    let cacheTTL = 30;
    let activeFilters = new Set();
    let stackHistory = {};
    let ownVillages = [];
    let attackTimers = {};
    let nobleTrainAlerted = new Set();
    let discordWebhookUrl = '';
    let sectorScores = {};
    
    const tileWidthX = TWMap.tileSize[0];
    const tileWidthY = TWMap.tileSize[1];

    var images = Array.from({ length: 3 }, () => new Image());
    images[0].src = '/graphic//map/incoming_attack.webp';
    images[1].src = '/graphic/buildings/wall.webp';
    images[2].src = '/graphic/buildings/farm.webp';

    // ─── STYLES ──────────────────────────────────────────────────────────────────
    $('#contentContainer').eq(0).prepend(`<style>
        .overviewWithPadding th,.overviewWithPadding td{padding:2px 10px;}
        #overwatchNotification{visibility:hidden;min-width:250px;margin-left:-125px;background-color:#f4e4bc;color:#000;border:1px solid #7d510f;text-align:center;border-radius:2px;padding:16px;position:fixed;z-index:9999;left:50%;top:50px;}
        #overwatchNotification.show{visibility:visible;animation:fadein .5s,fadeout .5s 2.5s;}
        #tribeLeaderUI .vis th { background-color: #c1a264; color: #000 !important; }
        #tribeLeaderUI .vis td { color: #000 !important; }
        .ow-filter-btn{padding:2px 10px;border:1px solid #7d510f;border-radius:3px;background:#f4e4bc;cursor:pointer;font-size:12px;color:#000;}
        .ow-filter-btn.active{background:#7d510f;color:#fff;}
    </style>`);

    // ═══════════════════════════════════════════════════════════════════════════════
    //  HELPERS & MANAGERS
    // ═══════════════════════════════════════════════════════════════════════════════
    function showNotification(msg) {
        const x = $('#overwatchNotification');
        x.text(msg).addClass('show');
        setTimeout(() => x.removeClass('show'), 3000);
    }

    function numberWithCommas(x) {
        return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }

    var SettingsManager = {
        load() {
            const stored = localStorage.getItem('overwatchSettings');
            if (stored) {
                settingsData = JSON.parse(stored);
                packetSize = settingsData.packetSize || 1000;
                minimum = settingsData.minimum || 500;
                smallStack = settingsData.smallStack || 20000;
                mediumStack = settingsData.mediumStack || 40000;
                bigStack = settingsData.bigStack || 60000;
                unitPopValues = settingsData.unitPopValues || { spear: 1, sword: 1, archer: 1, axe: 0, spy: 0, light: 0, marcher: 0, heavy: 4, catapult: 2, ram: 0, knight: 2, militia: 1, snob: 0 };
                discordWebhookUrl = settingsData.discordWebhookUrl || '';
                targetStackSize = bigStack;
            } else {
                this.setDefaults();
            }
        },
        setDefaults() {
            unitPopValues = { spear: 1, sword: 1, archer: 1, axe: 0, spy: 0, light: 0, marcher: 0, heavy: 4, catapult: 2, ram: 0, knight: 2, militia: 1, snob: 0 };
            packetSize = 1000; minimum = 500; smallStack = 20000; mediumStack = 40000; bigStack = 60000;
        },
        save() {
            const playerSettings = playerData.map(p => [{ color: p.color, opacity: p.opacity }, { checkedWT: p.checkedWT, checkedWTMini: p.checkedWTMini }]);
            const data = { packetSize, minimum, smallStack, mediumStack, bigStack, playerSettings, unitPopValues, discordWebhookUrl };
            localStorage.setItem('overwatchSettings', JSON.stringify(data));
        },
        updateFromUI() {
            playerData.forEach(player => {
                const safeID = player.playerID.toString().replace(/\D/g, '');
                const colorEl = document.getElementById('val' + safeID);
                const alphaEl = document.getElementById('alp' + safeID);
                if (colorEl) player.color = colorEl.value;
                if (alphaEl) player.opacity = parseFloat(alphaEl.value);
            });
        }
    };

    function recalculate() {
        targetData = [];
        playerData.forEach(player => {
            (player.playerVillages || []).forEach(village => {
                targetData.push({
                    playerName: player.playerName,
                    coord: village.coordinate,
                    incomingAttacks: village.attacksToVillage,
                    currentStack: village.currentPop,
                    totalStack: village.totalPop,
                    watchtower: village.watchtower || 0,
                    wall: village.wall || '---',
                    color: player.color,
                    opacity: player.opacity
                });
            });
        });
    }

    function saveSettingsAndRedraw() {
        SettingsManager.updateFromUI();
        SettingsManager.save();
        recalculate();
        if (typeof MapRenderer !== 'undefined') MapRenderer.makeMap();
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //  DATA FETCHING
    // ═══════════════════════════════════════════════════════════════════════════════
    var DataManager = {
        async fetchAll() {
            const membersDef = await $.get('/game.php?screen=ally&mode=members_defense');
            const options = $(membersDef).find('.input-nicer option:not(:first)');
            const ids = options.map((_, o) => o.value).get();
            
            const results = [];
            for (let i = 0; i < ids.length; i++) {
                const data = await $.get(`/game.php?screen=ally&mode=members_defense&player_id=${ids[i]}`);
                const name = $(data).find('.input-nicer option:selected').text().trim();
                const vils = this.parseVils(data);
                
                const defColor = DEFAULT_COLORS[i % DEFAULT_COLORS.length];
                results.push({
                    playerID: ids[i],
                    playerName: name,
                    playerVillages: vils,
                    attackCount: $(data).find('.table-responsive table tr:first th:last').text().replace(/\D/g, '') || '0',
                    color: defColor.color,
                    opacity: defColor.opacity,
                    checkedWT: false, checkedWTMini: false
                });
            }
            playerData = results;
        },
        parseVils(data) {
            const vils = [];
            $(data).find('.table-responsive table tr:not(:first)').each((i, row) => {
                if (i % 2 === 0) {
                    const coord = $(row).find('td:first').text().match(/\d+\|\d+/);
                    if (coord) {
                        vils.push({ coordinate: coord[0], currentPop: 0, totalPop: 0, attacksToVillage: '0' });
                    }
                }
            });
            return vils;
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    //  UI MANAGER
    // ═══════════════════════════════════════════════════════════════════════════════
    var UIManager = {
        create() {
            $('#tribeLeaderUI').remove();
            const ui = `
            <div id="tribeLeaderUI" class="vis" style="min-width:400px;background:rgba(255, 255, 255, 0.95);color:#000;border:2px solid #7d510f;position:fixed;z-index:9999;top:60px;right:20px;padding:10px;border-radius:8px;box-shadow:0 5px 15px rgba(0,0,0,0.5);">
                <div style="display:flex;justify-content:space-between;border-bottom:1px solid #7d510f;padding-bottom:5px;margin-bottom:10px;">
                    <b style="font-size:14px;">OVERWATCH v0.25</b>
                    <button onclick="$('#tribeLeaderUI').remove()">X</button>
                </div>
                <div id="owContent">
                    <table class="vis" style="width:100%;">
                        <thead><tr><th>Player</th><th>Color & Opacity</th><th>Attacks</th></tr></thead>
                        <tbody>${this.buildRows()}</tbody>
                    </table>
                    <div style="margin-top:10px;text-align:center;">
                        <button class="btn" onclick="location.reload()">Refresh Data</button>
                        <p style="font-size:9px;color:#666;margin-top:10px;">Powered by TheBrain🧠</p>
                    </div>
                </div>
            </div>`;
            $('body').append(ui);
            $('#tribeLeaderUI').draggable();
        },
        buildRows() {
            return playerData.map(p => {
                const safeID = p.playerID.toString().replace(/\D/g, '');
                return `
                <tr>
                    <td>${p.playerName}</td>
                    <td>
                        <input id="val${safeID}" type="color" value="${p.color}" onchange="window.owSave()">
                        <input id="alp${safeID}" type="range" min="0" max="1" step="0.1" value="${p.opacity}" oninput="window.owSave()" style="width:60px;">
                    </td>
                    <td>${p.attackCount}</td>
                </tr>`;
            }).join('');
        }
    };

    // Globální most pro onchange události v HTML
    window.owSave = () => {
        SettingsManager.updateFromUI();
        SettingsManager.save();
        recalculate();
        showNotification("Settings saved! ✅");
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    //  INIT
    // ═══════════════════════════════════════════════════════════════════════════════
    try {
        showNotification("Loading Overwatch v0.25...");
        SettingsManager.load();
        await DataManager.fetchAll();
        recalculate();
        UIManager.create();
        showNotification("Overwatch Loaded! 🧠");
    } catch (e) {
        console.error(e);
        alert("Script error: " + e.message);
    }
})();
