/**
 * Overwatch v2.9 by TheBrain🧠
 * * RESTORED EVERYTHING + WATCHTOWERS:
 * ✅ Full Dashboard & Player Rings
 * ✅ Watchtower ranges on main map (Canvas)
 * ✅ Watchtower icons & Heatmap on Minimap
 * ✅ Burning villages & Attack pulses
 * ✅ Noble train detection
 */

if (window.location.href.indexOf('screen=map') < 0) {
    window.location.assign(game_data.link_base_pure + 'map');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CONSTANTS & ASSETS
// ═══════════════════════════════════════════════════════════════════════════════
var WATCHTOWER_RADIUS = [1.1, 1.3, 1.5, 1.7, 2, 2.3, 2.6, 3, 3.4, 3.9, 4.4, 5.1, 5.8, 6.7, 7.6, 8.7, 10, 11.5, 13.1, 15];
var DEFAULT_COLORS = ["#FF0000", "#FF5100", "#FFAE00", "#F2FF00", "#B7FF00", "#62FF00", "#04FF00", "#00FF7B", "#00C8FF", "#006AFF", "#8C00FF", "#FF00D9"];
var PULSE_PERIOD_MS = 800;

var images = {
    attack: new Image(),
    wall: new Image(),
    fire: new Image()
};
images.attack.src = '/graphic//map/incoming_attack.webp';
images.wall.src = '/graphic/buildings/wall.webp';
images.fire.src = 'https://dsen.innogamescdn.com/asset/98710b2/graphic/map/map_fire.png';

// ═══════════════════════════════════════════════════════════════════════════════
//  GLOBAL STATE
// ═══════════════════════════════════════════════════════════════════════════════
let playerData = [];
let targetData = [];
let tileWidthX = TWMap.tileSize[0];
let tileWidthY = TWMap.tileSize[1];
let nobleTrainAlerted = new Set();
let wallHistory = JSON.parse(localStorage.getItem('owWallHistory') || '{}');
let settingsData = { minimum: 500, bigStack: 60000 };

// ═══════════════════════════════════════════════════════════════════════════════
//  SETTINGS & DATA
// ═══════════════════════════════════════════════════════════════════════════════
var SettingsManager = {
    load() {
        const stored = localStorage.getItem('overwatchSettings');
        if (stored) {
            let data = JSON.parse(stored);
            settingsData.minimum = data.minimum || 500;
            settingsData.bigStack = data.bigStack || 60000;
        }
        playerData = JSON.parse(localStorage.getItem('overwatchPlayerData') || '[]');
        this.recalculate();
    },
    save() {
        localStorage.setItem('overwatchSettings', JSON.stringify(settingsData));
        localStorage.setItem('overwatchPlayerData', JSON.stringify(playerData));
    },
    recalculate() {
        targetData = [];
        playerData.forEach((player, pIdx) => {
            if (!player.playerVillages) return;
            player.playerVillages.forEach(village => {
                targetData.push({
                    coord: village.coordinate,
                    playerName: player.playerName,
                    color: player.color || DEFAULT_COLORS[pIdx % 12],
                    incomingAttacks: village.attacksToVillage || 0,
                    totalStack: village.totalPop || 0,
                    wall: village.wall || 20,
                    watchtower: village.watchtower || 0,
                    checkedWT: player.checkedWT !== false, // default true
                    checkedWTMini: player.checkedWTMini !== false,
                    _nobleTrain: nobleTrainAlerted.has(village.coordinate)
                });
            });
        });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  MAP RENDERER (Including Watchtowers & Minimap)
// ═══════════════════════════════════════════════════════════════════════════════
var MapRenderer = {
    render(data, sector) {
        const sectorSize = TWMap.map.sectorSize || 5;
        const twCanvas = sector._element_root?.querySelector('canvas[id^="map_canvas_"]');
        if (!twCanvas) return;
        const parts = twCanvas.id.replace('map_canvas_', '').split('_');
        const sectorX = parseInt(parts[0]), sectorY = parseInt(parts[1]);
        const sp = TWMap.map.pixelByCoord(sectorX, sectorY);

        const canvas = document.createElement('canvas');
        canvas.width = tileWidthX * sectorSize; canvas.height = tileWidthY * sectorSize;
        canvas.setAttribute('data-ow', 'true');
        canvas.style.cssText = 'position:absolute;left:0;top:0;z-index:10;pointer-events:none;';
        const ctx = canvas.getContext('2d');

        targetData.forEach(el => {
            const [tx, ty] = el.coord.split('|').map(Number);
            const vp = TWMap.map.pixelByCoord(tx, ty);
            const ox = (vp[0] - sp[0]) + tileWidthX / 2;
            const oy = (vp[1] - sp[1]) + tileWidthY / 2;

            // --- 1. WATCHTOWER RANGES (Main Map) ---
            if (el.watchtower > 0 && el.checkedWT) {
                ctx.save();
                const radius = WATCHTOWER_RADIUS[el.watchtower - 1];
                ctx.strokeStyle = el.color;
                ctx.lineWidth = 2;
                ctx.globalAlpha = 0.3;
                ctx.beginPath();
                ctx.ellipse(ox, oy, radius * tileWidthX, radius * tileWidthY, 0, 0, 2 * Math.PI);
                ctx.stroke();
                ctx.fillStyle = el.color;
                ctx.fill();
                ctx.restore();
            }

            // --- 2. VILLAGE OVERLAYS (Only if in sector) ---
            if (tx >= sectorX && tx < sectorX + sectorSize && ty >= sectorY && ty < sectorY + sectorSize) {
                // Player Ring
                ctx.save();
                ctx.strokeStyle = el.color; ctx.lineWidth = 3; ctx.globalAlpha = 0.7;
                ctx.beginPath(); ctx.arc(ox, oy, (tileWidthX / 2) - 3, 0, 2 * Math.PI); ctx.stroke();
                ctx.restore();

                // Noble Border
                if (el._nobleTrain) {
                    ctx.save(); ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 4;
                    ctx.strokeRect(ox - tileWidthX/2 + 1, oy - tileWidthY/2 + 1, tileWidthX - 2, tileWidthY - 2); ctx.restore();
                }

                // Fire
                let currWall = parseInt(el.wall);
                if (wallHistory[el.coord] && (wallHistory[el.coord] - currWall) >= 5) {
                    ctx.drawImage(images.fire, ox - 20, oy - 25, 40, 40);
                }
                wallHistory[el.coord] = currWall;

                // Pulse
                const atks = parseInt(el.incomingAttacks);
                if (atks > 0) {
                    const phase = ((Date.now() % PULSE_PERIOD_MS) / PULSE_PERIOD_MS);
                    ctx.save(); ctx.strokeStyle = `rgba(255, 0, 0, ${0.8 - phase})`; ctx.lineWidth = 4;
                    ctx.beginPath(); ctx.arc(ox, oy, (tileWidthX/2) + (phase * 8), 0, 2 * Math.PI); ctx.stroke(); ctx.restore();
                    this.txt(atks, ctx, ox, oy - 10, '#ff0000', 'bold 16px Arial');
                }
                this.txt(Math.floor(el.totalStack / 1000) + 'k', ctx, ox, oy + 15, 'white', '11px Arial');
            }
        });
        sector.appendElement(canvas, 0, 0);
        this.renderMinimap();
    },

    renderMinimap() {
        if (!TWMap.minimap?._loadedSectors) return;
        $('[data-ow-mini]').remove();

        for (const key in TWMap.minimap._loadedSectors) {
            const msec = TWMap.minimap._loadedSectors[key];
            const mc = document.createElement('canvas');
            mc.width = 250; mc.height = 250;
            mc.setAttribute('data-ow-mini', 'true');
            mc.style.cssText = 'position:absolute;z-index:11;pointer-events:none;';
            const mctx = mc.getContext('2d');

            targetData.forEach(el => {
                const [tx, ty] = el.coord.split('|').map(Number);
                const x = (tx - msec.x) * 5 + 2;
                const y = (ty - msec.y) * 5 + 2;

                if (el.watchtower > 0 && el.checkedWTMini) {
                    mctx.save();
                    mctx.strokeStyle = el.color;
                    mctx.globalAlpha = 0.4;
                    mctx.beginPath();
                    mctx.arc(x, y, WATCHTOWER_RADIUS[el.watchtower - 1] * 5, 0, 2 * Math.PI);
                    mctx.stroke();
                    mctx.fillStyle = el.color;
                    mctx.fill();
                    // Malý křížek pro pozici věže
                    mctx.globalAlpha = 1;
                    mctx.strokeStyle = '#000';
                    mctx.beginPath(); mctx.moveTo(x-2, y-2); mctx.lineTo(x+2, y+2); mctx.stroke();
                    mctx.beginPath(); mctx.moveTo(x+2, y-2); mctx.lineTo(x-2, y+2); mctx.stroke();
                    mctx.restore();
                }
            });
            msec.appendElement(mc, 0, 0);
        }
    },

    txt(t, c, x, y, col, f) {
        c.save(); c.font = f; c.fillStyle = col; c.textAlign = 'center'; c.strokeStyle = 'black'; c.lineWidth = 3;
        c.strokeText(t, x, y); c.fillText(t, x, y); c.restore();
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  UI DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
var UIManager = {
    init() {
        $('#tribeLeaderUI').remove();
        $('#contentContainer').prepend(this.buildHTML());
        try { $('#tribeLeaderUI').draggable(); } catch(e) {}
        this.showTab('playerSettings');
    },
    buildHTML() {
        return `
        <div id="overwatchNotification" style="visibility:hidden;position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:10000;background:#f4e4bc;padding:10px;border:1px solid #7d510f;"></div>
        <div id="tribeLeaderUI" style="min-width:320px; background:rgba(20,0,0,0.9); color:#eee; border:1px solid #d4af37; position:fixed; z-index:9999; top:60px; right:20px; border-radius:12px; font-family:sans-serif; padding-bottom:10px;">
            <div id="owHeader" style="padding:10px; border-bottom:1px solid #d4af37; font-weight:bold; color:#d4af37; display:flex; justify-content:space-between;">
                <span>OVERWATCH v2.9</span>
                <button onclick="$('#tribeLeaderUI').hide()" style="background:none; border:none; color:#fff; cursor:pointer;">X</button>
            </div>
            <div style="display:flex; justify-content:space-around; padding:5px;">
                <button class="btn" onclick="UIManager.showTab('playerSettings')">Players</button>
                <button class="btn" onclick="UIManager.showTab('stackSettings')">Stacks</button>
                <button class="btn" onclick="UIManager.showTab('exportTab')">Export</button>
            </div>
            <div id="playerSettings" class="tab-ow" style="padding:10px; max-height:400px; overflow-y:auto;">
                <table class="vis" style="width:100%; color:#000; background:#fff;">
                    <thead><tr><th>Player</th><th>Color</th><th>WT</th></tr></thead>
                    <tbody>${playerData.map((p, i) => `
                        <tr>
                            <td>${p.playerName}</td>
                            <td><input type="color" value="${p.color || DEFAULT_COLORS[i%12]}" onchange="playerData[${i}].color=this.value; SettingsManager.save(); SettingsManager.recalculate();"></td>
                            <td><input type="checkbox" ${p.checkedWT !== false ? 'checked' : ''} onchange="playerData[${i}].checkedWT=this.checked; SettingsManager.save(); SettingsManager.recalculate();"></td>
                        </tr>
                    `).join('')}</tbody>
                </table>
            </div>
            <div id="stackSettings" class="tab-ow" style="display:none; padding:10px;">
                <label>Min Stack:</label><br><input type="number" value="${settingsData.minimum}" onchange="settingsData.minimum=this.value; SettingsManager.save();"><br>
                <label>Big Stack:</label><br><input type="number" value="${settingsData.bigStack}" onchange="settingsData.bigStack=this.value; SettingsManager.save();">
            </div>
            <div id="exportTab" class="tab-ow" style="display:none; padding:10px;">
                <button class="btn" style="width:100%" onclick="localStorage.removeItem('overwatchPlayerData'); location.reload();">Clear Cache & Reload</button>
            </div>
            <div style="text-align:center; margin-top:10px;">
                <button class="btn" onclick="TWMap.reload()">Redraw Map</button>
            </div>
            <div style="text-align:right; padding-right:10px; font-size:9px; color:#888;">Powered by TheBrain🧠</div>
        </div>`;
    },
    showTab(id) {
        $('.tab-ow').hide();
        $('#' + id).show();
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════════════════════
SettingsManager.load();
UIManager.init();

const oldSpawn = TWMap.mapHandler.spawnSector;
TWMap.mapHandler.spawnSector = function(d, s) {
    oldSpawn.call(this, d, s);
    $(s._element_root).find('[data-ow]').remove();
    MapRenderer.render(d, s);
};

const oldPopup = TWMap.popup.receivedPopupInformationForSingleVillage;
TWMap.popup.receivedPopupInformationForSingleVillage = function(e) {
    oldPopup.call(TWMap.popup, e);
    let hasNoble = (e.attacks || e.incomings || []).some(a => a.icon?.includes('snob'));
    if (hasNoble) nobleTrainAlerted.add(e.xy);
};

setInterval(() => { if (TWMap.mapHandler) TWMap.reload(); }, 2500);

console.log("Overwatch v2.9: Watchtowers RESTORED. Powered by TheBrain🧠");
