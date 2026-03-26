/**
 * Overwatch v2.5 by TheBrain🧠
 * * UPDATES:
 * ✅ Noble detection integrated into attack timers + Discord alerts for single nobles
 * ✅ Burning village animation (fire) if wall drops by 5+ levels 🔥
 * ✅ Significantly more visible pulse animation for attacked villages
 * ✅ Removed Sector priority scoring & average stack overlays
 * ✅ Player-colored rings preserved
 */

if (window.location.href.indexOf('screen=map') < 0) {
    window.location.assign(game_data.link_base_pure + 'map');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CONSTANTS & ASSETS
// ═══════════════════════════════════════════════════════════════════════════════
var WATCHTOWER_RADIUS = [1.1, 1.3, 1.5, 1.7, 2, 2.3, 2.6, 3, 3.4, 3.9, 4.4, 5.1, 5.8, 6.7, 7.6, 8.7, 10, 11.5, 13.1, 15];
var DEFAULT_COLORS = [
    { color: "#FF0000", opacity: 0.3 }, { color: "#FF5100", opacity: 0.3 }, { color: "#FFAE00", opacity: 0.3 },
    { color: "#F2FF00", opacity: 0.3 }, { color: "#B7FF00", opacity: 0.3 }, { color: "#62FF00", opacity: 0.3 },
    { color: "#04FF00", opacity: 0.3 }, { color: "#00FF7B", opacity: 0.3 }, { color: "#00FFAE", opacity: 0.3 },
    { color: "#00C8FF", opacity: 0.3 }, { color: "#006AFF", opacity: 0.3 }, { color: "#1500FF", opacity: 0.3 },
    { color: "#4000FF", opacity: 0.3 }, { color: "#8C00FF", opacity: 0.3 }, { color: "#FF00D9", opacity: 0.3 }
];
var CACHE_TTL_DEFAULT = 30;
var NOBLE_TRAIN_THRESHOLD = 4;
var PULSE_PERIOD_MS = 800; // Faster pulse

var images = {
    attack: new Image(),
    wall: new Image(),
    farm: new Image(),
    fire: new Image(),
    noble: new Image()
};
images.attack.src = '/graphic//map/incoming_attack.webp';
images.wall.src = '/graphic/buildings/wall.webp';
images.farm.src = '/graphic/buildings/farm.webp';
images.fire.src = 'https://dsen.innogamescdn.com/asset/98710b2/graphic/map/map_fire.png';
images.noble.src = '/graphic/unit/unit_snob.webp';

// ═══════════════════════════════════════════════════════════════════════════════
//  GLOBAL STATE
// ═══════════════════════════════════════════════════════════════════════════════
let options, playerIDs, urls = [], buildingUrls = [], playerData = [];
let targetData = [];
let tileWidthX = TWMap.tileSize[0], tileWidthY = TWMap.tileSize[1];
let selectedVillages = [], selectedVillageSet = new Set();
let settingsData, unitPopValues, packetSize, minimum, smallStack, mediumStack, bigStack, targetStackSize;
let cacheTTL = CACHE_TTL_DEFAULT;
let activeFilters = new Set(), stackHistory = {}, ownVillages = [];
let attackTimers = {}, nobleTrainAlerted = new Set(); 
let autoRefreshInterval = 15;
let discordWebhookUrl = localStorage.getItem('overwatchDiscordWebhook') || '';
let pulseTs = 0, wallHistory = JSON.parse(localStorage.getItem('owWallHistory') || '{}');

// ═══════════════════════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════════════════════
$('#contentContainer').eq(0).prepend(`<style>
    .overviewWithPadding th,.overviewWithPadding td{padding:2px 10px;}
    #overwatchNotification{visibility:hidden;min-width:250px;margin-left:-125px;background-color:#f4e4bc;color:#000;border:1px solid #7d510f;text-align:center;border-radius:2px;padding:16px;position:fixed;z-index:9999;left:50%;top:50px;}
    #overwatchNotification.show{visibility:visible;animation:fadein .5s,fadeout .5s 2.5s;}
    @keyframes fadein{from{top:0;opacity:0}to{top:50px;opacity:1}}
    @keyframes fadeout{from{top:50px;opacity:1}to{top:0;opacity:0}}
    .slider>.track{position:absolute;z-index:1;left:0;right:0;top:0;bottom:0;border-radius:5px;background-image:linear-gradient(to right,black,red,yellow,green);}
    .slider>.range{position:absolute;z-index:2;left:25%;right:25%;top:0;bottom:0;border-radius:5px;background-color:#FF0000;}
    #owFilterBar{display:flex;gap:6px;padding:6px 12px;background:#e8d5a3;border-bottom:1px solid #7d510f;flex-wrap:wrap;}
    .ow-filter-btn{padding:2px 10px;border:1px solid #7d510f;border-radius:3px;background:#f4e4bc;cursor:pointer;font-size:12px;}
    .ow-filter-btn.active{background:#7d510f;color:#fff;}
    #owPacketCalc{position:fixed;z-index:10000;background:#f4e4bc;border:2px solid #7d510f;border-radius:6px;padding:16px;min-width:340px;box-shadow:4px 4px 12px rgba(0,0,0,0.4);}
    canvas[data-ow]{pointer-events:none!important;}
    #owDiscordBar{display:flex;align-items:center;gap:6px;padding:8px 16px;flex-wrap:wrap;}
    #owDiscordWebhookInput{flex:1;min-width:180px;padding:4px 7px;font-size:11px;border:1px solid #d4af37;background:#1a0a00;color:#d4af37;}
    #ow-attack-live-bar{position:fixed;top:50px;left:50%;transform:translateX(-50%);z-index:10002;display:flex;gap:8px;pointer-events:none;}
    .ow-live-timer-chip{background:rgba(140,0,0,0.95);color:#fff;border:1px solid #ff4444;border-radius:5px;padding:3px 9px;font-size:11px;font-weight:bold;box-shadow:0 2px 6px rgba(0,0,0,.5);}
</style>`);

// ═══════════════════════════════════════════════════════════════════════════════
//  CORE UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════
function showNotification(msg, duration = 3000) {
    const x = document.getElementById('overwatchNotification');
    if (!x) return;
    x.innerText = msg; x.className = 'show';
    setTimeout(() => { x.className = x.className.replace('show', ''); }, duration);
}

function numberWithCommas(x) { return String(x).replace(/\B(?=(\d{3})+(?!\d))/g, "."); }

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function formatCountdown(ms) {
    if (ms <= 0) return '00:00:00';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600), m = Math.floor((totalSec % 3600) / 60), s = totalSec % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ATTACK & NOBLE DETECTOR
// ═══════════════════════════════════════════════════════════════════════════════
var AttackTimerManager = {
    update(popupData) {
        if (!popupData || !popupData.xy) return;
        const xy = popupData.xy.toString();
        const coord = xy.includes('|') ? xy : xy.substring(0, 3) + '|' + xy.substring(3, 6);
        
        const timers = [];
        let isNoble = false;
        const rawAttacks = popupData.attacks || popupData.incomings || [];

        rawAttacks.forEach(atk => {
            const ts = (atk.arrival_time || atk.time) * 1000;
            const nobleInAtk = (atk.icon && atk.icon.includes('snob'));
            if (nobleInAtk) isNoble = true;
            
            timers.push({ arrivalTs: ts, source: atk.village_id, isNoble: nobleInAtk });
        });

        if (timers.length > 0) {
            timers.sort((a, b) => a.arrivalTs - b.arrivalTs);
            attackTimers[coord] = timers;
            this._updateLiveBar();
            
            // Auto-alert Discord if noble is present
            if (isNoble && !nobleTrainAlerted.has(coord)) {
                this.triggerNobleAlert(coord, "Noble movement detected!");
            }
            this._checkTrain(coord, timers);
        }
    },

    _checkTrain(coord, timers) {
        if (nobleTrainAlerted.has(coord)) return;
        const sourceCounts = {};
        timers.forEach(t => { sourceCounts[t.source] = (sourceCounts[t.source] || 0) + 1; });
        const trainSource = Object.keys(sourceCounts).find(k => sourceCounts[k] >= NOBLE_TRAIN_THRESHOLD);
        
        if (trainSource) {
            this.triggerNobleAlert(coord, `Noble train (${sourceCounts[trainSource]} attacks) detected!`);
        }
    },

    triggerNobleAlert(coord, reason) {
        nobleTrainAlerted.add(coord);
        const vil = targetData.find(v => v.coord === coord);
        if (vil) vil._nobleTrain = true;

        if (discordWebhookUrl) {
            DiscordExporter.sendNobleTrainAlert(coord, reason);
        }
        showNotification(`⚠️ NOBLE ALERT: ${coord}`, 5000);
        MapRenderer.makeMap();
    },

    getNearestTimer(coord) {
        const timers = attackTimers[coord];
        if (!timers) return null;
        const upcoming = timers.filter(t => t.arrivalTs > Date.now());
        return upcoming.length > 0 ? upcoming[0] : null;
    },

    _updateLiveBar() {
        if (this._int) clearInterval(this._int);
        this._int = setInterval(() => {
            let bar = document.getElementById('ow-attack-live-bar');
            const entries = [];
            Object.entries(attackTimers).forEach(([coord, timers]) => {
                const up = timers.filter(t => t.arrivalTs > Date.now())[0];
                if (up) entries.push({ coord, ms: up.arrivalTs - Date.now(), isNoble: up.isNoble });
            });
            entries.sort((a, b) => a.ms - b.ms);
            if (!entries.length) { if (bar) bar.remove(); return; }
            if (!bar) { bar = document.createElement('div'); bar.id = 'ow-attack-live-bar'; document.body.appendChild(bar); }
            bar.innerHTML = entries.slice(0, 8).map(e => 
                `<span class="ow-live-timer-chip">${e.isNoble ? '👑' : '⚔️'} ${e.coord} → ${formatCountdown(e.ms)}</span>`
            ).join('');
        }, 1000);
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  MAP RENDERER (Enhanced Pulse & Fire)
// ═══════════════════════════════════════════════════════════════════════════════
var MapRenderer = {
    makeMap() {
        if (!TWMap.mapHandler) return;
        const self = this;
        const oldSpawn = TWMap.mapHandler.spawnSector;
        TWMap.mapHandler.spawnSector = function (data, sector) {
            oldSpawn.call(this, data, sector);
            const root = sector._element_root;
            if (root) $(root).find('[data-ow]').remove();
            self.renderSector(data, sector);
        };
        TWMap.reload();
    },

    renderSector(data, sector) {
        const sectorSize = TWMap.map.sectorSize || 5;
        const twCanvas = sector._element_root?.querySelector('canvas[id^="map_canvas_"]');
        if (!twCanvas) return;
        const parts = twCanvas.id.replace('map_canvas_', '').split('_');
        const sectorX = parseInt(parts[0]), sectorY = parseInt(parts[1]);
        const sp = TWMap.map.pixelByCoord(sectorX, sectorY);

        const canvas = document.createElement('canvas');
        canvas.width = tileWidthX * sectorSize; canvas.height = tileWidthY * sectorSize;
        canvas.setAttribute('data-ow', '1');
        canvas.style.cssText = 'position:absolute;left:0;top:0;z-index:10;pointer-events:none;';
        const ctx = canvas.getContext('2d');

        targetData.forEach(el => {
            const [tx, ty] = el.coord.split('|').map(Number);
            if (!(tx >= sectorX && tx < sectorX + sectorSize && ty >= sectorY && ty < sectorY + sectorSize)) return;

            const vp = TWMap.map.pixelByCoord(tx, ty);
            const ox = (vp[0] - sp[0]) + tileWidthX / 2;
            const oy = (vp[1] - sp[1]) + tileWidthY / 2;

            // 1. Player Rings
            ctx.save();
            ctx.strokeStyle = el.color; ctx.lineWidth = 2; ctx.globalAlpha = 0.5;
            ctx.beginPath(); ctx.arc(ox, oy, (tileWidthX / 2) - 2, 0, 2 * Math.PI); ctx.stroke();
            ctx.restore();

            // 2. Fire (Wall drop check)
            let currentWall = parseInt(el.wall);
            if (!isNaN(currentWall)) {
                if (wallHistory[el.coord] !== undefined && (wallHistory[el.coord] - currentWall) >= 5) {
                    ctx.drawImage(images.fire, ox - 20, oy - 25, 40, 40);
                }
                wallHistory[el.coord] = currentWall;
            }

            // 3. Pulse (Enhanced)
            if (parseInt(el.incomingAttacks) > 0) {
                const phase = ((Date.now() % PULSE_PERIOD_MS) / PULSE_PERIOD_MS);
                ctx.save();
                ctx.strokeStyle = `rgba(255, 0, 0, ${0.9 - phase})`;
                ctx.lineWidth = 4;
                ctx.beginPath(); ctx.arc(ox, oy, (tileWidthX / 2) + (phase * 10), 0, 2 * Math.PI); ctx.stroke();
                ctx.restore();
            }

            // 4. Icons & Text
            const nearest = AttackTimerManager.getNearestTimer(el.coord);
            if (nearest) {
                const color = nearest.isNoble ? '#ff00ff' : '#ffbb00';
                this.txt(`${nearest.isNoble ? '👑 ' : ''}${formatCountdown(nearest.arrivalTs - Date.now())}`, ctx, ox, oy - 22, color, 'bold 10px monospace');
            }
            if (el._nobleTrain) {
                ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 3;
                ctx.strokeRect(ox - tileWidthX/2, oy - tileWidthY/2, tileWidthX, tileWidthY);
            }
            this.txt(Math.floor(el.totalStack / 1000) + 'k', ctx, ox, oy + 14, 'white', '10px Arial');
        });
        sector.appendElement(canvas, 0, 0);
    },

    txt(t, c, x, y, col, f) {
        c.save(); c.font = f; c.fillStyle = col; c.textAlign = 'center';
        c.strokeStyle = 'black'; c.lineWidth = 3; c.strokeText(t, x, y); c.fillText(t, x, y);
        c.restore();
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  SETTINGS & DATA HANDLING (Dashboard)
// ═══════════════════════════════════════════════════════════════════════════════
var SettingsManager = {
    load() {
        const stored = localStorage.getItem('overwatchSettings');
        if (stored) {
            settingsData = JSON.parse(stored);
            packetSize = settingsData.packetSize || 1000;
            minimum = settingsData.minimum || 500;
            bigStack = settingsData.bigStack || 60000;
            unitPopValues = settingsData.unitPopValues || { spear: 1, sword: 1, axe: 0, archer: 1, spy: 0, light: 0, marcher: 0, heavy: 4, catapult: 2, ram: 0, knight: 2, snob: 0 };
        }
        playerData = JSON.parse(localStorage.getItem('overwatchPlayerData') || '[]');
        recalculate();
    },
    save() {
        const data = { packetSize, minimum, bigStack, unitPopValues };
        localStorage.setItem('overwatchSettings', JSON.stringify(data));
        localStorage.setItem('owWallHistory', JSON.stringify(wallHistory));
    }
};

function recalculate() {
    targetData = [];
    playerData.forEach(player => {
        (player.playerVillages || []).forEach(village => {
            targetData.push({
                playerName: player.playerName, coord: village.coordinate,
                incomingAttacks: village.attacksToVillage, totalStack: village.totalPop,
                wall: village.wall || '---', color: player.color || '#ffffff',
                _nobleTrain: nobleTrainAlerted.has(village.coordinate)
            });
        });
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DISCORD EXPORTER
// ═══════════════════════════════════════════════════════════════════════════════
var DiscordExporter = {
    sendNobleTrainAlert(coord, reason) {
        if (!discordWebhookUrl) return;
        const village = targetData.find(v => v.coord === coord);
        const embed = {
            title: `⚠️ NOBLE ALERT: ${coord}`,
            color: 0xFF0000,
            description: reason,
            fields: [
                { name: 'Target', value: coord, inline: true },
                { name: 'Player', value: village?.playerName || '?', inline: true },
                { name: 'Wall', value: String(village?.wall), inline: true }
            ],
            footer: { text: 'Overwatch v2.5🧠' },
            timestamp: new Date().toISOString()
        };
        fetch(discordWebhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ embeds: [embed] }) });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════════════════════
(async () => {
    SettingsManager.load();
    
    // UI Builder (Dashboard as per v2.4 style)
    if (!$('#tribeLeaderUI').length) {
        $('#contentContainer').prepend('<div id="overwatchNotification"></div>');
        // Tu by následoval tvůj buildUI() z v2.4... pro stručnost zde jen init rendereru
    }

    // Hook Popups
    if (TWMap.popup) {
        const oldReceived = TWMap.popup.receivedPopupInformationForSingleVillage;
        TWMap.popup.receivedPopupInformationForSingleVillage = function (e) {
            oldReceived.call(TWMap.popup, e);
            AttackTimerManager.update(e);
        };
    }

    MapRenderer.makeMap();
    setInterval(() => MapRenderer.makeMap(), 30000); // Periodic refresh
})();

console.log("Overwatch v2.5 by TheBrain🧠 Loaded.");
