/**
 * Overwatch v2.6 by TheBrain🧠
 * * CHANGES:
 * ✅ Player-colored rings RESTORED (thin ring around village tile)
 * ✅ Noble train detector alerts Discord & Map on any noble movement
 * ✅ Pulse animation aggressive & visible
 * ✅ Burning village animation for wall drops > 5 levels 🔥
 * ❌ Sector priority scoring remains removed
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
    farm: new Image(),
    fire: new Image()
};
images.attack.src = '/graphic//map/incoming_attack.webp';
images.wall.src = '/graphic/buildings/wall.webp';
images.farm.src = '/graphic/buildings/farm.webp';
images.fire.src = 'https://dsen.innogamescdn.com/asset/98710b2/graphic/map/map_fire.png';

// ═══════════════════════════════════════════════════════════════════════════════
//  STATE & STORAGE
// ═══════════════════════════════════════════════════════════════════════════════
let targetData = [];
let tileWidthX = TWMap.tileSize[0];
let tileWidthY = TWMap.tileSize[1];
let nobleTrainAlerted = new Set(); 
let discordWebhookUrl = localStorage.getItem('overwatchDiscordWebhook') || '';
let wallHistory = JSON.parse(localStorage.getItem('owWallHistory') || '{}');

// ═══════════════════════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════════════════════
$('#contentContainer').eq(0).prepend(`<style>
    #overwatchNotification{visibility:hidden;min-width:250px;margin-left:-125px;background:#f4e4bc;color:#000;border:1px solid #7d510f;text-align:center;border-radius:2px;padding:16px;position:fixed;z-index:9999;left:50%;top:50px;}
    #overwatchNotification.show{visibility:visible;animation:fadein .5s,fadeout .5s 2.5s;}
    @keyframes ow-noble-pulse { 0%,100%{box-shadow:0 0 15px 5px #ff0000; outline: 3px solid #ff0000;} 50%{box-shadow:0 0 25px 10px #ff4400; outline: 5px solid #ffbb00;} }
</style>`);

// ═══════════════════════════════════════════════════════════════════════════════
//  DETECTION LOGIC
// ═══════════════════════════════════════════════════════════════════════════════
var NobleDetector = {
    update(popupData) {
        if (!popupData || !popupData.xy) return;
        let xy = popupData.xy.toString();
        let coord = xy.includes('|') ? xy : xy.substring(0, 3) + '|' + xy.substring(3, 6);
        
        let isNoble = false;
        let atkList = popupData.attacks || popupData.incomings || [];
        
        atkList.forEach(atk => {
            if (atk.icon && (atk.icon.includes('snob') || atk.icon.includes('noble'))) isNoble = true;
        });

        if (isNoble && !nobleTrainAlerted.has(coord)) {
            this.alert(coord);
        }
    },

    alert(coord) {
        nobleTrainAlerted.add(coord);
        const village = targetData.find(v => v.coord === coord);
        if (village) village._nobleTrain = true;

        if (discordWebhookUrl) {
            fetch(discordWebhookUrl, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    username: 'Overwatch Noble Alert',
                    embeds: [{
                        title: `⚠️ ŠLECHTA NA CESTĚ: ${coord}`,
                        color: 0xFF0000,
                        timestamp: new Date().toISOString()
                    }]
                })
            });
        }
        MapRenderer.redraw();
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  MAP RENDERER (Vracíme prstence + nové efekty)
// ═══════════════════════════════════════════════════════════════════════════════
var MapRenderer = {
    renderSector(data, sector) {
        const sectorSize = TWMap.map.sectorSize || 5;
        const tileW = TWMap.tileSize[0];
        const tileH = TWMap.tileSize[1];
        const twCanvas = sector._element_root?.querySelector('canvas[id^="map_canvas_"]');
        if (!twCanvas) return;
        
        const parts = twCanvas.id.replace('map_canvas_', '').split('_');
        const sectorX = parseInt(parts[0]);
        const sectorY = parseInt(parts[1]);
        const sp = TWMap.map.pixelByCoord(sectorX, sectorY);

        const canvas = document.createElement('canvas');
        canvas.width = tileW * sectorSize; canvas.height = tileH * sectorSize;
        canvas.setAttribute('data-ow', `${sectorX}_${sectorY}`);
        canvas.style.cssText = 'position:absolute;left:0;top:0;z-index:10;pointer-events:none;';
        const ctx = canvas.getContext('2d');

        targetData.forEach(el => {
            const [tx, ty] = el.coord.split('|').map(Number);
            if (!(tx >= sectorX && tx < sectorX + sectorSize && ty >= sectorY && ty < sectorY + sectorSize)) return;

            const vp = TWMap.map.pixelByCoord(tx, ty);
            const ox = (vp[0] - sp[0]) + tileW / 2;
            const oy = (vp[1] - sp[1]) + tileH / 2;

            // 1. Player Colored Ring (RESTORED)
            ctx.save();
            ctx.strokeStyle = el.color || '#ffffff';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.arc(ox, oy, (tileW / 2) - 2, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.restore();

            // 2. Noble Train Alert (Red glow border)
            if (el._nobleTrain) {
                ctx.save();
                ctx.strokeStyle = '#ff0000';
                ctx.lineWidth = 4;
                ctx.strokeRect(ox - tileW/2 + 1, oy - tileH/2 + 1, tileW - 2, tileH - 2);
                ctx.restore();
            }

            // 3. Burning Village (Wall drop)
            let currentWall = parseInt(el.wall);
            if (!isNaN(currentWall)) {
                let prevWall = wallHistory[el.coord];
                if (prevWall !== undefined && (prevWall - currentWall) >= 5) {
                    ctx.drawImage(images.fire, ox - 20, oy - 25, 40, 40);
                }
                wallHistory[el.coord] = currentWall;
            }

            // 4. Attack Pulse
            const isAttacked = parseInt(el.incomingAttacks) > 0;
            if (isAttacked) {
                const phase = ((Date.now() % PULSE_PERIOD_MS) / PULSE_PERIOD_MS);
                ctx.save();
                ctx.strokeStyle = `rgba(255, 0, 0, ${0.8 - phase})`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(ox, oy, (tileW/2) + (phase * 6), 0, 2 * Math.PI);
                ctx.stroke();
                ctx.restore();
                
                this.textOnMap(el.incomingAttacks, ctx, ox, oy - 10, '#ff0000', 'bold 16px Arial', true);
            }

            // 5. General Info
            this.textOnMap(Math.floor(el.totalStack / 1000) + 'k', ctx, ox, oy + 15, 'white', '11px Arial', true);
        });

        sector.appendElement(canvas, 0, 0);
    },

    textOnMap(text, ctx, x, y, color, font, shadow) {
        ctx.save();
        ctx.font = font; ctx.fillStyle = color; ctx.textAlign = 'center';
        if (shadow) { ctx.strokeStyle = 'black'; ctx.lineWidth = 3; ctx.strokeText(text, x, y); }
        ctx.fillText(text, x, y);
        ctx.restore();
    },

    redraw() {
        if (!TWMap.mapHandler) return;
        TWMap.reload();
    }
};

// Hook into popups for noble detection
if (TWMap.popup) {
    const origReceived = TWMap.popup.receivedPopupInformationForSingleVillage;
    TWMap.popup.receivedPopupInformationForSingleVillage = function(e) {
        origReceived.call(TWMap.popup, e);
        NobleDetector.update(e);
    };
}

// Map injection
const origSpawn = TWMap.mapHandler.spawnSector;
TWMap.mapHandler.spawnSector = function(data, sector) {
    origSpawn.call(this, data, sector);
    $(sector._element_root).find('[data-ow]').remove();
    MapRenderer.renderSector(data, sector);
};

// Save wall history periodically
setInterval(() => localStorage.setItem('owWallHistory', JSON.stringify(wallHistory)), 10000);

// Loop redraw for animations
setInterval(() => MapRenderer.redraw(), 2500);

console.log("Overwatch v2.6: Rings restored. Powered by TheBrain🧠");
