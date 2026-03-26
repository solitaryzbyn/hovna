/**
 * Overwatch v3.1 by TheBrain🧠
 * * CRITICAL FIXES:
 * ✅ Fixed Draggable: Dashboard can now be moved via header.
 * ✅ Added Minimization: Toggle visibility with [–] button.
 * ✅ Improved Layout: Fixed positioning issues preventing interaction.
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
    attack: new Image(), wall: new Image(), fire: new Image(), noble: new Image()
};
images.attack.src = '/graphic//map/incoming_attack.webp';
images.wall.src = '/graphic/buildings/wall.webp';
images.fire.src = 'https://dsen.innogamescdn.com/asset/98710b2/graphic/map/map_fire.png';
images.noble.src = '/graphic/unit/unit_snob.webp';

// ═══════════════════════════════════════════════════════════════════════════════
//  GLOBAL STATE
// ═══════════════════════════════════════════════════════════════════════════════
let playerData = JSON.parse(localStorage.getItem('overwatchPlayerData') || '[]');
let targetData = [];
let tileWidthX = TWMap.tileSize[0], tileWidthY = TWMap.tileSize[1];
let nobleTrainAlerted = new Set();
let wallHistory = JSON.parse(localStorage.getItem('owWallHistory') || '{}');
let discordWebhookUrl = localStorage.getItem('overwatchDiscordWebhook') || '';
let activeFilters = new Set();

// ═══════════════════════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════════════════════
$('#contentContainer').eq(0).prepend(`<style>
    #overwatchDashboard {
        width: 800px; background: rgba(22, 10, 5, 0.96);
        color: #eee; border: 2px solid #7d510f; position: fixed;
        z-index: 9999; top: 80px; left: 100px; 
        border-radius: 4px; padding: 0; font-family: Verdana, sans-serif;
        box-shadow: 0 8px 30px rgba(0,0,0,0.9);
    }
    #owHeaderBar { 
        background: linear-gradient(to bottom, #4d310a, #2b1b05);
        color: #d4af37; font-size: 13px; font-weight: bold; 
        padding: 8px 12px; cursor: move; border-bottom: 1px solid #7d510f;
        display: flex; justify-content: space-between; align-items: center;
    }
    #owMainContent { padding: 10px; }
    #owFilterBar { background: #f4e4bc; color: #000; padding: 6px; border: 1px solid #7d510f; margin-bottom: 10px; display: flex; align-items: center; gap: 5px; font-size: 11px; }
    .btn-filter { background: #fff; border: 1px solid #7d510f; padding: 2px 6px; cursor: pointer; }
    .btn-filter.active { background: #d4af37; }
    #owTabControls { display: flex; justify-content: center; gap: 4px; margin-bottom: 10px; }
    .btn-tab { background: #700; color: #fff; border: 1px solid #d4af37; padding: 4px 10px; cursor: pointer; font-size: 11px; font-weight: bold; }
    .btn-tab.active { background: #b00; }
    #owMainTableContainer { max-height: 350px; overflow-y: auto; background: #fff; border: 1px solid #7d510f; }
    #owMainTable { width: 100%; border-collapse: collapse; font-size: 11px; color: #000; }
    #owMainTable th { background: #c1a264; padding: 4px; border: 1px solid #7d510f; }
    #owMainTable td { padding: 4px; border: 1px solid #ccc; text-align: center; }
    #owFooterBar { display: flex; flex-direction: column; gap: 10px; padding: 10px; border-top: 1px solid #555; }
    .btn-ctrl { background: #7d510f; color: #fff; border: 1px solid #d4af37; padding: 6px 12px; cursor: pointer; font-weight: bold; border-radius: 3px; }
    .btn-minimize { background: none; border: 1px solid #d4af37; color: #d4af37; padding: 0 6px; cursor: pointer; font-size: 16px; }
</style>`);

// ═══════════════════════════════════════════════════════════════════════════════
//  LOGIC & DATA
// ═══════════════════════════════════════════════════════════════════════════════
var Manager = {
    recalculate() {
        targetData = [];
        playerData.forEach((player, pIdx) => {
            if (!player.playerVillages) return;
            player.playerVillages.forEach(village => {
                targetData.push({
                    coord: village.coordinate, playerName: player.playerName,
                    color: player.color || DEFAULT_COLORS[pIdx % 12],
                    incomingAttacks: village.attacksToVillage || 0, totalStack: village.totalPop || 0,
                    wall: village.wall || 20, watchtower: village.watchtower || 0,
                    checkedWT: player.checkedWT !== false, checkedWTMini: player.checkedWTMini !== false,
                    _nobleTrain: nobleTrainAlerted.has(village.coordinate)
                });
            });
        });
    },
    save() {
        localStorage.setItem('overwatchPlayerData', JSON.stringify(playerData));
        localStorage.setItem('overwatchDiscordWebhook', discordWebhookUrl);
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  UI ENGINE
// ═══════════════════════════════════════════════════════════════════════════════
var UI = {
    init() {
        $('#overwatchDashboard').remove();
        $('body').append(this.buildHTML());
        this.bindEvents();
        Manager.recalculate();
    },

    buildHTML() {
        return `
        <div id="overwatchDashboard">
            <div id="owHeaderBar">
                <span>MAP OVERVIEW</span>
                <button class="btn-minimize" id="owMinBtn" title="Minimalizovat">–</button>
            </div>
            <div id="owMainContent">
                <div id="owFilterBar">
                    <span>Filter:</span>
                    <button class="btn-filter" data-filter="empty">Empty</button>
                    <button class="btn-filter" data-filter="attack">Under attack</button>
                    <button class="btn-filter" data-filter="wall">Wall <20</button>
                    <button class="btn-filter" data-filter="wt">Has WT</button>
                    <button class="btn-filter" data-filter="noble">Noble train</button>
                    <button class="btn-filter" onclick="activeFilters.clear(); TWMap.reload();">✕ Clear</button>
                </div>
                <div id="owTabControls">
                    <button class="btn-tab active">Player settings</button>
                    <button class="btn-tab">Stack settings</button>
                    <button class="btn-tab">Stack list</button>
                    <button class="btn-tab">Import/Export</button>
                </div>
                <div id="owMainTableContainer">
                    <table id="owMainTable">
                        <thead><tr><th>Player</th><th>Map WT</th><th>Mini WT</th><th>Color</th><th>Atks</th><th>Vils</th></tr></thead>
                        <tbody>${this.buildRows()}</tbody>
                    </table>
                </div>
                <div id="owFooterBar">
                    <div style="display:flex; gap:10px; align-items:center; color:#b8a0ff; font-size:11px;">
                        Discord Webhook: 
                        <input type="text" id="owWebhookInp" style="flex:1;" value="${discordWebhookUrl}">
                        <button class="btn-ctrl" onclick="discordWebhookUrl=$('#owWebhookInp').val(); Manager.save();">💾</button>
                    </div>
                    <div style="display:flex; gap:10px; justify-content:center;">
                        <button class="btn-ctrl" onclick="TWMap.reload()">Redraw map</button>
                        <button class="btn-ctrl" onclick="location.reload()">Refresh data</button>
                        <button class="btn-ctrl" style="background:#5c448c;">Send to Discord</button>
                    </div>
                    <div style="text-align:right; font-size:9px; color:#888;">Powered by TheBrain🧠</div>
                </div>
            </div>
        </div>`;
    },

    buildRows() {
        return playerData.map((p, i) => `
            <tr>
                <td style="text-align:left;">${p.playerName}</td>
                <td><input type="checkbox" ${p.checkedWT !== false ? 'checked' : ''} onchange="playerData[${i}].checkedWT=this.checked; Manager.save(); TWMap.reload();"></td>
                <td><input type="checkbox" ${p.checkedWTMini !== false ? 'checked' : ''} onchange="playerData[${i}].checkedWTMini=this.checked; Manager.save(); TWMap.reload();"></td>
                <td><input type="color" value="${p.color || '#ff0000'}" onchange="playerData[${i}].color=this.value; Manager.save(); TWMap.reload();"></td>
                <td>${p.playerVillages?.reduce((a,v)=>a+(parseInt(v.attacksToVillage)||0),0)||0}</td>
                <td>${p.playerVillages?.length || 0}</td>
            </tr>
        `).join('');
    },

    bindEvents() {
        // Inicializace Draggable (vyžaduje jQuery UI, které na TW je)
        try {
            $("#overwatchDashboard").draggable({ handle: "#owHeaderBar", containment: "window" });
        } catch(e) { console.error("Draggable failed", e); }

        // Minimalizace
        $('#owMinBtn').click(() => {
            $('#owMainContent').toggle();
            $('#overwatchDashboard').css('width', $('#owMainContent').is(':visible') ? '800px' : '200px');
        });

        // Filtry
        $('.btn-filter[data-filter]').click(function() {
            const f = $(this).data('filter');
            activeFilters.has(f) ? activeFilters.delete(f) : activeFilters.add(f);
            $(this).toggleClass('active');
            TWMap.reload();
        });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  MAP OVERLAY ENGINE
// ═══════════════════════════════════════════════════════════════════════════════
var Renderer = {
    render(sector) {
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
            const ox = (vp[0] - sp[0]) + tileWidthX / 2, oy = (vp[1] - sp[1]) + tileWidthY / 2;

            // WT Range
            if (el.watchtower > 0 && el.checkedWT) {
                ctx.save();
                ctx.beginPath(); ctx.globalAlpha = 0.2; ctx.fillStyle = el.color;
                const r = WATCHTOWER_RADIUS[el.watchtower - 1];
                ctx.ellipse(ox, oy, r * tileWidthX, r * tileWidthY, 0, 0, 2 * Math.PI);
                ctx.fill(); ctx.restore();
            }

            // Village Logic (Only if in sector)
            if (tx >= sectorX && tx < sectorX + sectorSize && ty >= sectorY && ty < sectorY + sectorSize) {
                // Ring
                ctx.save(); ctx.strokeStyle = el.color; ctx.lineWidth = 3; ctx.globalAlpha = 0.6;
                ctx.beginPath(); ctx.arc(ox, oy, (tileWidthX/2)-3, 0, 2 * Math.PI); ctx.stroke(); ctx.restore();

                // Fire
                if (wallHistory[el.coord] && (wallHistory[el.coord] - parseInt(el.wall)) >= 5) {
                    ctx.drawImage(images.fire, ox - 20, oy - 25, 40, 40);
                }
                wallHistory[el.coord] = parseInt(el.wall);

                // Pulse
                if (parseInt(el.incomingAttacks) > 0) {
                    const phase = ((Date.now() % PULSE_PERIOD_MS) / PULSE_PERIOD_MS);
                    ctx.save(); ctx.strokeStyle = `rgba(255, 0, 0, ${0.8 - phase})`; ctx.lineWidth = 4;
                    ctx.beginPath(); ctx.arc(ox, oy, (tileWidthX/2) + (phase * 10), 0, 2 * Math.PI); ctx.stroke(); ctx.restore();
                    this.txt(el.incomingAttacks, ctx, ox, oy - 10, '#ff0000', 'bold 16px Arial');
                }
                this.txt(Math.floor(el.totalStack/1000)+'k', ctx, ox, oy + 15, 'white', '11px Arial');
            }
        });
        sector.appendElement(canvas, 0, 0);
    },
    txt(t, c, x, y, col, f) {
        c.save(); c.font = f; c.fillStyle = col; c.textAlign = 'center'; c.strokeStyle = 'black'; c.lineWidth = 3;
        c.strokeText(t, x, y); c.fillText(t, x, y); c.restore();
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  STARTUP
// ═══════════════════════════════════════════════════════════════════════════════
UI.init();

const oldSpawn = TWMap.mapHandler.spawnSector;
TWMap.mapHandler.spawnSector = function(d, s) { 
    oldSpawn.call(this, d, s); 
    $(s._element_root).find('[data-ow]').remove(); 
    Renderer.render(s); 
};

setInterval(() => { if (TWMap.mapHandler) TWMap.reload(); }, 2500);

console.log("Overwatch v3.1: Draggable & Minimizable. Powered by TheBrain🧠");
