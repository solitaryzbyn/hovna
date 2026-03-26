/**
 * Overwatch v3.3 by TheBrain🧠
 * * BUG FIX:
 * ✅ Fixed Pop-up flickering: MutationObserver now ensures the Overwatch table stays visible
 * even when the game tries to overwrite the pop-up content.
 * ✅ Optimized Redraw: Table is injected only when necessary to prevent lag.
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
let attackTimers = {}; 
let lastPopupCoord = null;

// ═══════════════════════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════════════════════
$('<style>').html(`
    #overwatchDashboard { width: 800px; background: rgba(22, 10, 5, 0.96); color: #eee; border: 2px solid #7d510f; position: fixed; z-index: 9999; top: 80px; left: 100px; border-radius: 4px; padding: 0; font-family: Verdana, sans-serif; box-shadow: 0 8px 30px rgba(0,0,0,0.9); }
    #owHeaderBar { background: linear-gradient(to bottom, #4d310a, #2b1b05); color: #d4af37; font-size: 13px; font-weight: bold; padding: 8px 12px; cursor: move; border-bottom: 1px solid #7d510f; display: flex; justify-content: space-between; align-items: center; }
    #owMainContent { padding: 10px; }
    .btn-filter { background: #fff; border: 1px solid #7d510f; padding: 2px 6px; cursor: pointer; color: #000; font-size: 11px; }
    .btn-filter.active { background: #d4af37; }
    #owMainTableContainer { max-height: 350px; overflow-y: auto; background: #fff; border: 1px solid #7d510f; margin-top: 10px; }
    #owMainTable { width: 100%; border-collapse: collapse; font-size: 11px; color: #000; }
    #owMainTable th { background: #c1a264; padding: 4px; border: 1px solid #7d510f; }
    #owMainTable td { padding: 4px; border: 1px solid #ccc; text-align: center; }
    .btn-ctrl { background: #7d510f; color: #fff; border: 1px solid #d4af37; padding: 6px 12px; cursor: pointer; font-weight: bold; border-radius: 3px; }
    canvas[data-ow]{pointer-events:none!important;}
    
    /* Pop-up Style */
    #overwatch_popup_info { background-color: #f4e4bc; border: 1px solid #7d510f; padding: 5px; margin-top: 5px; color: #000; font-size: 11px; clear: both; }
    #overwatch_popup_info table { width: 100%; border-collapse: collapse; margin-top: 3px; }
    #overwatch_popup_info th, #overwatch_popup_info td { text-align: center; padding: 2px; border: 1px solid #ccc; }
    #overwatch_popup_info th { background-color: #c1a264; }
`).appendTo('head');

// ═══════════════════════════════════════════════════════════════════════════════
//  LOGIC & DATA
// ═══════════════════════════════════════════════════════════════════════════════
function formatCountdown(ms) {
    if (ms <= 0) return '00:00:00';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600), m = Math.floor((totalSec % 3600) / 60), s = totalSec % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

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
                    unitsInVillage: village.unitsInVillage, unitsEnRoute: village.unitsEnroute,
                    _nobleTrain: nobleTrainAlerted.has(village.coordinate)
                });
            });
        });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  POP-UP OBSERVER (The Fix)
// ═══════════════════════════════════════════════════════════════════════════════
var PopupFixer = {
    init() {
        const target = document.getElementById('map_popup');
        if (!target) return;

        const observer = new MutationObserver((mutations) => {
            if (lastPopupCoord) {
                const el = targetData.find(v => v.coord === lastPopupCoord);
                if (el && !document.getElementById('overwatch_popup_info')) {
                    this.inject(el);
                }
            }
        });

        observer.observe(target, { childList: true, subtree: true });
    },

    inject(el) {
        const popupDom = document.getElementById('map_popup');
        if (!popupDom) return;
        
        const archers = game_data.units.includes('archer');
        const paladin = game_data.units.includes('knight');
        const nearest = attackTimers[el.coord]?.filter(t => t.arrivalTs > Date.now())[0];

        let html = `
        <div id="overwatch_popup_info">
            <h4 style="margin:2px 0; color:#7d510f;">Overwatch ${nearest ? `<span style="color:#cc0000; float:right;">⏱ ${formatCountdown(nearest.arrivalTs - Date.now())}</span>` : ''}</h4>
            <table>
                <thead><tr>
                    <th></th><th><img src="/graphic/unit/unit_spear.webp"></th><th><img src="/graphic/unit/unit_sword.webp"></th><th><img src="/graphic/unit/unit_axe.webp"></th>
                    ${archers ? '<th><img src="/graphic/unit/unit_archer.webp"></th>' : ''}<th><img src="/graphic/unit/unit_spy.webp"></th><th><img src="/graphic/unit/unit_light.webp"></th>
                    ${archers ? '<th><img src="/graphic/unit/unit_marcher.webp"></th>' : ''}<th><img src="/graphic/unit/unit_heavy.webp"></th><th><img src="/graphic/unit/unit_ram.webp"></th>
                    <th><img src="/graphic/unit/unit_catapult.webp"></th>${paladin ? '<th><img src="/graphic/unit/unit_knight.webp"></th>' : ''}<th><img src="/graphic/unit/unit_snob.webp"></th>
                </tr></thead>
                <tbody>
                    <tr><td>Doma</td>${this.makeTroopTds(el.unitsInVillage)}</tr>
                    <tr><td>Cesta</td>${this.makeTroopTds(el.unitsEnRoute)}</tr>
                </tbody>
            </table>
        </div>`;
        
        // Vložit na konec pop-upu
        $(popupDom).append(html);
    },

    makeTroopTds(troops) {
        if (!troops) return '<td colspan="15">0</td>';
        const units = ['spear', 'sword', 'axe'];
        if (game_data.units.includes('archer')) units.push('archer');
        units.push('spy', 'light');
        if (game_data.units.includes('marcher')) units.push('marcher');
        units.push('heavy', 'ram', 'catapult');
        if (game_data.units.includes('knight')) units.push('knight');
        units.push('snob');
        return units.map(u => `<td>${troops[u] || 0}</td>`).join('');
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  MAP RENDERER & DASHBOARD
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
            if (tx >= sectorX && tx < sectorX + sectorSize && ty >= sectorY && ty < sectorY + sectorSize) {
                const vp = TWMap.map.pixelByCoord(tx, ty);
                const ox = (vp[0] - sp[0]) + tileWidthX / 2, oy = (vp[1] - sp[1]) + tileWidthY / 2;

                ctx.save();
                ctx.strokeStyle = el.color; ctx.lineWidth = 3; ctx.globalAlpha = 0.6;
                ctx.beginPath(); ctx.arc(ox, oy, (tileWidthX/2)-3, 0, 2 * Math.PI); ctx.stroke();
                ctx.restore();

                if (wallHistory[el.coord] && (wallHistory[el.coord] - parseInt(el.wall)) >= 5) {
                    ctx.drawImage(images.fire, ox - 20, oy - 25, 40, 40);
                }
                wallHistory[el.coord] = parseInt(el.wall);

                const atks = parseInt(el.incomingAttacks);
                if (atks > 0) {
                    const phase = ((Date.now() % PULSE_PERIOD_MS) / PULSE_PERIOD_MS);
                    ctx.save(); ctx.strokeStyle = `rgba(255, 0, 0, ${0.8 - phase})`; ctx.lineWidth = 4;
                    ctx.beginPath(); ctx.arc(ox, oy, (tileWidthX/2) + (phase * 10), 0, 2 * Math.PI); ctx.stroke(); ctx.restore();
                    this.txt(atks, ctx, ox, oy - 10, '#ff0000', 'bold 16px Arial');
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
//  STARTUP & HOOKS
// ═══════════════════════════════════════════════════════════════════════════════
Manager.recalculate();
PopupFixer.init();

// Dashboard Init
if (!$('#overwatchDashboard').length) {
    $('body').append(`
        <div id="overwatchDashboard">
            <div id="owHeaderBar"><span>MAP OVERVIEW</span><button onclick="$('#owMainContent').toggle()" style="background:none; border:1px solid #d4af37; color:#d4af37; cursor:pointer;">–</button></div>
            <div id="owMainContent" style="padding:10px;">
                <div style="display:flex; gap:10px; justify-content:center;">
                    <button class="btn-ctrl" onclick="TWMap.reload()">Redraw map</button>
                    <button class="btn-ctrl" onclick="location.reload()">Refresh data</button>
                </div>
            </div>
        </div>
    `);
    $("#overwatchDashboard").draggable({ handle: "#owHeaderBar" });
}

// Hook map sectors
const oldSpawn = TWMap.mapHandler.spawnSector;
TWMap.mapHandler.spawnSector = function(d, s) { 
    oldSpawn.call(this, d, s); 
    $(s._element_root).find('[data-ow]').remove(); 
    Renderer.render(s); 
};

// Hook Popups
if (TWMap.popup) {
    const oldReceived = TWMap.popup.receivedPopupInformationForSingleVillage;
    TWMap.popup.receivedPopupInformationForSingleVillage = function (e) {
        oldReceived.call(TWMap.popup, e);
        if (e && e.xy) {
            // Uložit koordinát pro hlídače MutationObserver
            lastPopupCoord = e.xy.toString().includes('|') ? e.xy : (e.xy.toString().substring(0, 3) + '|' + e.xy.toString().substring(3, 6));
            
            // Zpracovat útoky
            const timers = [];
            const rawAtks = e.attacks || e.incomings || [];
            rawAtks.forEach(a => timers.push({ arrivalTs: (a.arrival_time || a.time) * 1000 }));
            attackTimers[lastPopupCoord] = timers.sort((a,b) => a.arrivalTs - b.arrivalTs);

            const el = targetData.find(v => v.coord === lastPopupCoord);
            if (el) PopupFixer.inject(el);
        }
    };
}

setInterval(() => { if (TWMap.mapHandler) TWMap.reload(); }, 2500);

console.log("Overwatch v3.3: Permanent Pop-up Fix active. Powered by TheBrain🧠");
