/**
 * Overwatch v2.7 by TheBrain🧠
 * * FIXES:
 * ✅ Skript se nyní správně spustí a načte data z localStorage
 * ✅ Barevné kruhy hráčů jsou zpět a plně funkční
 * ✅ Noble train detector propojen s Discordem a mapou
 * ✅ Pulse animace a hořící vesnice (wall drop > 5) aktivní
 */

// ─── Guard: redirect to map page if not already there ───────────────────────
if (window.location.href.indexOf('screen=map') < 0) {
    window.location.assign(game_data.link_base_pure + 'map');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CONSTANTS & ASSETS
// ═══════════════════════════════════════════════════════════════════════════════
var WATCHTOWER_RADIUS = [1.1, 1.3, 1.5, 1.7, 2, 2.3, 2.6, 3, 3.4, 3.9, 4.4, 5.1, 5.8, 6.7, 7.6, 8.7, 10, 11.5, 13.1, 15];
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
let playerData = JSON.parse(localStorage.getItem('overwatchPlayerData') || '[]');
let targetData = [];
let tileWidthX = TWMap.tileSize[0];
let tileWidthY = TWMap.tileSize[1];
let nobleTrainAlerted = new Set(); 
let discordWebhookUrl = localStorage.getItem('overwatchDiscordWebhook') || '';
let wallHistory = JSON.parse(localStorage.getItem('owWallHistory') || '{}');

// ═══════════════════════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════════════════════
$('<style>')
    .prop('type', 'text/css')
    .html(`
        #overwatchNotification { visibility:hidden; min-width:250px; background:#f4e4bc; color:#000; border:1px solid #7d510f; text-align:center; border-radius:2px; padding:16px; position:fixed; z-index:9999; left:50%; top:50px; transform: translateX(-50%); }
        #overwatchNotification.show { visibility:visible; animation:fadein .5s, fadeout .5s 2.5s; }
        @keyframes fadein { from { top:0; opacity:0; } to { top:50px; opacity:1; } }
        @keyframes fadeout { from { top:50px; opacity:1; } to { top:0; opacity:0; } }
    `).appendTo('head');

$('<div id="overwatchNotification"></div>').appendTo('body');

// ═══════════════════════════════════════════════════════════════════════════════
//  LOGIC & RENDERER
// ═══════════════════════════════════════════════════════════════════════════════

function showNotification(msg) {
    const x = $('#overwatchNotification');
    x.text(msg).addClass('show');
    setTimeout(() => x.removeClass('show'), 3000);
}

function recalculate() {
    targetData = [];
    playerData.forEach(player => {
        if (!player.playerVillages) return;
        player.playerVillages.forEach(village => {
            targetData.push({
                coord: village.coordinate,
                playerName: player.playerName,
                color: player.color || '#ffffff',
                incomingAttacks: village.attacksToVillage || 0,
                totalStack: village.totalPop || 0,
                wall: village.wall || 20,
                watchtower: village.watchtower || 0,
                _nobleTrain: nobleTrainAlerted.has(village.coordinate)
            });
        });
    });
}

var NobleDetector = {
    check(popupData) {
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
        const vil = targetData.find(v => v.coord === coord);
        if (vil) vil._nobleTrain = true;

        if (discordWebhookUrl) {
            fetch(discordWebhookUrl, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    username: 'Overwatch',
                    embeds: [{ title: `⚠️ ŠLECHTA NA CESTĚ: ${coord}`, color: 0xFF0000 }]
                })
            });
        }
        showNotification(`DETEKVÁNA ŠLECHTA NA ${coord}!`);
        TWMap.reload();
    }
};

var MapRenderer = {
    render(data, sector) {
        const sectorSize = TWMap.map.sectorSize || 5;
        const twCanvas = sector._element_root?.querySelector('canvas[id^="map_canvas_"]');
        if (!twCanvas) return;
        
        const parts = twCanvas.id.replace('map_canvas_', '').split('_');
        const sectorX = parseInt(parts[0]);
        const sectorY = parseInt(parts[1]);
        const sp = TWMap.map.pixelByCoord(sectorX, sectorY);

        const canvas = document.createElement('canvas');
        canvas.width = tileWidthX * sectorSize; canvas.height = tileWidthY * sectorSize;
        canvas.setAttribute('data-ow', 'true');
        canvas.style.cssText = 'position:absolute;left:0;top:0;z-index:10;pointer-events:none;';
        const ctx = canvas.getContext('2d');

        targetData.forEach(el => {
            const [tx, ty] = el.coord.split('|').map(Number);
            if (!(tx >= sectorX && tx < sectorX + sectorSize && ty >= sectorY && ty < sectorY + sectorSize)) return;

            const vp = TWMap.map.pixelByCoord(tx, ty);
            const ox = (vp[0] - sp[0]) + tileWidthX / 2;
            const oy = (vp[1] - sp[1]) + tileWidthY / 2;

            // 1. Barevný kruh hráče (RESTORED)
            ctx.save();
            ctx.strokeStyle = el.color;
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.arc(ox, oy, (tileWidthX / 2) - 3, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.restore();

            // 2. Šlechta - Červený rámeček
            if (el._nobleTrain) {
                ctx.save();
                ctx.strokeStyle = '#ff0000';
                ctx.lineWidth = 4;
                ctx.strokeRect(ox - tileWidthX/2 + 1, oy - tileWidthY/2 + 1, tileWidthX - 2, tileWidthY - 2);
                ctx.restore();
            }

            // 3. Wall drop (Hořící vesnice)
            let currWall = parseInt(el.wall);
            if (!isNaN(currWall)) {
                if (wallHistory[el.coord] !== undefined && (wallHistory[el.coord] - currWall) >= 5) {
                    ctx.drawImage(images.fire, ox - 20, oy - 25, 40, 40);
                }
                wallHistory[el.coord] = currWall;
            }

            // 4. Pulse pro útoky
            const atks = parseInt(el.incomingAttacks);
            if (atks > 0) {
                const phase = ((Date.now() % PULSE_PERIOD_MS) / PULSE_PERIOD_MS);
                ctx.save();
                ctx.strokeStyle = `rgba(255, 0, 0, ${0.8 - phase})`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(ox, oy, (tileWidthX/2) + (phase * 8), 0, 2 * Math.PI);
                ctx.stroke();
                ctx.restore();
                
                this.drawText(atks, ctx, ox, oy - 10, '#ff0000', 'bold 16px Arial');
            }

            // 5. Stack Info
            this.drawText(Math.floor(el.totalStack / 1000) + 'k', ctx, ox, oy + 15, 'white', '11px Arial');
        });

        sector.appendElement(canvas, 0, 0);
    },

    drawText(text, ctx, x, y, color, font) {
        ctx.save();
        ctx.font = font; ctx.fillStyle = color; ctx.textAlign = 'center';
        ctx.strokeStyle = 'black'; ctx.lineWidth = 3; ctx.strokeText(text, x, y);
        ctx.fillText(text, x, y);
        ctx.restore();
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════
function init() {
    recalculate();
    
    // Hook map
    const oldSpawn = TWMap.mapHandler.spawnSector;
    TWMap.mapHandler.spawnSector = function(data, sector) {
        oldSpawn.call(this, data, sector);
        $(sector._element_root).find('[data-ow]').remove();
        MapRenderer.render(data, sector);
    };

    // Hook popups
    const oldPopup = TWMap.popup.receivedPopupInformationForSingleVillage;
    TWMap.popup.receivedPopupInformationForSingleVillage = function(e) {
        oldPopup.call(TWMap.popup, e);
        NobleDetector.check(e);
    };

    // Auto-refresh map for animations
    setInterval(() => {
        if (TWMap.mapHandler) TWMap.reload();
    }, 2500);

    localStorage.setItem('owWallHistory', JSON.stringify(wallHistory));
    showNotification("Overwatch v2.7 načten 🧠");
}

init();

// Signature
console.log("Powered by TheBrain🧠");
