/**
 * Overwatch v2.3 by TheBrain (heavily revised & extended)
 *
 * NEW FEATURES (v2.3):
 *  1. Attack timer overlay   – live countdown to nearest incoming impact per village
 *  2. Noble train detector   – 4+ attacks from same source → red border + browser notification + Discord webhook
 *  3. Player-colored rings   – thin ring in player color around each village tile
 *  4. Pulse animation        – attacked villages slowly pulse on canvas overlay
 *  5. Auto-refresh           – configurable interval (default 15 min), background fetch + diff notification
 *  6. Discord webhook export – "Send to Discord" button in Import/Export tab, webhook URL in settings
 *  7. Sector priority score  – avg stack per sector displayed on minimap as number overlay
 *  +  Tooltips on all dashboard controls
 *
 * FIXES v2.0 → v2.1:
 *  - renderSector: data.x/data.y použito místo sector.x/sector.y pro výpočet pozice
 *  - sectorSize odvozen z data.tiles místo neexistujícího map.sectorSize
 *  - canvas rozměry opraveny (tileWidthX/Y místo neexistujícího map.scale[])
 *  - mapOverlay.reload() → TWMap.mapHandler.onReload()
 *  - unitsEnRoute překlep opraven (unitsEnroute → unitsEnRoute konzistentně)
 *  - batchGetAll race condition opravena (atomic nextIdx++)
 *  - batchSize snížen na 2 (prevence 429 Too Many Requests)
 *
 * BOOKMARKLET USAGE:
 *  javascript:(function(){var s=document.createElement('script');s.src='YOUR_RAW_GITHUB_URL/overwatch.js?_='+Date.now();document.head.appendChild(s);})();
 */

// ─── Guard: redirect to map page if not already there ───────────────────────
if (window.location.href.indexOf('screen=map') < 0) {
    window.location.assign(game_data.link_base_pure + 'map');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
var WATCHTOWER_RADIUS = [1.1, 1.3, 1.5, 1.7, 2, 2.3, 2.6, 3, 3.4, 3.9, 4.4, 5.1, 5.8, 6.7, 7.6, 8.7, 10, 11.5, 13.1, 15];
var DEFAULT_COLORS = [
    { color: "#FF0000", opacity: 0.3 }, { color: "#FF5100", opacity: 0.3 }, { color: "#FFAE00", opacity: 0.3 },
    { color: "#F2FF00", opacity: 0.3 }, { color: "#B7FF00", opacity: 0.3 }, { color: "#62FF00", opacity: 0.3 },
    { color: "#04FF00", opacity: 0.3 }, { color: "#00FF7B", opacity: 0.3 }, { color: "#00FFAE", opacity: 0.3 },
    { color: "#00C8FF", opacity: 0.3 }, { color: "#006AFF", opacity: 0.3 }, { color: "#1500FF", opacity: 0.3 },
    { color: "#4000FF", opacity: 0.3 }, { color: "#8C00FF", opacity: 0.3 }, { color: "#FF00D9", opacity: 0.3 }
];
var CACHE_TTL_DEFAULT = 30; // minutes
var TREND_MAX_SNAPSHOTS = 24;
var NOBLE_TRAIN_THRESHOLD = 4;
var AUTO_REFRESH_DEFAULT = 15; // minutes
var PULSE_PERIOD_MS = 1200; // ms for one pulse cycle

// ═══════════════════════════════════════════════════════════════════════════════
//  GLOBAL STATE
// ═══════════════════════════════════════════════════════════════════════════════
let options, playerIDs, urls = [], buildingUrls = [], playerData = [];
let mapOverlay = TWMap;
let targetData = [];
let tileWidthX = TWMap.tileSize[0];
let tileWidthY = TWMap.tileSize[1];
let selectedVillages = [];
let selectedVillageSet = new Set();
let settingsData, unitPopValues, packetSize, minimum, smallStack, mediumStack, bigStack, targetStackSize;
let cacheTTL = CACHE_TTL_DEFAULT;
let activeFilters = new Set();
let stackHistory = {};
let ownVillages = [];

// v2.3 state
let attackTimers = {};           // coord → { arrivalTs, source, count }[]
let nobleTrainAlerted = new Set(); // coords already alerted this session
let autoRefreshInterval = AUTO_REFRESH_DEFAULT;
let autoRefreshTimer = null;
let discordWebhookUrl = '';
let sectorScores = {};           // "X_Y" → avg stack
let pulseAnimFrame = null;
let pulseTs = 0;

// Images for map overlay
var images = Array.from({ length: 3 }, () => new Image());
images[0].src = '/graphic//map/incoming_attack.webp';
images[1].src = '/graphic/buildings/wall.webp';
images[2].src = '/graphic/buildings/farm.webp';

// ═══════════════════════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════════════════════
$('#contentContainer').eq(0).prepend(`<style>
    .overviewWithPadding th,.overviewWithPadding td{padding:2px 10px;}
    #overwatchNotification{
        visibility:hidden;min-width:250px;margin-left:-125px;
        background-color:#f4e4bc;color:#000;border:1px solid #7d510f;
        text-align:center;border-radius:2px;padding:16px;
        position:fixed;z-index:9999;left:50%;top:50px;
    }
    #overwatchNotification.show{visibility:visible;animation:fadein .5s,fadeout .5s 2.5s;}
    @keyframes fadein{from{top:0;opacity:0}to{top:50px;opacity:1}}
    @keyframes fadeout{from{top:50px;opacity:1}to{top:0;opacity:0}}
    .middle{position:relative;width:100%;max-width:500px;}
    .slider{position:relative;z-index:1;height:10px;margin:0 15px;}
    .slider>.track{position:absolute;z-index:1;left:0;right:0;top:0;bottom:0;border-radius:5px;background-image:linear-gradient(to right,black,red,yellow,green);}
    .slider>.range{position:absolute;z-index:2;left:25%;right:25%;top:0;bottom:0;border-radius:5px;background-color:#FF0000;}
    .slider>.thumb{position:absolute;z-index:3;width:20px!important;height:20px;border-radius:50%;box-shadow:0 0 0 0 rgba(255,255,0,.1);transition:box-shadow .3s ease-in-out;}
    .slider>.thumb.left{background-color:#FF0000!important;left:25%;transform:translate(-10px,-5px);}
    .slider>.thumb.right{background-color:#FF0000!important;right:25%;transform:translate(10px,-5px);}
    .slider>.thumb.hover{box-shadow:0 0 0 20px rgba(255,0,0,.1);}
    .slider>.thumb.active{box-shadow:0 0 0 40px rgba(255,0,0,.2);}
    input[type=range]{position:absolute;pointer-events:none;-webkit-appearance:none;z-index:2;height:10px;width:100%;opacity:0;}
    input[type=range]::-webkit-slider-thumb{pointer-events:all;width:30px;height:30px;border-radius:0;border:0 none;background-color:red;-webkit-appearance:none;}
    #owFilterBar{display:flex;gap:6px;padding:6px 12px;background:#e8d5a3;border-bottom:1px solid #7d510f;flex-wrap:wrap;}
    .ow-filter-btn{padding:2px 10px;border:1px solid #7d510f;border-radius:3px;background:#f4e4bc;cursor:pointer;font-size:12px;user-select:none;}
    .ow-filter-btn.active{background:#7d510f;color:#fff;}
    .ow-trend-up{color:#00cc00;font-weight:bold;}
    .ow-trend-down{color:#cc0000;font-weight:bold;}
    #owPacketCalc{position:fixed;z-index:10000;background:#f4e4bc;border:2px solid #7d510f;border-radius:6px;padding:16px;min-width:340px;box-shadow:4px 4px 12px rgba(0,0,0,.4);}
    #owPacketCalc h2{margin:0 0 10px;font-size:15px;}
    #owPacketCalc select{width:100%;margin-bottom:8px;}
    #owPacketCalc table{width:100%;border-collapse:collapse;font-size:12px;}
    #owPacketCalc td{padding:2px 6px;}
    #ow-progress-wrap{position:fixed;top:0;left:0;right:0;z-index:99999;background:#7d510f;height:4px;}
    #ow-progress-bar{height:4px;background:#f4e4bc;width:0%;transition:width .2s;}
    canvas[data-ow]{pointer-events:none!important;}
    canvas[data-ow-mini]{pointer-events:none!important;}
    /* ── Stack Settings – force readable text on light vis backgrounds ── */
    #stackSize .vis th,
    #stackSize .vis td,
    #stackSize label,
    #stackSize .vis input[type=text] {
        color: #000 !important;
        background-color: #fff;
    }
    #stackSize .vis thead th {
        background-color: #c1a264;
        color: #000 !important;
    }
    /* ── v2.3 Noble Train highlight ── */
    @keyframes ow-noble-pulse {
        0%,100%{box-shadow:0 0 0 3px #ff0000;}
        50%{box-shadow:0 0 12px 6px #ff4400;}
    }
    .ow-noble-highlight { animation: ow-noble-pulse 0.8s infinite; }
    /* ── v2.3 Attack timer badge ── */
    .ow-timer-badge {
        position:absolute;font-size:9px;font-weight:bold;color:#fff;
        background:rgba(180,0,0,0.85);border-radius:3px;padding:1px 3px;
        pointer-events:none;z-index:20;white-space:nowrap;
    }
    /* ── v2.3 Tooltips ── */
    [data-ow-tip]{position:relative;}
    [data-ow-tip]:hover::after{
        content:attr(data-ow-tip);
        position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);
        background:rgba(20,0,0,0.95);color:#d4af37;font-size:11px;
        border:1px solid #d4af37;border-radius:4px;padding:5px 9px;
        white-space:nowrap;z-index:99999;pointer-events:none;
        box-shadow:0 2px 8px rgba(0,0,0,.6);
    }
    /* ── v2.3 Auto-refresh indicator ── */
    #ow-refresh-indicator{
        position:fixed;bottom:8px;right:8px;background:rgba(20,0,0,.85);
        color:#d4af37;font-size:10px;border:1px solid #d4af37;border-radius:4px;
        padding:3px 8px;z-index:9998;pointer-events:none;
    }
    /* ── v2.3 Sector score canvas ── */
    canvas[data-ow-sector]{pointer-events:none!important;}
    /* ── v2.3 diff notification ── */
    #ow-diff-popup{
        position:fixed;top:60px;right:24px;z-index:10001;
        background:rgba(20,0,0,.95);color:#d4af37;border:1px solid #d4af37;
        border-radius:6px;padding:12px 16px;max-width:320px;font-size:12px;
        box-shadow:0 4px 16px rgba(0,0,0,.6);
    }
    #ow-diff-popup h3{margin:0 0 6px;font-size:13px;color:#fff;}
    #ow-diff-popup .ow-diff-row{display:flex;justify-content:space-between;gap:12px;padding:1px 0;}
    #ow-diff-popup .up{color:#00ff88;}
    #ow-diff-popup .down{color:#ff4444;}
</style>`);

// ═══════════════════════════════════════════════════════════════════════════════
//  UTILITY HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function showNotification(msg, duration = 3000) {
    const x = document.getElementById('overwatchNotification');
    if (!x) return;
    x.innerText = msg;
    x.className = 'show';
    setTimeout(() => { x.className = x.className.replace('show', ''); }, duration);
}

function numberWithCommas(x) {
    x = String(x);
    const pattern = /(-?\d+)(\d{3})/;
    while (pattern.test(x)) x = x.replace(pattern, '$1.$2');
    return x;
}

function coordInt(s) { return parseInt(s, 10); }

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function setProgress(pct) {
    let wrap = document.getElementById('ow-progress-wrap');
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'ow-progress-wrap';
        const bar = document.createElement('div');
        bar.id = 'ow-progress-bar';
        wrap.appendChild(bar);
        document.body.appendChild(wrap);
    }
    document.getElementById('ow-progress-bar').style.width = clamp(pct, 0, 100) + '%';
    if (pct >= 100) setTimeout(() => wrap.remove(), 600);
}

function formatCountdown(ms) {
    if (ms <= 0) return '00:00:00';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SETTINGS MANAGER
// ═══════════════════════════════════════════════════════════════════════════════
var SettingsManager = {
    load() {
        const stored = localStorage.getItem('overwatchSettings');
        if (stored) {
            try {
                settingsData = JSON.parse(stored);
                packetSize = settingsData.packetSize || 1000;
                minimum = settingsData.minimum || 500;
                smallStack = settingsData.smallStack || 20000;
                mediumStack = settingsData.mediumStack || 40000;
                bigStack = settingsData.bigStack || 60000;
                unitPopValues = settingsData.unitPopValues || this._defaultUnits();
                cacheTTL = settingsData.cacheTTL || CACHE_TTL_DEFAULT;
                autoRefreshInterval = settingsData.autoRefreshInterval || AUTO_REFRESH_DEFAULT;
                discordWebhookUrl = settingsData.discordWebhookUrl || '';
                targetStackSize = bigStack;
                if (settingsData.playerSettings && playerData.length) {
                    settingsData.playerSettings.forEach((ps, i) => {
                        if (playerData[i]) {
                            playerData[i].color = ps[0] && ps[0].color;
                            playerData[i].opacity = ps[0] && parseFloat(ps[0].opacity);
                            playerData[i].checkedWT = ps[1] && ps[1].checkedWT;
                            playerData[i].checkedWTMini = ps[1] && ps[1].checkedWTMini;
                        }
                    });
                }
            } catch (e) {
                console.warn('Overwatch: failed to parse settings, resetting.', e);
                this.setDefaults();
            }
        } else {
            this.setDefaults();
        }
        const hist = localStorage.getItem('overwatchStackHistory');
        if (hist) {
            try { stackHistory = JSON.parse(hist); } catch (e) { stackHistory = {}; }
        }
    },

    _defaultUnits() {
        return { spear: 1, sword: 1, archer: 1, axe: 0, spy: 0, light: 0, marcher: 0, heavy: 4, catapult: 2, ram: 0, knight: 2, militia: 1, snob: 0 };
    },

    setDefaults() {
        unitPopValues = this._defaultUnits();
        packetSize = 1000;
        minimum = 500;
        smallStack = 20000;
        mediumStack = 40000;
        bigStack = 60000;
        cacheTTL = CACHE_TTL_DEFAULT;
        autoRefreshInterval = AUTO_REFRESH_DEFAULT;
        discordWebhookUrl = '';
        targetStackSize = bigStack;
        this.save();
    },

    save() {
        const playerSettings = playerData.map(player => [
            { color: player.color, opacity: player.opacity },
            { checkedWT: player.checkedWT, checkedWTMini: player.checkedWTMini }
        ]);
        const data = {
            packetSize, minimum, smallStack, mediumStack, bigStack, cacheTTL,
            playerSettings, unitPopValues, autoRefreshInterval, discordWebhookUrl
        };
        localStorage.setItem('overwatchSettings', JSON.stringify(data));
        showNotification('Settings saved');
    },

    updateFromUI() {
        Object.keys(unitPopValues).forEach(unit => {
            const el = document.getElementById(unit);
            if (el) unitPopValues[unit] = parseFloat(el.value) || 0;
        });
        packetSize = parseFloat($('#packetSize').val()) || 1000;
        cacheTTL = parseFloat($('#cacheTTL').val()) || CACHE_TTL_DEFAULT;
        autoRefreshInterval = parseFloat($('#autoRefreshInterval').val()) || AUTO_REFRESH_DEFAULT;
        discordWebhookUrl = $('#discordWebhookUrl').val().trim();
        playerData.forEach(player => {
            const id = player.playerID.replace(/[\s()]/g, '');
            const valEl = document.getElementById('val' + id);
            const alpEl = document.getElementById('alp' + id);
            if (valEl) player.color = valEl.value;
            if (alpEl) player.opacity = parseFloat(alpEl.value) || 0.3;
            player.checkedWT = !!$('#checkMapWT' + id).prop('checked');
            player.checkedWTMini = !!$('#checkWTMini' + id).prop('checked');
        });
        AutoRefreshManager.restart();
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  STACK TREND / HISTORY
// ═══════════════════════════════════════════════════════════════════════════════
var TrendManager = {
    snapshot() {
        const ts = Date.now();
        targetData.forEach(v => {
            if (!stackHistory[v.coord]) stackHistory[v.coord] = [];
            stackHistory[v.coord].push({ ts, stack: v.totalStack });
            if (stackHistory[v.coord].length > TREND_MAX_SNAPSHOTS)
                stackHistory[v.coord].shift();
        });
        localStorage.setItem('overwatchStackHistory', JSON.stringify(stackHistory));
    },

    getTrend(coord) {
        const hist = stackHistory[coord];
        if (!hist || hist.length < 2) return 0;
        const last = hist[hist.length - 1].stack;
        const prev = hist[hist.length - 2].stack;
        return last - prev;
    },

    getTrendArrow(coord) {
        const delta = this.getTrend(coord);
        if (delta > 0) return '<span class="ow-trend-up">↑</span>';
        if (delta < 0) return '<span class="ow-trend-down">↓</span>';
        return '–';
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  NOTIFICATION MANAGER
// ═══════════════════════════════════════════════════════════════════════════════
var NotificationManager = {
    _prevAttacks: {},

    requestPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    },

    checkNewAttacks() {
        targetData.forEach(v => {
            const prev = this._prevAttacks[v.coord] || 0;
            const cur = parseInt(v.incomingAttacks) || 0;
            if (cur > prev && prev !== 0) {
                this._sendBrowserNotification(
                    `New incoming! ${v.coord}`,
                    `${v.playerName} – ${cur} attack(s) incoming. Stack: ${numberWithCommas(Math.floor(v.totalStack / 1000))}k`
                );
            }
            this._prevAttacks[v.coord] = cur;
        });
    },

    _sendBrowserNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body, icon: '/graphic//map/incoming_attack.webp' });
        } else {
            showNotification(title + ' – ' + body, 5000);
        }
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  v2.3 ATTACK TIMER MANAGER
// ═══════════════════════════════════════════════════════════════════════════════
var AttackTimerManager = {
    /**
     * Called from the getTroops/popup intercept with raw popup data.
     * We look for an arrival_time field (Tribal Wars includes this in the
     * village popup data as a Unix timestamp or ISO string).
     */
    update(popupData) {
        if (!popupData?.xy) return;
        const xy = popupData.xy.toString();
        const coord = xy.substring(0, 3) + '|' + xy.substring(3, 6);

        // TW popup exposes incoming attack list in various forms
        // Try the most common paths:
        const rawAttacks = popupData.attacks || popupData.incomings || [];
        const timers = [];

        if (Array.isArray(rawAttacks)) {
            rawAttacks.forEach(atk => {
                const ts = atk.arrival_time
                    ? (typeof atk.arrival_time === 'number' ? atk.arrival_time * 1000 : new Date(atk.arrival_time).getTime())
                    : null;
                if (ts && !isNaN(ts)) {
                    timers.push({
                        arrivalTs: ts,
                        source: atk.village_id || atk.attacker_village || '?',
                        attacker: atk.attacker_player || '?'
                    });
                }
            });
        }

        // If no structured data, check for a nearest_attack_time top-level field
        if (timers.length === 0 && popupData.nearest_attack_time) {
            const ts = popupData.nearest_attack_time * 1000;
            if (!isNaN(ts)) timers.push({ arrivalTs: ts, source: '?', attacker: '?' });
        }

        if (timers.length > 0) {
            timers.sort((a, b) => a.arrivalTs - b.arrivalTs);
            attackTimers[coord] = timers;
        }

        // Noble train check
        this._checkNobleTrain(coord, timers);
    },

    _checkNobleTrain(coord, timers) {
        if (nobleTrainAlerted.has(coord)) return;
        const sourceCounts = {};
        timers.forEach(t => {
            sourceCounts[t.source] = (sourceCounts[t.source] || 0) + 1;
        });
        const trainSource = Object.keys(sourceCounts).find(k => sourceCounts[k] >= NOBLE_TRAIN_THRESHOLD);
        if (trainSource) {
            nobleTrainAlerted.add(coord);
            NobleTrainDetector.alert(coord, trainSource, sourceCounts[trainSource]);
        }
    },

    getNearestTimer(coord) {
        const timers = attackTimers[coord];
        if (!timers || timers.length === 0) return null;
        const now = Date.now();
        const upcoming = timers.filter(t => t.arrivalTs > now);
        if (upcoming.length === 0) return null;
        return upcoming[0];
    },

    getCountdownText(coord) {
        const t = this.getNearestTimer(coord);
        if (!t) return null;
        const ms = t.arrivalTs - Date.now();
        return formatCountdown(ms);
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  v2.3 NOBLE TRAIN DETECTOR
// ═══════════════════════════════════════════════════════════════════════════════
var NobleTrainDetector = {
    alert(coord, sourceId, count) {
        const msg = `⚠️ POSSIBLE NOBLE TRAIN on ${coord} – ${count} attacks from same source!`;
        NotificationManager._sendBrowserNotification('⚠️ NOBLE TRAIN DETECTED', msg);
        showNotification(msg, 8000);

        // Highlight tile on map (visual flash via overlay)
        this._highlightOnMap(coord);

        // Discord webhook
        if (discordWebhookUrl) {
            DiscordExporter.sendNobleTrainAlert(coord, sourceId, count);
        }
    },

    _highlightOnMap(coord) {
        // We redraw with noble train flag
        const el = targetData.find(v => v.coord === coord);
        if (el) {
            el._nobleTrain = true;
            MapRenderer.makeMap();
        }
    },

    /**
     * Also scan all villages every time popup data is refreshed
     * by counting incoming attacks grouped by source player.
     * This uses the targetData.incomingAttacks count as a fallback.
     */
    scanAll() {
        // Group by coord → source attacks if attack timer data available
        targetData.forEach(v => {
            if (attackTimers[v.coord]) {
                const sourceCounts = {};
                attackTimers[v.coord].forEach(t => {
                    sourceCounts[t.source] = (sourceCounts[t.source] || 0) + 1;
                });
                const trainSource = Object.keys(sourceCounts).find(k => sourceCounts[k] >= NOBLE_TRAIN_THRESHOLD);
                if (trainSource && !nobleTrainAlerted.has(v.coord)) {
                    nobleTrainAlerted.add(v.coord);
                    this.alert(v.coord, trainSource, sourceCounts[trainSource]);
                }
            }
        });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  v2.3 AUTO-REFRESH MANAGER
// ═══════════════════════════════════════════════════════════════════════════════
var AutoRefreshManager = {
    _countdown: 0,
    _tickTimer: null,

    start() {
        this.stop();
        if (!autoRefreshInterval || autoRefreshInterval <= 0) return;
        this._countdown = autoRefreshInterval * 60;
        this._updateIndicator();
        this._tickTimer = setInterval(() => this._tick(), 1000);
        console.log(`Overwatch: auto-refresh every ${autoRefreshInterval} min`);
    },

    stop() {
        if (this._tickTimer) { clearInterval(this._tickTimer); this._tickTimer = null; }
        const ind = document.getElementById('ow-refresh-indicator');
        if (ind) ind.remove();
    },

    restart() {
        this.stop();
        this.start();
    },

    _tick() {
        this._countdown--;
        this._updateIndicator();
        if (this._countdown <= 0) {
            this._doRefresh();
        }
    },

    _updateIndicator() {
        let ind = document.getElementById('ow-refresh-indicator');
        if (!ind) {
            ind = document.createElement('div');
            ind.id = 'ow-refresh-indicator';
            document.body.appendChild(ind);
        }
        ind.textContent = `🔄 Auto-refresh in ${formatCountdown(this._countdown * 1000)}`;
    },

    async _doRefresh() {
        this._countdown = autoRefreshInterval * 60;
        showNotification('Auto-refresh: fetching data…', 60000);
        const oldData = JSON.parse(JSON.stringify(targetData));

        // Invalidate cache
        localStorage.removeItem('overwatchPlayerData');
        localStorage.removeItem('overwatchPlayerDataTs');

        try {
            await DataManager.fetchPlayerIDs();
            await DataManager.fetchBuildingIDs();
            await DataManager.fetchAllData(true /* silent */);
            DiffManager.show(oldData, targetData);
            TrendManager.snapshot();
            NotificationManager.checkNewAttacks();
            NobleTrainDetector.scanAll();
        } catch (e) {
            showNotification('Auto-refresh error: ' + e.message, 5000);
        }
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  v2.3 DIFF MANAGER – shows what changed after auto-refresh
// ═══════════════════════════════════════════════════════════════════════════════
var DiffManager = {
    show(oldData, newData) {
        $('#ow-diff-popup').remove();
        const changes = [];
        const oldMap = {};
        oldData.forEach(v => { oldMap[v.coord] = v; });

        newData.forEach(v => {
            const old = oldMap[v.coord];
            if (!old) { changes.push({ coord: v.coord, type: 'new' }); return; }
            const delta = Math.floor(v.totalStack) - Math.floor(old.totalStack);
            if (Math.abs(delta) > 500) changes.push({ coord: v.coord, delta, type: delta > 0 ? 'up' : 'down' });
            const oldAtk = parseInt(old.incomingAttacks) || 0;
            const newAtk = parseInt(v.incomingAttacks) || 0;
            if (newAtk > oldAtk) changes.push({ coord: v.coord, type: 'attack', count: newAtk - oldAtk });
        });

        if (changes.length === 0) {
            showNotification('Auto-refresh: no significant changes', 3000);
            return;
        }

        const rows = changes.slice(0, 8).map(c => {
            if (c.type === 'attack') return `<div class="ow-diff-row"><span>${c.coord}</span><span style="color:#ff4444">+${c.count} incoming</span></div>`;
            if (c.type === 'new') return `<div class="ow-diff-row"><span>${c.coord}</span><span class="up">NEW</span></div>`;
            const cls = c.type === 'up' ? 'up' : 'down';
            return `<div class="ow-diff-row"><span>${c.coord}</span><span class="${cls}">${c.delta > 0 ? '+' : ''}${numberWithCommas(c.delta)}</span></div>`;
        }).join('');

        const popup = $(`
            <div id="ow-diff-popup">
                <h3>🔄 Refresh diff (${changes.length} changes)</h3>
                ${rows}
                ${changes.length > 8 ? `<div style="opacity:.6">…and ${changes.length - 8} more</div>` : ''}
                <div style="text-align:right;margin-top:6px;"><a href="#" id="owDiffClose" style="color:#d4af37;font-size:11px;">Close ×</a></div>
            </div>
        `);
        $('body').append(popup);
        $('#owDiffClose').on('click', e => { e.preventDefault(); $('#ow-diff-popup').remove(); });
        setTimeout(() => $('#ow-diff-popup').remove(), 20000);
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  v2.3 DISCORD EXPORTER
// ═══════════════════════════════════════════════════════════════════════════════
var DiscordExporter = {
    sendNobleTrainAlert(coord, sourceId, count) {
        if (!discordWebhookUrl) return;
        const village = targetData.find(v => v.coord === coord);
        const embed = {
            title: '⚠️ POSSIBLE NOBLE TRAIN DETECTED',
            color: 0xFF0000,
            fields: [
                { name: 'Target', value: `[coord]${coord}[/coord]`, inline: true },
                { name: 'Owner', value: village?.playerName || '?', inline: true },
                { name: 'Attacks from same source', value: String(count), inline: true },
                { name: 'Stack', value: village ? numberWithCommas(Math.floor(village.totalStack)) : '?', inline: true },
                { name: 'Wall', value: village?.wall != null ? String(village.wall) : '?', inline: true },
                { name: 'WT', value: village?.watchtower != null ? String(village.watchtower) : '?', inline: true },
            ],
            timestamp: new Date().toISOString(),
            footer: { text: 'Overwatch v2.3 – TheBrain🧠' }
        };
        fetch(discordWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Overwatch', embeds: [embed] })
        }).catch(e => console.warn('Overwatch: Discord webhook error', e));
    },

    sendManualSummary() {
        if (!discordWebhookUrl) {
            showNotification('No Discord webhook URL set in settings!', 4000);
            return;
        }
        const attacked = targetData.filter(v => (parseInt(v.incomingAttacks) || 0) > 0);
        const lowStack = targetData.filter(v => (parseFloat(v.totalStack) || 0) <= (parseFloat(minimum) || 0));
        const trains = targetData.filter(v => v._nobleTrain);

        const embed = {
            title: '📊 Overwatch Summary',
            color: 0xD4AF37,
            fields: [
                { name: 'Villages monitored', value: String(targetData.length), inline: true },
                { name: 'Under attack', value: String(attacked.length), inline: true },
                { name: 'Empty stacks', value: String(lowStack.length), inline: true },
                { name: 'Noble trains detected', value: String(trains.length), inline: true },
            ],
            description: attacked.length > 0
                ? '**Villages under attack:**\n' + attacked.slice(0, 10).map(v => `• ${v.coord} (${v.playerName}) – ${v.incomingAttacks} incoming`).join('\n')
                : 'No villages currently under attack.',
            timestamp: new Date().toISOString(),
            footer: { text: 'Overwatch v2.3 – TheBrain🧠' }
        };
        fetch(discordWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Overwatch', embeds: [embed] })
        })
            .then(() => showNotification('Summary sent to Discord ✓'))
            .catch(e => { console.warn('Overwatch: Discord webhook error', e); showNotification('Discord send failed: ' + e.message, 5000); });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  v2.3 SECTOR PRIORITY SCORING
// ═══════════════════════════════════════════════════════════════════════════════
var SectorScoreManager = {
    recalculate() {
        sectorScores = {};
        const sectorSize = TWMap.map?.sectorSize || 5;
        targetData.forEach(v => {
            const t = v.coord.split('|');
            const sx = Math.floor(parseInt(t[0]) / sectorSize) * sectorSize;
            const sy = Math.floor(parseInt(t[1]) / sectorSize) * sectorSize;
            const key = `${sx}_${sy}`;
            if (!sectorScores[key]) sectorScores[key] = { sum: 0, count: 0 };
            sectorScores[key].sum += parseFloat(v.totalStack) || 0;
            sectorScores[key].count++;
        });
        Object.keys(sectorScores).forEach(k => {
            sectorScores[k].avg = sectorScores[k].count > 0
                ? Math.floor(sectorScores[k].sum / sectorScores[k].count)
                : 0;
        });
    },

    drawOnMinimap(canvas, sectorX, sectorY) {
        const sectorSize = TWMap.map?.sectorSize || 5;
        const key = `${sectorX}_${sectorY}`;
        const score = sectorScores[key];
        if (!score || score.count === 0) return;
        const ctx = canvas.getContext('2d');
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const avgK = Math.floor(score.avg / 1000);
        // Color: red = low, green = high, relative to bigStack
        const ratio = clamp(score.avg / (bigStack || 60000), 0, 1);
        const r = Math.floor(255 * (1 - ratio));
        const g = Math.floor(255 * ratio);
        ctx.save();
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(${r},${g},0,0.9)`;
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        const label = avgK + 'k\n(' + score.count + ')';
        ctx.strokeText('⌀' + avgK + 'k', cx, cy - 4);
        ctx.fillText('⌀' + avgK + 'k', cx, cy - 4);
        ctx.font = '9px monospace';
        ctx.strokeText('n=' + score.count, cx, cy + 8);
        ctx.fillText('n=' + score.count, cx, cy + 8);
        ctx.restore();
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  v2.3 PULSE ANIMATION LOOP
// ═══════════════════════════════════════════════════════════════════════════════
var PulseAnimator = {
    start() {
        if (pulseAnimFrame) return; // already running
        const loop = (ts) => {
            pulseTs = ts;
            this._repaintPulses();
            pulseAnimFrame = requestAnimationFrame(loop);
        };
        pulseAnimFrame = requestAnimationFrame(loop);
    },

    stop() {
        if (pulseAnimFrame) { cancelAnimationFrame(pulseAnimFrame); pulseAnimFrame = null; }
    },

    _repaintPulses() {
        // We overlay a blinking ring on attacked villages' canvas cells
        document.querySelectorAll('[data-ow-pulse]').forEach(el => {
            const phase = ((pulseTs % PULSE_PERIOD_MS) / PULSE_PERIOD_MS); // 0..1
            const alpha = 0.35 + 0.65 * Math.abs(Math.sin(phase * Math.PI));
            el.style.opacity = alpha;
        });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  CALCULATOR
// ═══════════════════════════════════════════════════════════════════════════════
var Calculator = {
    getStackColor(stack) {
        stack = parseFloat(stack) || 0;
        if (stack <= minimum) return 'rgba(117,255,255,0.5)';
        if (stack > minimum && stack <= smallStack) return 'rgba(0,0,0,0.5)';
        if (stack > smallStack && stack <= mediumStack) return 'rgba(255,0,0,0.5)';
        if (stack > mediumStack && stack <= bigStack) return 'rgba(255,255,0,0.5)';
        return 'rgba(0,255,0,0.5)';
    },

    packetsNeeded(totalStack) {
        return Math.max(0, Math.round((targetStackSize - totalStack) / packetSize));
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  MAP FILTER
// ═══════════════════════════════════════════════════════════════════════════════
var FilterManager = {
    FILTERS: {
        'empty': v => (parseFloat(v.totalStack) || 0) <= (parseFloat(minimum) || 0),
        'attacked': v => (parseInt(v.incomingAttacks) || 0) > 0,
        'lowwall': v => { const w = parseInt(v.wall); return !isNaN(w) && w < 20; },
        'hasWT': v => (parseInt(v.watchtower) || 0) > 0,
        'noble': v => !!v._nobleTrain,
    },

    passes(village) {
        if (!activeFilters.size) return true;
        for (const f of activeFilters) {
            if (this.FILTERS[f] && !this.FILTERS[f](village)) return false;
        }
        return true;
    },

    toggle(filter) {
        if (activeFilters.has(filter)) activeFilters.delete(filter);
        else activeFilters.add(filter);
        saveSettingsAndRedraw();
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  CSV EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
var CSVExporter = {
    export() {
        const header = ['Coordinate', 'Player', 'Tribe', 'Current Stack', 'Total Stack', 'Packets Needed',
            'Incoming Attacks', 'Wall', 'Watchtower', 'Trend', 'Noble Train'];
        const rows = targetData.map(v => [
            v.coord, v.playerName, v.tribeName,
            Math.floor(v.currentStack), Math.floor(v.totalStack),
            Calculator.packetsNeeded(v.totalStack),
            v.incomingAttacks, v.wall, v.watchtower,
            TrendManager.getTrend(v.coord),
            v._nobleTrain ? 'YES' : ''
        ]);
        const csv = [header, ...rows].map(r => r.join(',')).join('\n');
        navigator.clipboard.writeText(csv)
            .then(() => showNotification('CSV copied to clipboard – paste into Google Sheets'))
            .catch(() => {
                const ta = document.createElement('textarea');
                ta.value = csv;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                ta.remove();
                showNotification('CSV copied (fallback)');
            });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  PACKET CALCULATOR POPUP
// ═══════════════════════════════════════════════════════════════════════════════
var PacketCalculator = {
    show(coord, event) {
        $('#owPacketCalc').remove();
        const village = targetData.find(v => v.coord === coord);
        if (!village) return;

        const needed = Calculator.packetsNeeded(village.totalStack);
        const ownOpts = ownVillages.map(v =>
            `<option value="${v.coord}">${v.name} (${v.coord})</option>`
        ).join('');

        const timerText = AttackTimerManager.getCountdownText(coord);
        const nobleFlag = village._nobleTrain
            ? '<tr><td colspan="2" style="color:#ff0000;font-weight:bold;text-align:center;">⚠️ NOBLE TRAIN DETECTED</td></tr>'
            : '';

        const popup = $(`
            <div id="owPacketCalc">
                <span id="owPCClose" style="cursor:pointer;float:right;font-size:18px;line-height:1;">×</span>
                <h2>📦 Packet Calculator – [coord]${coord}[/coord]</h2>
                <table>
                    ${nobleFlag}
                    <tr><td>Player</td><td><b>${village.playerName}</b> (${village.tribeName})</td></tr>
                    <tr><td>Total stack</td><td>${numberWithCommas(Math.floor(village.totalStack))}</td></tr>
                    <tr><td>Target stack</td><td>${numberWithCommas(targetStackSize)}</td></tr>
                    <tr><td>Packets needed</td><td><b>${needed}</b> × ${numberWithCommas(packetSize)} pop</td></tr>
                    <tr><td>Incoming</td><td>${village.incomingAttacks}</td></tr>
                    ${timerText ? `<tr><td>⏱ Next impact</td><td style="color:#ff4444;font-weight:bold;">${timerText}</td></tr>` : ''}
                    <tr><td>Wall</td><td>${village.wall}</td></tr>
                    <tr><td>Watchtower</td><td>${village.watchtower}</td></tr>
                    <tr><td>Trend</td><td>${TrendManager.getTrendArrow(coord)}</td></tr>
                </table>
                ${ownOpts ? `<hr><label>Send from village:</label><select id="owSendFrom">${ownOpts}</select>` : ''}
                <div style="margin-top:8px;display:flex;gap:6px;">
                    <a href="#" class="btn btn-default" id="owAddToList">Add to stack list</a>
                    ${ownOpts ? '<a href="#" class="btn btn-default" id="owOpenSend">Open send troops</a>' : ''}
                </div>
            </div>
        `);

        popup.css({
            top: clamp(event.clientY - 20, 10, window.innerHeight - 300),
            left: clamp(event.clientX + 10, 10, window.innerWidth - 360)
        });
        $('body').append(popup);

        $('#owPCClose').on('click', () => $('#owPacketCalc').remove());
        $('#owAddToList').on('click', e => {
            e.preventDefault();
            if (!selectedVillageSet.has(coord)) {
                selectedVillageSet.add(coord);
                selectedVillages.push(coord);
                updateStackList();
            }
            $('#owPacketCalc').remove();
        });
        if (ownOpts) {
            $('#owOpenSend').on('click', e => {
                e.preventDefault();
                const from = $('#owSendFrom').val();
                if (from) {
                    const fromVil = ownVillages.find(v => v.coord === from);
                    if (fromVil) window.open(game_data.link_base_pure + `place&target=${village.coord}&from_village=${fromVil.id}`, '_blank');
                }
            });
        }
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  DATA MANAGER
// ═══════════════════════════════════════════════════════════════════════════════
var DataManager = {
    async fetchPlayerIDs() {
        const membersDef = await $.get('/game.php?screen=ally&mode=members_defense');
        options = $(membersDef).find('.input-nicer option:not(:first)');
        playerIDs = options.map((_, o) => o.value).get();
        urls = playerIDs.map(id => `/game.php?screen=ally&mode=members_defense&player_id=${id}`);
    },

    async fetchBuildingIDs() {
        const membersBuildings = await $.get('/game.php?screen=ally&mode=members_buildings');
        const buildingOptions = $(membersBuildings).find('.input-nicer option:not(:first)');
        const ids = buildingOptions.map((_, o) => o.value).get();
        buildingUrls = ids.map(id => `/game.php?screen=ally&mode=members_buildings&player_id=${id}`);
    },

    async fetchOwnVillages() {
        try {
            const page = await $.get('/game.php?screen=overview_villages&mode=combined');
            $(page).find('#combined_table tr:not(:first)').each((_, row) => {
                const coordMatch = $(row).find('td:first').text().match(/(\d+)\|(\d+)/);
                const name = $(row).find('td:nth-child(2) a').text().trim();
                const id = $(row).find('td:nth-child(2) a').attr('href')?.match(/village=(\d+)/)?.[1];
                if (coordMatch && id) ownVillages.push({ coord: coordMatch[0], name, id });
            });
        } catch (e) { /* non-critical */ }
    },

    async fetchAllData(silent = false) {
        const cached = localStorage.getItem('overwatchPlayerData');
        const cachedTs = parseInt(localStorage.getItem('overwatchPlayerDataTs') || 0);
        const ageMin = (Date.now() - cachedTs) / 60000;
        if (cached && ageMin < cacheTTL) {
            try {
                const parsed = JSON.parse(cached);
                if (parsed && parsed.length > 0) {
                    playerData = parsed;
                    if (!silent) showNotification(`Načteno z cache (stáří ${Math.floor(ageMin)}m, TTL ${cacheTTL}m)`);
                    UIManager.createOverview();
                    DataManager.setupMapInterceptors();
                    recalculate();
                    SectorScoreManager.recalculate();
                    TrendManager.snapshot();
                    NotificationManager.checkNewAttacks();
                    MapRenderer.makeMap();
                    return;
                }
            } catch (e) { /* fall through to fresh fetch */ }
        }

        const total = urls.length + buildingUrls.length;
        let done = 0;
        const tick = () => {
            done++;
            setProgress(done / total * 100);
            if (!silent) showNotification(`Načítám data… ${done}/${total}`, 1500);
        };

        if (!silent) showNotification(`Načítám data pro ${urls.length} hráčů – prosím čekej…`, 60000);

        const defenseData = await this.batchGetAll(urls, this.processDefenseData.bind(this), tick);
        const buildingData = await this.batchGetAll(buildingUrls, this.processBuildingData.bind(this), tick);

        setProgress(100);
        this.combineData(defenseData, buildingData);

        if (playerData && playerData.length > 0) {
            localStorage.setItem('overwatchPlayerData', JSON.stringify(playerData));
            localStorage.setItem('overwatchPlayerDataTs', Date.now());
            if (!silent) showNotification(`Data načtena – ${playerData.length} hráčů`, 3000);
        } else {
            showNotification('Varování: žádná data se nenačetla!', 5000);
        }

        UIManager.createOverview();
        this.setupMapInterceptors();
        recalculate();
        SectorScoreManager.recalculate();
        TrendManager.snapshot();
        NotificationManager.checkNewAttacks();
        MapRenderer.makeMap();
    },

    async batchGetAll(urlList, onLoad, onTick, batchSize = 3) {
        const results = new Array(urlList.length);

        const getWithRetry = (url, maxRetries = 5) => {
            return new Promise((resolve, reject) => {
                const attempt = (retryNum, delay) => {
                    $.get(url)
                        .done(data => resolve(data))
                        .fail(xhr => {
                            if (xhr.status === 429 && retryNum < maxRetries) {
                                const wait = delay * Math.pow(2, retryNum);
                                showNotification(`Rate limit (429) – čekám ${Math.round(wait / 1000)}s…`, wait);
                                setTimeout(() => attempt(retryNum + 1, delay), wait);
                            } else {
                                reject(xhr);
                            }
                        });
                };
                attempt(0, 3000);
            });
        };

        for (let i = 0; i < urlList.length; i += batchSize) {
            const batch = urlList.slice(i, i + batchSize);
            const batchPromises = batch.map(async (url, idx) => {
                const globalIdx = i + idx;
                try {
                    const data = await getWithRetry(url);
                    results[globalIdx] = onLoad(globalIdx, data);
                    if (onTick) onTick();
                } catch (e) {
                    console.warn(`Overwatch: request ${globalIdx} selhal:`, url);
                    results[globalIdx] = null;
                    if (onTick) onTick();
                }
            });
            await Promise.all(batchPromises);
            if (i + batchSize < urlList.length) await new Promise(r => setTimeout(r, 200));
        }

        return results;
    },

    processDefenseData(i, data) {
        const playerName = $(data).find('.input-nicer option:selected').text().trim();
        const tribeName = $(data).find('#content_value h2')[0]?.innerText?.split('(')[0]?.trim() || '';
        const hasIncomings = $(data).find('#ally_content img[src*="unit/att.webp"]').length > 0;
        const attackCount = hasIncomings
            ? $(data).find('.table-responsive table tr:first th:last')[0]?.innerText?.replace(/[^0-9]/g, '') || '0'
            : 'Tell user to share incomings';
        const playerVillages = this.parseVillages(data, hasIncomings, attackCount);

        const saved = settingsData?.playerSettings?.[i];
        const defColor = DEFAULT_COLORS[i % DEFAULT_COLORS.length];
        return {
            playerID: playerIDs[i],
            tribeName, playerName, attackCount, playerVillages,
            color: (saved?.[0]?.color) || defColor.color,
            opacity: parseFloat(saved?.[0]?.opacity) || defColor.opacity,
            checkedWT: saved?.[1]?.checkedWT || false,
            checkedWTMini: saved?.[1]?.checkedWTMini || false,
        };
    },

    parseVillages(data, hasIncomings, attackCount) {
        const villages = [];
        const table = $(data).find('.table-responsive table tr:not(:first)');
        for (let i = 0; i < Math.floor(table.length / 2); i++) {
            try {
                const row0 = table[i * 2];
                const row1 = table[i * 2 + 1];
                const coordMatch = row0?.children?.[0]?.innerText?.match(/\d+\|\d+/);
                if (!coordMatch) continue;
                const coordinate = coordMatch[0];
                const unitsInVillage = {}, unitsEnroute = {};
                let currentPop = 0, totalPop = 0;

                game_data.units.forEach((unit, j) => {
                    const inTxt = row0?.children?.[j + 3]?.innerText?.trim() || '0';
                    const outTxt = row1?.children?.[j + 1]?.innerText?.trim();
                    unitsInVillage[unit] = parseInt(inTxt) || 0;
                    if (outTxt === '?') {
                        unitsEnroute[unit] = 0;
                        if (typeof attackCount === 'string' && attackCount.length < 6)
                            attackCount = 'Not sharing required settings';
                    } else {
                        unitsEnroute[unit] = parseInt(outTxt) || 0;
                    }
                    const pop = parseFloat(unitPopValues[unit]) || 0;
                    currentPop += unitsInVillage[unit] * pop;
                    totalPop += (unitsInVillage[unit] + unitsEnroute[unit]) * pop;
                });

                const attacksToVillage = hasIncomings
                    ? row0?.children?.[3 + game_data.units.length]?.innerText?.trim() || '0'
                    : '---';

                villages.push({ coordinate, currentPop, totalPop, attacksToVillage, unitsInVillage, unitsEnroute });
            } catch (e) {
                console.warn('Overwatch: error parsing village row', i, e);
            }
        }
        return villages;
    },

    processBuildingData(j, buildingTable) {
        const villages = [];
        try {
            const hasWT = $(buildingTable).find('#ally_content img[src*="buildings/watchtower.webp"]').length > 0;
            const cellIndex = hasWT ? $(buildingTable).find('#ally_content img[src*="buildings/watchtower.webp"]').parent().index() : -1;
            const wallIndex = $(buildingTable).find('#ally_content img[src*="buildings/wall.webp"]').parent().index();
            const rows = $(buildingTable).find('#ally_content tr:nth-child(n+2)');
            rows.each((_, row) => {
                try {
                    const coordMatch = $(row).children(0).text().match(/\d+\|\d+/);
                    if (!coordMatch) return;
                    const coordinate = coordMatch[0];
                    const watchtower = hasWT ? parseInt($($(row).find('td')[cellIndex]).text().trim()) || 0 : 0;
                    const wall = parseInt($($(row).find('td')[wallIndex]).text().trim()) || 0;
                    villages.push({ coordinate, watchtower, wall });
                } catch (e) { /* skip malformed row */ }
            });
        } catch (e) { console.warn('Overwatch: error parsing buildings', e); }
        return villages;
    },

    combineData(defenseData, buildingData) {
        playerData = defenseData.map((player, i) => {
            if (!player) return null;
            const buildings = buildingData[i] || [];
            (player.playerVillages || []).forEach(village => {
                const build = buildings.find(b => b.coordinate === village.coordinate);
                village.watchtower = build ? build.watchtower : 0;
                village.wall = build ? build.wall : '---';
            });
            return player;
        }).filter(Boolean);
    },

    setupMapInterceptors() {
        if (!TWMap?.popup) return;
        const origReceived = TWMap.popup.receivedPopupInformationForSingleVillage;
        TWMap.popup.receivedPopupInformationForSingleVillage = function (e) {
            origReceived.call(TWMap.popup, e);
            if (e && Object.keys(e).length > 0) {
                MapRenderer.makeOutput(e);
                AttackTimerManager.update(e); // v2.3 – parse attack timers
            }
        };
        const origDisplay = TWMap.popup.displayForVillage;
        TWMap.popup.displayForVillage = function (e, a, t) {
            origDisplay.call(TWMap.popup, e, a, t);
            if (e && Object.keys(e).length > 0) {
                MapRenderer.makeOutput(e);
                AttackTimerManager.update(e);
            }
        };
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  UI MANAGER
// ═══════════════════════════════════════════════════════════════════════════════
var UIManager = {
    createOverview() {
        $('#overwatchNotification, #tribeLeaderUI').remove();
        $('#contentContainer').prepend(this.buildUI());
        this.setupEventListeners();
        this.setInitialValues();
        try { $('#tribeLeaderUI').draggable(); } catch (e) { }
    },

    buildUI() {
        return `
        <div id="overwatchNotification">Placeholder</div>
        <div id="tribeLeaderUI" class="ui-widget-content vis" style="min-width:300px;background:rgba(20, 0, 0, 0.85);backdrop-filter:blur(10px);color:#eaeaea;border:1px solid #d4af37;position:fixed;cursor:move;z-index:999;top:60px;right:20px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.8), inset 0 0 15px rgba(212,175,55,0.1);padding-bottom:10px;font-family:system-ui, -apple-system, sans-serif;">
            <div style="min-height:35px; padding:10px;">
                <div id="owHeaderBar" style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid rgba(212,175,55,0.2);margin:-10px -10px 10px -10px;border-radius:12px 12px 0 0;">
                    <span style="color:#d4af37;font-weight:800;font-size:14px;letter-spacing:2px;text-transform:uppercase;text-shadow:0 0 5px rgba(212,175,55,0.5);">MAP OVERVIEW</span>
                    <div style="display:flex;gap:6px;align-items:center;">
                        <span id="owAutoRefreshBadge" style="font-size:10px;color:#88c8ff;border:1px solid #336;border-radius:3px;padding:1px 6px;" data-ow-tip="Auto-refresh is active">🔄 ${autoRefreshInterval}m</span>
                        <button id="owMinimizeBtn" style="background:none;border:1px solid rgba(212,175,55,0.3);color:#d4af37;font-size:16px;cursor:pointer;padding:2px 8px;border-radius:4px;transition:all .2s;" title="Minimize" data-ow-tip="Minimize/maximize panel">–</button>
                    </div>
                </div>
                <div id="toggleUi">
                    ${this.buildFilterBar()}
                    <center>
                        <table style="margin:20px 10px; border-collapse: separate; border-spacing: 4px;">
                            <tr>
                                <td><input type="button" class="btn" style="background:linear-gradient(135deg, #aa0000 0%, #550000 100%);color:white;border:1px solid #d4af37;border-radius:4px;cursor:pointer;" id="playerSettingsButton" value="Player settings" data-ow-tip="Color, WT and per-player settings"/></td>
                                <td><input type="button" class="btn" style="background:linear-gradient(135deg, #aa0000 0%, #550000 100%);color:white;border:1px solid #d4af37;border-radius:4px;cursor:pointer;" id="stackSizeButton" value="Stack settings" data-ow-tip="Stack thresholds and unit pop values"/></td>
                                <td><input type="button" class="btn" style="background:linear-gradient(135deg, #aa0000 0%, #550000 100%);color:white;border:1px solid #d4af37;border-radius:4px;cursor:pointer;" id="stackListButton" value="Stack list" data-ow-tip="Selected villages for stacking"/></td>
                                <td><input type="button" class="btn" style="background:linear-gradient(135deg, #aa0000 0%, #550000 100%);color:white;border:1px solid #d4af37;border-radius:4px;cursor:pointer;" id="importExportButton" value="Import/Export" data-ow-tip="Import/export data, Discord webhook, cache control"/></td>
                            </tr>
                        </table>
                        ${this.buildPlayerSettingsTab()}
                        ${this.buildStackSizeTab()}
                        ${this.buildStackListTab()}
                        ${this.buildImportExportTab()}
                        <div style="margin:20px 20px 5px 20px;display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">
                            <a href="#" class="btn btn-default" id="redrawMapBtn" style="background:rgba(212,175,55,0.2);color:#d4af37;border:1px solid #d4af37;padding:5px 10px;border-radius:4px;text-decoration:none;" data-ow-tip="Re-render all map overlays">Redraw map</a>
                            <a href="#" class="btn btn-default" id="refreshDataBtn" style="background:rgba(212,175,55,0.2);color:#d4af37;border:1px solid #d4af37;padding:5px 10px;border-radius:4px;text-decoration:none;" data-ow-tip="Clear cache and force full data reload">Refresh data</a>
                            <a href="#" class="btn btn-default" id="discordSummaryBtn" style="background:rgba(88,64,164,0.3);color:#b8a0ff;border:1px solid #b8a0ff;padding:5px 10px;border-radius:4px;text-decoration:none;" data-ow-tip="Send current overview summary to Discord channel">Send to Discord</a>
                        </div>
                        <div style="text-align:right; margin-top:15px; margin-right:5px; color:#555; font-size:9px; font-weight:bold; cursor:help; letter-spacing:1px;" title="B4LD PH4NT0M">Powered by TheBrain🧠</div>
                    </center>
                </div>
            </div>
        </div>`;
    },

    buildFilterBar() {
        return `
        <div id="owFilterBar">
            <span style="font-size:12px;font-weight:bold;align-self:center" data-ow-tip="Show only villages matching ALL selected filters">Filter:</span>
            <button class="ow-filter-btn${activeFilters.has('empty') ? ' active' : ''}" data-filter="empty" data-ow-tip="Villages with stack ≤ minimum threshold">Empty</button>
            <button class="ow-filter-btn${activeFilters.has('attacked') ? ' active' : ''}" data-filter="attacked" data-ow-tip="Villages with at least 1 incoming attack">Under attack</button>
            <button class="ow-filter-btn${activeFilters.has('lowwall') ? ' active' : ''}" data-filter="lowwall" data-ow-tip="Villages with wall level below 20">Wall &lt;20</button>
            <button class="ow-filter-btn${activeFilters.has('hasWT') ? ' active' : ''}" data-filter="hasWT" data-ow-tip="Villages with watchtower present">Has WT</button>
            <button class="ow-filter-btn${activeFilters.has('noble') ? ' active' : ''}" data-filter="noble" data-ow-tip="Villages where noble train was detected this session">Noble train</button>
            <button class="ow-filter-btn" id="clearFiltersBtn" data-ow-tip="Clear all active filters">✕ Clear</button>
        </div>`;
    },

    buildPlayerSettingsTab() {
        const hasWT = 'watchtower' in (game_data.village.buildings || {});
        let html = `
        <div id="playerSettings">
            <div style="max-height:600px!important;overflow-y:auto;margin:30px;width:fit-content;">
            <table class="vis overviewWithPadding" style="border:1px solid #7d510f;min-width:600px;max-width:960px;">
                <thead><tr>
                    <th style="color:#000;" data-ow-tip="Player name">Player name</th>
                    ${hasWT ? '<th style="width:80px;text-align:center;color:#000;" data-ow-tip="Show WT radius circles on main map">Map WT</th><th style="width:80px;text-align:center;color:#000;" data-ow-tip="Show WT radius on minimap">Minimap WT</th>' : ''}
                    <th style="width:160px;text-align:center;color:#000;" data-ow-tip="Pick color and opacity for this player's WT overlay and map ring">Map color &amp; opacity</th>
                    <th style="color:#000;" data-ow-tip="Number of incoming attacks or sharing status">Incoming attacks</th>
                    <th style="color:#000;" data-ow-tip="Number of villages tracked for this player">Villages</th>
                </tr></thead>
                <tbody>`;
        playerData.forEach((player, i) => {
            const color = player.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length].color;
            const opacity = player.opacity != null ? player.opacity : DEFAULT_COLORS[i % DEFAULT_COLORS.length].opacity;
            const opacityPct = Math.round(parseFloat(opacity) * 100);
            const id = player.playerID.replace(/[\s()]/g, '');
            const rowClass = i % 2 === 0 ? 'row_b' : 'row_a';
            html += `
            <tr class="${rowClass}">
                <td style="color:#000;">${player.playerName}</td>
                ${hasWT ? `
                <td><center><input id="checkMapWT${id}" type="checkbox" ${player.checkedWT ? 'checked' : ''} title="Toggle WT circles on main map for ${player.playerName}"></center></td>
                <td><center><input id="checkWTMini${id}" type="checkbox" ${player.checkedWTMini ? 'checked' : ''} title="Toggle WT circles on minimap for ${player.playerName}"></center></td>` : ''}
                <td>
                    <div style="display:flex;align-items:center;gap:6px;padding:2px 4px;">
                        <input id="val${id}" type="color" value="${color}"
                            style="width:36px;height:28px;border:2px solid #7d510f;border-radius:4px;cursor:pointer;padding:1px;background:#fff;"
                            title="Pick map overlay color for ${player.playerName}"
                            onchange="document.getElementById('colorPreview${id}').style.background=this.value;SettingsManager.updateFromUI();SettingsManager.save();">
                        <div id="colorPreview${id}"
                            style="width:18px;height:18px;border-radius:50%;border:1px solid #555;background:${color};opacity:${opacity};flex-shrink:0;" title="Preview"></div>
                        <div style="display:flex;flex-direction:column;align-items:center;gap:1px;" title="Adjust overlay opacity">
                            <span style="color:#000;font-size:9px;font-weight:bold;" id="alpLabel${id}">${opacityPct}%</span>
                            <input id="alp${id}" type="range" min="0" max="1" step="0.05" value="${opacity}"
                                style="width:70px;height:14px;cursor:pointer;accent-color:#7d510f;"
                                oninput="document.getElementById('alpLabel${id}').innerText=Math.round(this.value*100)+'%';
                                         document.getElementById('colorPreview${id}').style.opacity=this.value;
                                         SettingsManager.updateFromUI();SettingsManager.save();">
                        </div>
                    </div>
                </td>
                <td style="color:#000;">${player.attackCount}</td>
                <td style="color:#000;">${(player.playerVillages || []).length}</td>
            </tr>`;
        });
        html += `
            ${hasWT ? `<tr style="border-top:1px solid black">
                <td style="text-align:right;color:#000;">Select all:</td>
                <td><center><input id="checkAllWT" type="checkbox" title="Toggle all Map WT checkboxes"></center></td>
                <td><center><input id="checkAllWTMini" type="checkbox" title="Toggle all Minimap WT checkboxes"></center></td>
                <td colspan="3"></td>
            </tr>` : ''}
                </tbody></table>
            </div>
        </div>`;
        return html;
    },

    buildStackSizeTab() {
        return `
        <div id="stackSize">
            <table class="vis" style="margin:30px;">
                <tr>
                    <th style="color:#000 !important;" data-ow-tip="Stacks below this value are shown in cyan (empty)">Empty</th>
                    <th colspan="2" style="width:400px;text-align:center;color:#000 !important;" data-ow-tip="Drag sliders to set Small and Medium stack boundaries">Small – Medium stack</th>
                    <th style="color:#000 !important;" data-ow-tip="Maximum stack size – sets the right boundary of the slider">Big stack</th>
                </tr>
                <tr style="height:70px">
                    <td><input type="text" id="emptyStack" name="emptyStack" style="color:#000;background:#fff;font-weight:bold;" onchange="minimum=$(this).val();updateStackSizes();"></td>
                    <td colspan="2">
                        <div class="middle">
                            <div class="multi-range-slider">
                                <input type="range" id="input-left" min="0" max="100" value="25">
                                <input type="range" id="input-right" min="0" max="100" value="75">
                                <div class="slider">
                                    <div class="track"></div>
                                    <div class="range"></div>
                                    <div class="thumb left"></div>
                                    <div class="thumb right"></div>
                                </div>
                            </div>
                        </div>
                    </td>
                    <td><input type="text" id="bigStack" name="bigStack" style="color:#000;background:#fff;font-weight:bold;" onchange="bigStack=$(this).val();updateStackSizes();"></td>
                </tr>
                <tr>
                    <td></td>
                    <td>
                        <label style="color:#000 !important;font-weight:bold;" data-ow-tip="Villages with stack in this range are shown in red">Small stack</label>
                        <input type="text" style="margin-left:20px;color:#000;background:#fff;font-weight:bold;" onchange="updateSmall(this)" id="smallStack">
                    </td>
                    <td style="text-align:right">
                        <label style="margin:0 10px 0 40px;color:#000 !important;font-weight:bold;" data-ow-tip="Villages with stack in this range are shown in yellow">Medium stack</label>
                        <input type="text" style="margin-right:20px;color:#000;background:#fff;font-weight:bold;" onchange="updateMedium(this)" id="mediumStack">
                    </td>
                    <td></td>
                </tr>
            </table>
            <table class="vis overviewWithPadding" style="border:1px solid #7d510f;margin:20px;">
                <thead><tr>
                    <th style="text-align:center" width="35"><img src="https://dsus.innogamescdn.com/asset/a9e85669/graphic/unit/unit_spear.png" title="Spear"></th>
                    <th style="text-align:center" width="35"><img src="https://dsus.innogamescdn.com/asset/a9e85669/graphic/unit/unit_sword.png" title="Sword"></th>
                    <th style="text-align:center" width="35"><img src="https://dsus.innogamescdn.com/asset/a9e85669/graphic/unit/unit_axe.png" title="Axe"></th>
                    <th style="text-align:center" width="35"><img src="https://dsus.innogamescdn.com/asset/a9e85669/graphic/unit/unit_archer.png" title="Archer"></th>
                    <th style="text-align:center" width="35"><img src="https://dsus.innogamescdn.com/asset/a9e85669/graphic/unit/unit_spy.png" title="Scout"></th>
                    <th style="text-align:center" width="35"><img src="https://dsus.innogamescdn.com/asset/a9e85669/graphic/unit/unit_light.png" title="Light cav"></th>
                    <th style="text-align:center" width="35"><img src="https://dsus.innogamescdn.com/asset/a9e85669/graphic/unit/unit_marcher.png" title="Mounted Archer"></th>
                    <th style="text-align:center" width="35"><img src="https://dsus.innogamescdn.com/asset/a9e85669/graphic/unit/unit_heavy.png" title="Heavy cav"></th>
                    <th style="text-align:center" width="35"><img src="https://dsus.innogamescdn.com/asset/a9e85669/graphic/unit/unit_ram.png" title="Ram"></th>
                    <th style="text-align:center" width="35"><img src="https://dsus.innogamescdn.com/asset/a9e85669/graphic/unit/unit_catapult.png" title="Catapult"></th>
                    <th style="text-align:center" width="35"><img src="https://dsus.innogamescdn.com/asset/a9e85669/graphic/unit/unit_knight.png" title="Knight"></th>
                    <th style="text-align:center" width="35"><img src="https://dsus.innogamescdn.com/asset/a9e85669/graphic/unit/unit_snob.png" title="Noble"></th>
                    <th style="text-align:center" width="35"><img src="https://dsus.innogamescdn.com/asset/a9e85669/graphic/unit/unit_militia.png" title="Militia"></th>
                </tr></thead>
                <tbody><tr>
                    ${['spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'ram', 'catapult', 'knight', 'snob', 'militia'].map(u =>
            `<td align="center"><input type="text" onchange="SettingsManager.save();" name="${u}" id="${u}" size="2" value="${unitPopValues[u] || 0}" style="color:#000;background:#fff;font-weight:bold;text-align:center;" title="Population value for ${u}"></td>`
        ).join('')}
                </tr></tbody>
            </table>
            <table class="vis overviewWithPadding" style="border:1px solid #7d510f;margin:20px;">
                <tr>
                    <td><label style="color:#000 !important;font-weight:bold;" data-ow-tip="Size of one support packet in population points">Packet size (pop)</label></td>
                    <td><input type="text" id="packetSize" value="${packetSize}" style="color:#000;background:#fff;font-weight:bold;" onchange="packetSize=$(this).val();SettingsManager.save();"></td>
                </tr>
                <tr>
                    <td><label style="color:#000 !important;font-weight:bold;" data-ow-tip="Cached data older than this will be re-fetched from server">Cache TTL (minutes)</label></td>
                    <td><input type="text" id="cacheTTL" value="${cacheTTL}" style="color:#000;background:#fff;font-weight:bold;" onchange="cacheTTL=$(this).val();SettingsManager.save();"></td>
                </tr>
                <tr>
                    <td><label style="color:#000 !important;font-weight:bold;" data-ow-tip="Automatically refresh data in the background every N minutes (0 = disabled)">Auto-refresh interval (min)</label></td>
                    <td><input type="text" id="autoRefreshInterval" value="${autoRefreshInterval}" style="color:#000;background:#fff;font-weight:bold;" onchange="autoRefreshInterval=$(this).val();AutoRefreshManager.restart();SettingsManager.save();"></td>
                </tr>
            </table>
        </div>`;
    },

    buildStackListTab() {
        return `
        <div id="stackList">
            <div style="width:600px;margin:30px;">
                <h1>Selected villages: <span id="countSelectedVillages">0</span></h1>
                <hr>
                <p><textarea rows="10" style="width:590px;max-height:155px;overflow-y:auto;" id="villageList"></textarea></p>
                <hr>
                <p><textarea rows="10" style="width:590px;max-height:155px;overflow-y:auto;" id="villageListBB"></textarea></p>
                <a href="#" class="btn btn-default" id="clearSelectionBtn" style="margin-top:8px;" data-ow-tip="Remove all villages from the stack list">Clear selection</a>
            </div>
        </div>`;
    },

    buildImportExportTab() {
        return `
        <div id="importExport">
            <div style="width:600px;margin:30px;">
                <h1>Export data</h1>
                <hr>
                <p>
                    <a href="#" class="btn btn-default" id="exportBtn" data-ow-tip="Copy all player data as JSON to clipboard">Export players (JSON)</a>
                    <a href="#" class="btn btn-default" id="exportCsvBtn" style="margin-left:6px;" data-ow-tip="Copy spreadsheet-ready CSV to clipboard">Export CSV (Google Sheets)</a>
                </p>
                <hr>
                <h1>Import data</h1>
                <p><textarea rows="3" style="width:590px;max-height:155px;overflow-y:auto;" id="importData" placeholder="Paste exported JSON here…"></textarea></p>
                <p><a href="#" class="btn btn-default" id="importBtn" data-ow-tip="Merge pasted JSON player data into current session">Import players</a></p>
                <hr>
                <h1>Discord Webhook</h1>
                <p>
                    <input type="text" id="discordWebhookUrl" placeholder="https://discord.com/api/webhooks/…"
                        value="${discordWebhookUrl}"
                        style="width:560px;color:#000;background:#fff;font-size:12px;padding:4px;"
                        title="Paste your Discord channel webhook URL here. Noble train alerts and manual summaries will be sent here."
                        onchange="discordWebhookUrl=$(this).val();SettingsManager.save();">
                </p>
                <p style="font-size:11px;color:#888;">Noble train alerts are sent automatically. Use the <b>Send to Discord</b> button on the main panel to send a manual summary.</p>
                <hr>
                <h1>Clear cache</h1>
                <p><a href="#" class="btn btn-default" id="clearCacheBtn" data-ow-tip="Force next load to re-fetch all player data from server">Clear cached data (force re-fetch)</a></p>
            </div>
        </div>`;
    },

    setupEventListeners() {
        $('#checkAllWT').click(function () {
            $('input:checkbox[id^="checkMapWT"]').not(this).prop('checked', this.checked);
        });
        $('#checkAllWTMini').click(function () {
            $('input:checkbox[id^="checkWTMini"]').not(this).prop('checked', this.checked);
        });

        $(document).on('click', '.ow-filter-btn[data-filter]', function () {
            FilterManager.toggle($(this).data('filter'));
        });
        $(document).on('click', '#clearFiltersBtn', () => {
            activeFilters.clear();
            saveSettingsAndRedraw();
        });

        this._setupSliders();

        $('#owMinimizeBtn').click(() => UIManager.toggleUI());

        ['playerSettings', 'stackSize', 'stackList', 'importExport'].forEach(cat => {
            $(`#${cat}Button`).click(() => UIManager.displayCategory(cat));
        });

        $('#redrawMapBtn').click(e => { e.preventDefault(); saveSettingsAndRedraw(); });
        $('#refreshDataBtn').click(e => {
            e.preventDefault();
            localStorage.removeItem('overwatchPlayerData');
            localStorage.removeItem('overwatchPlayerDataTs');
            showNotification('Cache cleared – reloading page…');
            setTimeout(() => location.reload(), 800);
        });
        $('#discordSummaryBtn').click(e => { e.preventDefault(); DiscordExporter.sendManualSummary(); });

        $(document).on('click', '#exportBtn', e => { e.preventDefault(); exportData(); });
        $(document).on('click', '#exportCsvBtn', e => { e.preventDefault(); CSVExporter.export(); });
        $(document).on('click', '#importBtn', e => { e.preventDefault(); importData(); });
        $(document).on('click', '#clearCacheBtn', e => {
            e.preventDefault();
            localStorage.removeItem('overwatchPlayerData');
            localStorage.removeItem('overwatchPlayerDataTs');
            showNotification('Cache cleared');
        });
        $(document).on('click', '#clearSelectionBtn', e => {
            e.preventDefault();
            selectedVillages = [];
            selectedVillageSet.clear();
            updateStackList();
            MapRenderer.makeMap();
        });

        $(document).on('click', function (e) {
            if (!$(e.target).closest('#owPacketCalc, canvas').length) $('#owPacketCalc').remove();
        });
    },

    _setupSliders() {
        const inputLeft = document.getElementById('input-left');
        const inputRight = document.getElementById('input-right');
        if (!inputLeft || !inputRight) return;
        const thumbLeft = document.querySelector('.slider > .thumb.left');
        const thumbRight = document.querySelector('.slider > .thumb.right');
        const range = document.querySelector('.slider > .range');

        const setLeft = () => {
            inputLeft.value = Math.min(parseInt(inputLeft.value), parseInt(inputRight.value) - 1);
            const pct = ((inputLeft.value - inputLeft.min) / (inputLeft.max - inputLeft.min)) * 100;
            thumbLeft.style.left = pct + '%';
            range.style.left = pct + '%';
            smallStack = Math.round(bigStack * pct / 100);
            $('#smallStack').val(smallStack);
            _updateTrack();
        };
        const setRight = () => {
            inputRight.value = Math.max(parseInt(inputRight.value), parseInt(inputLeft.value) + 1);
            const pct = ((inputRight.value - inputRight.min) / (inputRight.max - inputRight.min)) * 100;
            thumbRight.style.right = (100 - pct) + '%';
            range.style.right = (100 - pct) + '%';
            mediumStack = Math.round(bigStack * pct / 100);
            $('#mediumStack').val(mediumStack);
            _updateTrack();
        };
        const _updateTrack = () => {
            const lv = parseInt(inputLeft.value), rv = parseInt(inputRight.value);
            const minPct = (minimum / bigStack) * 100;
            $('.track').css('background-image',
                `linear-gradient(to right,#75FFFF,black ${minPct}%,black ${lv - 10}%,red ${lv}%,red ${rv}%,yellow ${rv + 10}%,yellow 95%,green)`);
        };

        setLeft(); setRight();
        inputLeft.addEventListener('input', setLeft);
        inputRight.addEventListener('input', setRight);
        ['mouseover', 'mouseout', 'mousedown', 'mouseup'].forEach(ev => {
            inputLeft.addEventListener(ev, () => {
                if (ev === 'mouseover') thumbLeft.classList.add('hover');
                if (ev === 'mouseout') thumbLeft.classList.remove('hover');
                if (ev === 'mousedown') thumbLeft.classList.add('active');
                if (ev === 'mouseup') { thumbLeft.classList.remove('active'); SettingsManager.save(); }
            });
            inputRight.addEventListener(ev, () => {
                if (ev === 'mouseover') thumbRight.classList.add('hover');
                if (ev === 'mouseout') thumbRight.classList.remove('hover');
                if (ev === 'mousedown') thumbRight.classList.add('active');
                if (ev === 'mouseup') { thumbRight.classList.remove('active'); SettingsManager.save(); }
            });
        });
        $('.multi-range-slider, .slider, input[type=range]').on('mousedown touchstart', e => e.stopPropagation());
    },

    setInitialValues() {
        $('#emptyStack').val(minimum);
        $('#smallStack').val(smallStack);
        $('#mediumStack').val(mediumStack);
        $('#bigStack').val(bigStack);
        $('#input-left').val(Math.floor(smallStack / bigStack * 100));
        $('#input-right').val(Math.floor(mediumStack / bigStack * 100));
        this.displayCategory('playerSettings');
    },

    displayCategory(cat) {
        const all = ['stackList', 'stackSize', 'playerSettings', 'importExport'];
        $(`#${cat}`).show();
        $(`#${cat}Button`).attr('class', 'btn evt-cancel-btn btn-confirm-yes');
        all.filter(c => c !== cat).forEach(c => {
            $(`#${c}`).hide();
            $(`#${c}Button`).attr('class', 'btn evt-confirm-btn btn-confirm-no');
        });
    },

    toggleUI() {
        const btn = document.getElementById('owMinimizeBtn');
        const content = document.getElementById('toggleUi');
        if (!content) return;
        const isVisible = content.style.display !== 'none';
        content.style.display = isVisible ? 'none' : '';
        if (btn) {
            btn.textContent = isVisible ? '+' : '\u2013';
            btn.title = isVisible ? 'Maximize' : 'Minimize';
        }
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  MAP RENDERER
// ═══════════════════════════════════════════════════════════════════════════════
var MapRenderer = {
    makeMap() {
        if (!mapOverlay?.mapHandler) return;

        if (!TWMap.mapHandler._ow_spawnOrig) {
            TWMap.mapHandler._ow_spawnOrig = TWMap.mapHandler.spawnSector;
        }
        if (!TWMap.mapHandler._ow_reloadOrig) {
            TWMap.mapHandler._ow_reloadOrig = TWMap.mapHandler.onReload;
        }

        const self = this;

        const installHook = () => {
            self._currentFilteredData = targetData.filter(element => FilterManager.passes(element)).map(el => {
                const t = el.coord.split('|');
                el.tx = parseInt(t[0], 10);
                el.ty = parseInt(t[1], 10);
                const wtLevel = parseInt(el.watchtower) || 0;
                if (wtLevel > 0 && el.checkedWT) {
                    el.wtr = Math.ceil(WATCHTOWER_RADIUS[wtLevel - 1]);
                } else {
                    el.wtr = 0;
                }
                return el;
            });

            TWMap.mapHandler.spawnSector = function (data, sector) {
                TWMap.mapHandler._ow_spawnOrig.call(TWMap.mapHandler, data, sector);
                const root = sector._element_root;
                if (root) {
                    root.querySelectorAll('[data-ow]').forEach(el => el.remove());
                }
                document.querySelectorAll('[data-ow-mini]').forEach(el => el.remove());
                try {
                    self.renderSector(data, sector);
                } catch (e) {
                    console.error('Overwatch renderSector error:', e);
                }
            };
        };

        TWMap.mapHandler.onReload = function () {
            installHook();
            TWMap.mapHandler._ow_reloadOrig.call(TWMap.mapHandler);
        };

        document.querySelectorAll('[data-ow], [data-ow-mini]').forEach(el => el.remove());
        installHook();
        TWMap.mapHandler.onReload();

        // Start pulse animation loop
        PulseAnimator.start();
    },

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
        canvas.width = tileW * sectorSize;
        canvas.height = tileH * sectorSize;
        canvas.setAttribute('data-ow', `${sectorX}_${sectorY}`);
        canvas.style.cssText = 'position:absolute;left:0;top:0;z-index:10;pointer-events:none;';
        const ctx = canvas.getContext('2d');

        // Pulse canvas for attacked villages (separate layer so we can animate opacity)
        const pulseCanvas = document.createElement('canvas');
        pulseCanvas.width = tileW * sectorSize;
        pulseCanvas.height = tileH * sectorSize;
        pulseCanvas.setAttribute('data-ow', `${sectorX}_${sectorY}_pulse`);
        pulseCanvas.setAttribute('data-ow-pulse', '1');
        pulseCanvas.style.cssText = 'position:absolute;left:0;top:0;z-index:11;pointer-events:none;';
        const pulseCtx = pulseCanvas.getContext('2d');
        let pulseUsed = false;

        let canvasUsed = false;

        (this._currentFilteredData || []).forEach(element => {
            const tx = element.tx;
            const ty = element.ty;

            const inSector = (tx >= sectorX && tx < sectorX + sectorSize && ty >= sectorY && ty < sectorY + sectorSize);

            let wtOverlaps = false;
            if (element.wtr > 0) {
                if (tx >= sectorX - element.wtr && tx < sectorX + sectorSize + element.wtr &&
                    ty >= sectorY - element.wtr && ty < sectorY + sectorSize + element.wtr) {
                    wtOverlaps = true;
                }
            }

            if (!inSector && !wtOverlaps) return;

            canvasUsed = true;

            const vp = TWMap.map.pixelByCoord(tx, ty);
            const ox = (vp[0] - sp[0]) + tileW / 2;
            const oy = (vp[1] - sp[1]) + tileH / 2;

            if (wtOverlaps) {
                this.drawMapTowers(canvas, ox, oy, parseInt(element.watchtower) || 0, element.color, parseFloat(element.opacity));
            }

            if (inSector) {
                const curColor = Calculator.getStackColor(element.currentStack);
                const totColor = Calculator.getStackColor(element.totalStack);

                this.drawLeftTriangle(canvas, ox, oy, curColor);
                this.drawRightTriangle(canvas, ox, oy, totColor);

                // v2.3 – Player-colored ring
                this.drawPlayerRing(canvas, ox, oy, element.color, parseFloat(element.opacity) || 0.3);

                // v2.3 – Noble train highlight (thick red border)
                if (element._nobleTrain) {
                    this.drawNobleBorder(canvas, ox, oy);
                }

                const hasAttacks = parseInt(element.incomingAttacks) > 0;

                // v2.3 – Pulse ring for attacked villages
                if (hasAttacks) {
                    pulseUsed = true;
                    this.drawPulseRing(pulseCanvas, ox, oy);
                }

                if (hasAttacks) this.iconOnMap(images[0], canvas, ox - 24, oy - 14, 22);
                if (element.wall !== '---' && parseInt(element.wall) < 20) this.iconOnMap(images[1], canvas, ox + 7, oy - 12, 15);
                this.iconOnMap(images[2], canvas, ox - 19, oy + 10, 15);

                if (hasAttacks) this.textOnMap(element.incomingAttacks, ctx, ox - 4, oy - 6, '#ff4444', 'bold 15px Arial', true);
                if (element.wall !== '---' && parseInt(element.wall) < 20) this.textOnMap(element.wall, ctx, ox + 20, oy - 8, 'white', '10px Arial');
                this.textOnMap(Math.floor(element.totalStack / 1000) + 'k', ctx, ox - 2, oy + 14, 'white', '10px Arial');

                // v2.3 – Attack timer countdown
                const timerTxt = AttackTimerManager.getCountdownText(element.coord);
                if (timerTxt) {
                    this.textOnMap(timerTxt, ctx, ox, oy - 20, '#ffbb00', 'bold 9px monospace', true);
                }

                const delta = TrendManager.getTrend(element.coord);
                if (delta !== 0) {
                    const arrow = delta > 0 ? '↑' : '↓';
                    const col = delta > 0 ? '#00ff44' : '#ff3300';
                    this.textOnMap(arrow, ctx, ox + 14, oy + 14, col, 'bold 11px Arial');
                }

                if (selectedVillageSet.has(element.coord)) {
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(ox - tileW / 2, oy - tileH / 2, tileW, tileH);
                }
            }
        });

        if (canvasUsed) sector.appendElement(canvas, 0, 0);
        if (pulseUsed) sector.appendElement(pulseCanvas, 0, 0);

        this._renderMinimap(sectorX, sectorY);
    },

    // v2.3 – thin player-colored ring
    drawPlayerRing(canvas, x, y, color, opacity) {
        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.strokeStyle = color;
        ctx.globalAlpha = Math.min(1, opacity * 2.5);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, Math.min(tileWidthX, tileWidthY) / 2 - 1, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.restore();
    },

    // v2.3 – noble train thick red border
    drawNobleBorder(canvas, x, y) {
        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 8;
        ctx.strokeRect(
            x - tileWidthX / 2 - 2,
            y - tileWidthY / 2 - 2,
            tileWidthX + 4,
            tileWidthY + 4
        );
        ctx.restore();
    },

    // v2.3 – pulse ring (opacity animated by PulseAnimator)
    drawPulseRing(canvas, x, y) {
        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.strokeStyle = '#ff4400';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(x, y, Math.min(tileWidthX, tileWidthY) / 2 + 3, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.restore();
    },

    _renderMinimap(sectorX, sectorY) {
        if (!mapOverlay.minimap?._loadedSectors) return;
        document.querySelectorAll('[data-ow-mini]').forEach(el => el.remove());
        for (const key in mapOverlay.minimap._loadedSectors) {
            const msec = mapOverlay.minimap._loadedSectors[key];
            const mc = document.createElement('canvas');
            mc.width = 250;
            mc.height = 250;
            mc.setAttribute('data-ow-mini', key);
            mc.style.cssText = 'position:absolute;z-index:11;';
            let miniUsed = false;
            (this._currentFilteredData || []).forEach(element => {
                const x = (element.tx - msec.x) * 5 + 3;
                const y = (element.ty - msec.y) * 5 + 3;
                if (element.wtr > 0 && element.checkedWTMini) {
                    this.drawTopoTowers(mc, x, y, parseInt(element.watchtower) || 0, element.color, parseFloat(element.opacity));
                    miniUsed = true;
                }
            });
            this._drawHeatmap(mc, msec);
            // v2.3 – sector score overlay
            SectorScoreManager.drawOnMinimap(mc, msec.x, msec.y);
            if (miniUsed) msec.appendElement(mc, 0, 0);
        }
    },

    _drawHeatmap(canvas, sector) {
        const ctx = canvas.getContext('2d');
        const grid = new Float32Array(250 * 250);
        targetData.forEach(el => {
            if (!parseInt(el.watchtower)) return;
            const t = el.coord.split('|');
            const cx = (coordInt(t[0]) - sector.x) * 5 + 3;
            const cy = (coordInt(t[1]) - sector.y) * 5 + 3;
            const r = Math.round(WATCHTOWER_RADIUS[el.watchtower - 1] * 5);
            for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
                if (dx * dx + dy * dy > r * r) continue;
                const px = cx + dx, py = cy + dy;
                if (px < 0 || px >= 250 || py < 0 || py >= 250) continue;
                grid[py * 250 + px]++;
            }
        });
        const imageData = ctx.getImageData(0, 0, 250, 250);
        for (let i = 0; i < grid.length; i++) {
            if (grid[i] >= 2) {
                imageData.data[i * 4] = 255;
                imageData.data[i * 4 + 1] = 255;
                imageData.data[i * 4 + 2] = 0;
                imageData.data[i * 4 + 3] = Math.min(80, grid[i] * 20);
            }
        }
        ctx.putImageData(imageData, 0, 0);
    },

    drawMapTowers(canvas, x, y, wtLevel, color, opacity) {
        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.lineWidth = 2;
        ctx.fillStyle = color;
        ctx.globalAlpha = parseFloat(opacity) || 0.3;
        const wtr = WATCHTOWER_RADIUS[wtLevel - 1];
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.ellipse(x, y, wtr * tileWidthX, wtr * tileWidthY, 0, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x - 6, y + 6); ctx.stroke();
        ctx.restore();
    },

    drawTopoTowers(canvas, x, y, wtLevel, color, opacity) {
        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.lineWidth = 1;
        ctx.fillStyle = color;
        ctx.globalAlpha = parseFloat(opacity) || 0.3;
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.arc(x, y, WATCHTOWER_RADIUS[wtLevel - 1] * 5, 0, 2 * Math.PI);
        ctx.stroke(); ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.beginPath(); ctx.moveTo(x - 2, y - 2); ctx.lineTo(x + 2, y + 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 2, y - 2); ctx.lineTo(x - 2, y + 2); ctx.stroke();
        ctx.restore();
    },

    drawLeftTriangle(canvas, x, y, color) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x - tileWidthX / 2, y - tileWidthY / 2);
        ctx.lineTo(x + tileWidthX / 2, y - tileWidthY / 2);
        ctx.lineTo(x - tileWidthX / 2, y + tileWidthY / 2);
        ctx.fill();
    },

    drawRightTriangle(canvas, x, y, color) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x + tileWidthX / 2, y - tileWidthY / 2);
        ctx.lineTo(x + tileWidthX / 2, y + tileWidthY / 2);
        ctx.lineTo(x - tileWidthX / 2, y + tileWidthY / 2);
        ctx.fill();
    },

    iconOnMap(img, canvas, x, y, size) {
        canvas.getContext('2d').drawImage(img, x - size / 2, y - size / 2, size, size);
    },

    textOnMap(text, ctx, x, y, color, font, strongShadow = false) {
        ctx.save();
        ctx.font = font;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = strongShadow ? 5 : 4;
        ctx.lineJoin = 'round';
        ctx.miterLimit = 1;
        if (strongShadow) {
            ctx.shadowColor = 'rgba(0,0,0,0.9)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
        }
        ctx.strokeText(text, x, y);
        ctx.fillText(text, x, y);
        ctx.restore();
    },

    makeOutput(data) {
        $('#overwatch_info').remove();
        if (!data?.xy) return;
        const xy = data.xy.toString();
        const coord = xy.substring(0, 3) + '|' + xy.substring(3, 6);
        const el = targetData.find(v => v.coord === coord);
        if (el) {
            const archersEnabled = game_data.units.includes('archer');
            const paladinEnabled = game_data.units.includes('knight');
            const trend = TrendManager.getTrendArrow(coord);
            const timerTxt = AttackTimerManager.getCountdownText(coord);
            const nobleAlert = el._nobleTrain
                ? `<tr><td colspan="100" style="background:#5c0000;color:#fff;font-weight:bold;text-align:center;padding:3px;">⚠️ NOBLE TRAIN DETECTED</td></tr>`
                : '';
            $('#map_popup').append(`
                <div id="overwatch_info" style="background-color:#e5d7b2;">
                    <h1>Overwatch <span style="font-size:14px">${trend}</span>
                        ${timerTxt ? `<span style="font-size:11px;color:#cc0000;margin-left:6px;">⏱ ${timerTxt}</span>` : ''}
                    </h1>
                    <table class="vis" style="width:100%">
                        ${nobleAlert}
                        <tr style="background-color:#c1a264!important">
                            <th>Overwatch</th>
                            <th><img src="/graphic/unit/unit_spear.webp"></th>
                            <th><img src="/graphic/unit/unit_sword.webp"></th>
                            <th><img src="/graphic/unit/unit_axe.webp"></th>
                            ${archersEnabled ? '<th><img src="/graphic/unit/unit_archer.webp"></th>' : ''}
                            <th><img src="/graphic/unit/unit_spy.webp"></th>
                            <th><img src="/graphic/unit/unit_light.webp"></th>
                            ${archersEnabled ? '<th><img src="/graphic/unit/unit_marcher.webp"></th>' : ''}
                            <th><img src="/graphic/unit/unit_heavy.webp"></th>
                            <th><img src="/graphic/unit/unit_ram.webp"></th>
                            <th><img src="/graphic/unit/unit_catapult.webp"></th>
                            ${paladinEnabled ? '<th><img src="/graphic/unit/unit_knight.webp"></th>' : ''}
                            <th><img src="/graphic/unit/unit_snob.webp"></th>
                        </tr>
                        ${Object.keys(el.unitsInVillage || {}).length > 0 ? `<tr><td>At home</td>${this.makeTroopTds(el.unitsInVillage)}</tr>` : ''}
                        ${Object.keys(el.unitsEnRoute || {}).length > 0 ? `<tr><td>En route</td>${this.makeTroopTds(el.unitsEnRoute)}</tr>` : ''}
                    </table>
                    <div style="margin-top:6px;font-size:11px;color:#555">
                        Stack: ${numberWithCommas(Math.floor(el.totalStack))} |
                        Wall: ${el.wall} |
                        WT: ${el.watchtower} |
                        Packets: ${Calculator.packetsNeeded(el.totalStack)}
                    </div>
                </div>`);
        } else {
            $('#map_popup').append(`<div id="overwatch_info" style="background-color:#e5d7b2;"><h1>No Overwatch data for this village</h1></div>`);
        }
    },

    makeTroopTds(troops) {
        const archersEnabled = game_data.units.includes('archer');
        const paladinEnabled = game_data.units.includes('knight');
        const units = ['spear', 'sword', 'axe'];
        if (archersEnabled) units.push('archer');
        units.push('spy', 'light');
        if (archersEnabled) units.push('marcher');
        units.push('heavy', 'ram', 'catapult');
        if (paladinEnabled) units.push('knight');
        units.push('snob');
        return units.map(u => `<td>${troops[u] != null ? troops[u] : ''}</td>`).join('');
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  STACK LIST HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function updateStackList() {
    let plain = '', bb = '[table]\n[**]Coordinate[||]Player[||]Tribe[||]Current stack[||]Packets needed[/**]\n';
    selectedVillages.forEach(coord => {
        const el = targetData.find(v => v.coord === coord);
        if (!el) return;
        const pkt = Calculator.packetsNeeded(el.totalStack);
        plain += `Coord: ${el.coord} - Player: ${el.playerName} - Tribe: ${el.tribeName} - Stack: ${numberWithCommas(Math.floor(el.totalStack))} - Packets: ${pkt}\n`;
        bb += `[*][coord]${el.coord}[/coord][|]${el.playerName}[|]${el.tribeName}[|]${numberWithCommas(Math.floor(el.totalStack))}[|]${pkt}\n`;
    });
    bb += '[/table]';
    const rows = Math.max(selectedVillages.length + 1, 10);
    $('#villageList').attr('rows', rows).val(plain);
    $('#villageListBB').attr('rows', rows + 3).val(bb);
    $('#countSelectedVillages').text(selectedVillages.length);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GLOBAL HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function saveSettingsAndRedraw() {
    SettingsManager.updateFromUI();
    SettingsManager.save();
    recalculate();
    SectorScoreManager.recalculate();
    $('#owFilterBar').replaceWith(UIManager.buildFilterBar());
    $(document).off('click', '.ow-filter-btn[data-filter]').on('click', '.ow-filter-btn[data-filter]', function () {
        FilterManager.toggle($(this).data('filter'));
    });
    $(document).off('click', '#clearFiltersBtn').on('click', '#clearFiltersBtn', () => {
        activeFilters.clear(); saveSettingsAndRedraw();
    });
    MapRenderer.makeMap();
}

function recalculate() {
    targetData = [];
    playerData.forEach(player => {
        (player.playerVillages || []).forEach(village => {
            targetData.push({
                playerName: player.playerName,
                tribeName: player.tribeName,
                coord: village.coordinate,
                incomingAttacks: village.attacksToVillage,
                currentStack: village.currentPop,
                totalStack: village.totalPop,
                watchtower: village.watchtower || 0,
                wall: village.wall || '---',
                checkedWT: player.checkedWT,
                checkedWTMini: player.checkedWTMini,
                color: player.color || DEFAULT_COLORS[0].color,
                opacity: parseFloat(player.opacity) || 0.3,
                unitsInVillage: village.unitsInVillage,
                unitsEnRoute: village.unitsEnroute,
                _nobleTrain: nobleTrainAlerted.has(village.coordinate),
            });
        });
    });
}

function updateStackSizes() {
    targetStackSize = bigStack;
    $('#smallStack').val(smallStack);
    $('#mediumStack').val(mediumStack);
    $('#bigStack').val(bigStack);
    $('#input-left').val(Math.floor(smallStack / bigStack * 100));
    $('#input-right').val(Math.floor(mediumStack / bigStack * 100));
    updateSlider();
    SettingsManager.save();
}

function updateSmall(el) { smallStack = el.value; $('#input-left').val(Math.floor(smallStack / bigStack * 100)); updateSlider(); SettingsManager.save(); }
function updateMedium(el) { mediumStack = el.value; $('#input-right').val(Math.floor(mediumStack / bigStack * 100)); updateSlider(); SettingsManager.save(); }

function updateSlider() {
    const range = document.querySelector('.slider > .range');
    const thumbLeft = document.querySelector('.slider > .thumb.left');
    const thumbRight = document.querySelector('.slider > .thumb.right');
    if (!range || !thumbLeft || !thumbRight) return;
    const lp = (smallStack / bigStack * 100), rp = (mediumStack / bigStack * 100);
    thumbLeft.style.left = lp + '%';
    thumbRight.style.right = (100 - rp) + '%';
    range.style.left = lp + '%';
    range.style.right = (100 - rp) + '%';
    const minPct = (minimum / bigStack) * 100;
    $('.track').css('background-image',
        `linear-gradient(to right,#75FFFF,black ${minPct}%,black ${lp - 10}%,red ${lp}%,red ${rp}%,yellow ${rp + 10}%,yellow 95%,green)`);
}

function importData() {
    try {
        const arr = JSON.parse($('#importData').val());
        if (!Array.isArray(arr)) throw new Error('Not an array');
        playerData = playerData.concat(arr);
        showNotification('Imported ' + arr.length + ' player(s)');
        UIManager.createOverview();
    } catch (e) { showNotification('Import failed: ' + e.message, 4000); }
}

function exportData() {
    const text = JSON.stringify(playerData);
    navigator.clipboard.writeText(text)
        .then(() => showNotification('Player data exported to clipboard'))
        .catch(() => showNotification('Clipboard write failed'));
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAP CLICK OVERRIDE
// ═══════════════════════════════════════════════════════════════════════════════
TWMap.map._handleClick = function (e) {
    const pos = this.coordByEvent(e);
    const coord = pos.join('|');
    const vil = TWMap.villages[pos[0] * 1000 + pos[1]];

    if (e.button === 2 || e.ctrlKey) {
        PacketCalculator.show(coord, e);
        return false;
    }

    if (!vil?.id) return false;

    if (!selectedVillageSet.has(coord)) {
        const el = targetData.find(v => v.coord === coord);
        if (!el) return false;
        selectedVillageSet.add(coord);
        selectedVillages.push(coord);
        $(`[id="map_village_${vil.id}"]`).css({ filter: 'brightness(800%) grayscale(100%)' });
    } else {
        selectedVillageSet.delete(coord);
        selectedVillages = selectedVillages.filter(v => v !== coord);
        $(`[id="map_village_${vil.id}"]`).css({ filter: 'none' });
    }

    updateStackList();
    return false;
};

$(document).on('contextmenu', 'canvas', e => e.preventDefault());

// ═══════════════════════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════════════════════
SettingsManager.load();
NotificationManager.requestPermission();
AutoRefreshManager.start();

(async () => {
    try {
        await DataManager.fetchPlayerIDs();
        await DataManager.fetchBuildingIDs();
        await DataManager.fetchOwnVillages();
        await DataManager.fetchAllData();
        SectorScoreManager.recalculate();
    } catch (e) {
        console.error('Overwatch init error:', e);
        showNotification('Overwatch: init error – ' + e.message, 6000);
    }
})();
