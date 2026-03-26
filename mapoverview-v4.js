/**
 * Overwatch v3.4 by TheBrain🧠
 * * CRITICAL FIXES:
 * ✅ Fixed Dashboard visibility: Main content is now visible by default.
 * ✅ Fixed Pop-up flickering: Overwatch table is now "locked" into the popup.
 * ✅ Aggressive injection: MutationObserver ensures the table stays put during map animations.
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
let wallHistory = JSON.parse(localStorage.getItem('owWallHistory') || '{}');
let discordWebhookUrl = localStorage.getItem('overwatchDiscordWebhook') || '';
let activeFilters = new Set();
let attackTimers = {}; 
let lastPopupCoord = null;

// ═══════════════════════════════════════════════════════════════════════════════
//  STYLES (Zajištění viditelnosti dashboardu)
// ═══════════════════════════════════════════════════════════════════════════════
$('<style>').html(`
    #overwatchDashboard { width: 800px; background: rgba(22, 10, 5, 0.98); color: #eee; border: 2px solid #7d510f; position: fixed; z-index: 9999; top: 50px; left: 100px; border-radius: 4px; padding: 0; font-family: Verdana, sans-serif; box-shadow: 0 8px 30px rgba(0,0,0,0.9); }
    #owHeaderBar { background: linear-gradient(to bottom, #4d310a, #2b1b05); color: #d4af37; font-size: 13px; font-weight: bold; padding: 8px 12px; cursor: move; border-bottom: 1px solid #7d510f; display: flex; justify-content: space-between; align-items: center; }
    #owMainContent { padding: 10px; display: block !important; }
    #owFilterBar { background: #f4e4bc; color: #000; padding: 6px; border: 1px solid #7d510f; margin-bottom: 10px; display: flex; align-items: center; gap: 5px; font-size: 11px; }
    .btn-filter { background: #fff; border: 1px solid #7d510f; padding: 2px 6px; cursor: pointer; color: #000; }
    .btn-filter.active { background: #d4af37; }
    #owMainTableContainer { max-height: 300px; overflow-y: auto; background: #fff; border: 1px solid #7d510f; }
    #owMainTable { width: 100%; border-collapse: collapse; font-size: 11px; color: #000; }
    #owMainTable th { background: #c1a264; padding: 4px; position: sticky; top: 0; z-index: 5; }
    #owMainTable td { padding: 4px; border: 1px solid #ccc; text-align: center; }
    .btn-ctrl { background: #7d510f; color: #fff; border: 1px solid #d4af37; padding: 6px 12px; cursor: pointer; font-weight: bold; border-radius: 3px; font-size: 11px; }
    canvas[data-ow]{pointer-events:none!important;}
    #overwatch_popup_info { background-color: #f4e4bc; border: 2px solid #7d510f; padding: 5px; margin-top: 8px; color: #000; font-size: 11px; width: 100%; box-sizing: border-box; }
    #overwatch_popup_info table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    #overwatch_popup_info th, #overwatch_popup_info td { text-align: center; padding: 2px; border: 1px solid #7d510f; }
    #overwatch_popup_info th { background-color: #c1a264; }
`).appendTo('head');

// ═══════════════════════════════════════════════════════════════════════════════
//  LOGIC
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
        playerData.forEach((p, idx) => {
            if (!p.playerVillages) return;
            p.playerVillages.forEach(v => {
                targetData.push({
                    coord: v.coordinate, playerName: p.playerName, color: p.color || DEFAULT_COLORS[idx % 12],
                    incomingAttacks: v.attacksToVillage || 0, totalStack: v.totalPop || 0,
                    wall: v.wall || 20, watchtower: v.watchtower || 0,
                    unitsInVillage: v.unitsInVillage, unitsEnRoute: v.unitsEnroute
                });
            });
        });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  POP-UP FIX (mutation and anti-flicker)
// ═══════════════════════════════════════════════════════════════════════════════
var PopupFixer = {
    inject(el) {
        const popupDom = document.getElementById('map_popup');
        if (!popupDom || document.getElementById('overwatch_popup_info')) return;
        
        const archers = game_data.units.includes('archer');
        const nearest = attackTimers[el.coord]?.filter(t => t.arrivalTs > Date.now())[0];

        let html = `
        <div id="overwatch_popup_info">
            <div style="font-weight:bold; color:#7d510f; margin-bottom:3px;">
                OVERWATCH ${nearest ? `<span style="color:#cc0000; float:right;">⏱ ${formatCountdown(nearest.arrivalTs - Date.now())}</span>` : ''}
            </div>
            <table>
                <thead><tr>
                    <th></th><th><img src="/graphic/unit/unit_spear.webp"></th><th><img src="/graphic/unit/unit_sword.webp"></th><th><img src="/graphic/unit/unit_axe.webp"></th>
                    ${archers ? '<th><img src="/graphic/unit/unit_archer.webp"></th>' : ''}<th><img src="/graphic/unit/unit_spy.webp"></th><th><img src="/graphic/unit/unit_light.webp"></th>
                    ${archers ? '<th><img src="/graphic/unit/unit_marcher.webp"></th>' : ''}<th><img src="/graphic/unit/unit_heavy.webp"></th><th><img src="/graphic/unit/unit_ram.webp"></th>
                    <th><img src="/graphic/unit/unit_catapult.webp"></th><th><img src="/graphic/unit/unit_snob.webp"></th>
                </tr></thead>
                <tbody>
                    <tr><td>Doma</td>${this.makeTroopTds(el.unitsInVillage)}</tr>
                    <tr><td>Cesta</td>${this.makeTroopTds(el.unitsEnRoute)}</tr>
                </tbody>
            </table>
        </div>`;
        $(popupDom).append(html);
    },
    makeTroopTds(tr) {
        const u = ['spear', 'sword', 'axe'];
        if (game_data.units.includes('archer')) u.push('archer');
        u.push('spy', 'light');
        if (game_data.units.includes('marcher')) u.push('marcher');
        u.push('heavy', 'ram', 'catapult', 'snob');
        return u.map(unit => `<td>${(tr && tr[unit]) ? tr[unit] : 0}</td>`).join('');
    }
};

// Observer pro pop-up
const popupObserver = new MutationObserver(() => {
    if (lastPopupCoord) {
        const el = targetData.find(v => v.coord === lastPopupCoord);
        if (el && !document.getElementById('overwatch_popup_info')) {
            PopupFixer.inject(el);
        }
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  UI & RENDERER
// ═══════════════════════════════════════════════════════════════════════════════
var UI = {
    init() {
        $('#overwatchDashboard').remove();
        $('body').append(this.buildHTML());
        Manager.recalculate();
        try { $("#overwatchDashboard").draggable({ handle: "#owHeaderBar", containment: "window" }); } catch(e){}
        const popupNode = document.getElementById('map_popup');
        if(popupNode) popupObserver.observe(popupNode, { childList: true, subtree: true });
    },
    buildHTML() {
        return `
        <div id="overwatchDashboard">
            <div id="owHeaderBar"><span>MAP OVERVIEW</span><button onclick="$('#owMainContent').toggle()" style="color:#d4af37; background:none; border:none; cursor:pointer;">[–]</button></div>
            <div id="owMainContent">
                <div id="owFilterBar">
                    <span>Filter:</span>
                    <button class="btn-filter" onclick="$(this).toggleClass('active'); TWMap.reload();">Empty</button>
                    <button class="btn-filter" onclick="$(this).toggleClass('active'); TWMap.reload();">Under attack</button>
                    <button class="btn-filter" onclick="TWMap.reload();">✕ Clear</button>
                </div>
                <div id="owMainTableContainer">
                    <table id="owMainTable">
                        <thead><tr><th>Hráč</th><th>Barva</th><th>Útoky</th><th>Vesnic</th></tr></thead>
                        <tbody>${playerData.map((p,i)=>`<tr><td style="text-align:left">${p.playerName}</td><td><input type="color" value="${p.color||'#ff0000'}" onchange="playerData[${i}].color=this.value; localStorage.setItem('overwatchPlayerData', JSON.stringify(playerData)); Manager.recalculate(); TWMap.reload();"></td><td>${p.playerVillages?.reduce((a,v)=>a+(parseInt(v.attacksToVillage)||0),0)||0}</td><td>${p.playerVillages?.length||0}</td></tr>`).join('')}</tbody>
                    </table>
                </div>
                <div style="display:flex; gap:10px; justify-content:center; padding:10px;">
                    <button class="btn-ctrl" onclick="TWMap.reload()">Redraw map</button>
                    <button class="btn-ctrl" onclick="location.reload()">Refresh data</button>
                </div>
            </div>
        </div>`;
    }
};

var Renderer = {
    render(sector) {
        const twCanvas = sector._element_root?.querySelector('canvas[id^="map_canvas_"]');
        if (!twCanvas) return;
        const parts = twCanvas.id.replace('map_canvas_', '').split('_');
        const sectorX = parseInt(parts[0]), sectorY = parseInt(parts[1]);
        const sp = TWMap.map.pixelByCoord(sectorX, sectorY);
        const canvas = document.createElement('canvas');
        canvas.width = tileWidthX * (TWMap.map.sectorSize || 5); canvas.height = tileWidthY * (TWMap.map.sectorSize || 5);
        canvas.setAttribute('data-ow', 'true');
        canvas.style.cssText = 'position:absolute;left:0;top:0;z-index:10;pointer-events:none;';
        const ctx = canvas.getContext('2d');

        targetData.forEach(el => {
            const [tx, ty] = el.coord.split('|').map(Number);
            if (tx >= sectorX && tx < sectorX + 5 && ty >= sectorY && ty < sectorY + 5) {
                const vp = TWMap.map.pixelByCoord(tx, ty);
                const ox = (vp[0] - sp[0]) + tileWidthX / 2, oy = (vp[1] - sp[1]) + tileWidthY / 2;
                ctx.save(); ctx.strokeStyle = el.color; ctx.lineWidth = 3; ctx.globalAlpha = 0.6;
                ctx.beginPath(); ctx.arc(ox, oy, (tileWidthX/2)-3, 0, 2 * Math.PI); ctx.stroke(); ctx.restore();

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
//  STARTUP
// ═══════════════════════════════════════════════════════════════════════════════
UI.init();

const oldSpawn = TWMap.mapHandler.spawnSector;
TWMap.mapHandler.spawnSector = function(d, s) { 
    oldSpawn.call(this, d, s); 
    $(s._element_root).find('[data-ow]').remove(); 
    Renderer.render(s); 
};

if (TWMap.popup) {
    const oldRec = TWMap.popup.receivedPopupInformationForSingleVillage;
    TWMap.popup.receivedPopupInformationForSingleVillage = function (e) {
        oldRec.call(TWMap.popup, e);
        if (e && e.xy) {
            lastPopupCoord = e.xy.toString().includes('|') ? e.xy : (e.xy.toString().substring(0, 3) + '|' + e.xy.toString().substring(3, 6));
            const rawAtks = e.attacks || e.incomings || [];
            attackTimers[lastPopupCoord] = rawAtks.map(a => ({ arrivalTs: (a.arrival_time || a.time) * 1000 }));
            const el = targetData.find(v => v.coord === lastPopupCoord);
            if (el) PopupFixer.inject(el);
        }
    };
}

setInterval(() => { if (TWMap.mapHandler) TWMap.reload(); }, 2500);

console.log("Overwatch v3.4: Dashboard restored & Pop-up flicker fixed. Powered by TheBrain🧠");
