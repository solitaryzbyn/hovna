/**
 * Overwatch v2.0 by TheBrain (heavily revised & extended)
 *
 * FIXES:
 *  - Canvas ID collision / never-redraws bug fixed (canvas always recreated on sector spawn)
 *  - String vs number comparison in sector coordinate filter fixed (parseInt)
 *  - mapOverlay.mapSubSectorSize replaced with correct TWMap.map.sectorSize
 *  - getStackColor missing default return fixed
 *  - opacity stored as string → parseFloat applied everywhere
 *  - currentCoords string prefix-match bug → replaced with Set
 *  - Race condition in staggeredGetAll fixed
 *  - packetSize now editable in UI
 *  - textarea value="" → .val() fixed
 *  - parseVillages null-safety added
 *
 * NEW FEATURES:
 *  1. Stack trend / history  – snapshots in localStorage, ↑↓ arrows on map
 *  2. Map filter toolbar     – show only: empty / under attack / low wall / with WT
 *  3. Browser notifications  – alert on new incoming attacks vs last snapshot
 *  4. CSV export             – ready to paste into Google Sheets
 *  5. WT coverage heatmap    – overlap visualised on minimap
 *  6. Packet calculator      – click village → pop-up with send-from selector
 *  7. Cache with TTL         – localStorage data refreshed after configurable minutes
 *  8. Batch requests (5x)    – 5 parallel requests instead of serial 200 ms stagger
 */

// ─── Guard: redirect to map page if not already there ───────────────────────
if (window.location.href.indexOf('screen=map') < 0) {
    window.location.assign(game_data.link_base_pure + 'map');
}

// ─── jscolor is assumed already loaded (bundled separately or via @require) ──
// The full jscolor source is intentionally omitted here for brevity;
// include the original jscolor block before this section in production.

// ═══════════════════════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
var WATCHTOWER_RADIUS = [1.1,1.3,1.5,1.7,2,2.3,2.6,3,3.4,3.9,4.4,5.1,5.8,6.7,7.6,8.7,10,11.5,13.1,15];
var DEFAULT_COLORS = [
    {color:"#FF0000",opacity:0.3},{color:"#FF5100",opacity:0.3},{color:"#FFAE00",opacity:0.3},
    {color:"#F2FF00",opacity:0.3},{color:"#B7FF00",opacity:0.3},{color:"#62FF00",opacity:0.3},
    {color:"#04FF00",opacity:0.3},{color:"#00FF7B",opacity:0.3},{color:"#00FFAE",opacity:0.3},
    {color:"#00C8FF",opacity:0.3},{color:"#006AFF",opacity:0.3},{color:"#1500FF",opacity:0.3},
    {color:"#4000FF",opacity:0.3},{color:"#8C00FF",opacity:0.3},{color:"#FF00D9",opacity:0.3}
];
var CACHE_TTL_DEFAULT = 30; // minutes
var TREND_MAX_SNAPSHOTS = 24;

// ═══════════════════════════════════════════════════════════════════════════════
//  GLOBAL STATE
// ═══════════════════════════════════════════════════════════════════════════════
let options, playerIDs, urls = [], buildingUrls = [], playerData = [];
let mapOverlay = TWMap;
let targetData = [];
let tileWidthX = TWMap.tileSize[0];
let tileWidthY = TWMap.tileSize[1];
let selectedVillages = [];
let selectedVillageSet = new Set();   // FIX: replaces currentCoords string hack
let settingsData, unitPopValues, packetSize, minimum, smallStack, mediumStack, bigStack, targetStackSize;
let cacheTTL = CACHE_TTL_DEFAULT;
let activeFilters = new Set();        // NEW: map filter state
let stackHistory = {};                // NEW: trend data  { coord: [{ts, stack}] }
let ownVillages = [];                 // NEW: for packet calculator

// Images for map overlay
var images = Array.from({length:3}, () => new Image());
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
    /* Filter toolbar */
    #owFilterBar{display:flex;gap:6px;padding:6px 12px;background:#e8d5a3;border-bottom:1px solid #7d510f;flex-wrap:wrap;}
    .ow-filter-btn{padding:2px 10px;border:1px solid #7d510f;border-radius:3px;background:#f4e4bc;cursor:pointer;font-size:12px;user-select:none;}
    .ow-filter-btn.active{background:#7d510f;color:#fff;}
    /* Trend arrows */
    .ow-trend-up{color:#00cc00;font-weight:bold;}
    .ow-trend-down{color:#cc0000;font-weight:bold;}
    /* Packet calculator popup */
    #owPacketCalc{position:fixed;z-index:10000;background:#f4e4bc;border:2px solid #7d510f;border-radius:6px;padding:16px;min-width:340px;box-shadow:4px 4px 12px rgba(0,0,0,.4);}
    #owPacketCalc h2{margin:0 0 10px;font-size:15px;}
    #owPacketCalc select{width:100%;margin-bottom:8px;}
    #owPacketCalc table{width:100%;border-collapse:collapse;font-size:12px;}
    #owPacketCalc td{padding:2px 6px;}
    /* Progress */
    #ow-progress-wrap{position:fixed;top:0;left:0;right:0;z-index:99999;background:#7d510f;height:4px;}
    #ow-progress-bar{height:4px;background:#f4e4bc;width:0%;transition:width .2s;}
</style>`);

// ═══════════════════════════════════════════════════════════════════════════════
//  UTILITY HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function showNotification(msg, duration = 3000) {
    const x = document.getElementById('overwatchNotification');
    if (!x) return;
    x.innerText = msg;
    x.className = 'show';
    setTimeout(() => { x.className = x.className.replace('show',''); }, duration);
}

function numberWithCommas(x) {
    x = String(x);
    const pattern = /(-?\d+)(\d{3})/;
    while (pattern.test(x)) x = x.replace(pattern, '$1.$2');
    return x;
}

/** Safe parseInt wrapper for coordinate strings */
function coordInt(s) { return parseInt(s, 10); }

/** Clamp a value between min and max */
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/** Show slim progress bar at top of page */
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

// ═══════════════════════════════════════════════════════════════════════════════
//  SETTINGS MANAGER
// ═══════════════════════════════════════════════════════════════════════════════
var SettingsManager = {
    load() {
        const stored = localStorage.getItem('overwatchSettings');
        if (stored) {
            try {
                settingsData    = JSON.parse(stored);
                packetSize      = settingsData.packetSize  || 1000;
                minimum         = settingsData.minimum     || 500;
                smallStack      = settingsData.smallStack  || 20000;
                mediumStack     = settingsData.mediumStack || 40000;
                bigStack        = settingsData.bigStack    || 60000;
                unitPopValues   = settingsData.unitPopValues || this._defaultUnits();
                cacheTTL        = settingsData.cacheTTL    || CACHE_TTL_DEFAULT;
                targetStackSize = bigStack;
                // Restore per-player color/WT settings
                if (settingsData.playerSettings && playerData.length) {
                    settingsData.playerSettings.forEach((ps, i) => {
                        if (playerData[i]) {
                            playerData[i].color        = ps[0] && ps[0].color;
                            playerData[i].opacity      = ps[0] && parseFloat(ps[0].opacity);
                            playerData[i].checkedWT    = ps[1] && ps[1].checkedWT;
                            playerData[i].checkedWTMini= ps[1] && ps[1].checkedWTMini;
                        }
                    });
                }
            } catch(e) {
                console.warn('Overwatch: failed to parse settings, resetting.', e);
                this.setDefaults();
            }
        } else {
            this.setDefaults();
        }
        // Load stack history
        const hist = localStorage.getItem('overwatchStackHistory');
        if (hist) {
            try { stackHistory = JSON.parse(hist); } catch(e) { stackHistory = {}; }
        }
    },

    _defaultUnits() {
        return {spear:1,sword:1,archer:1,axe:0,spy:0,light:0,marcher:0,heavy:4,catapult:2,ram:0,knight:2,militia:1,snob:0};
    },

    setDefaults() {
        unitPopValues   = this._defaultUnits();
        packetSize      = 1000;
        minimum         = 500;
        smallStack      = 20000;
        mediumStack     = 40000;
        bigStack        = 60000;
        cacheTTL        = CACHE_TTL_DEFAULT;
        targetStackSize = bigStack;
        this.save();
    },

    save() {
        const playerSettings = playerData.map(player => [
            {color: player.color, opacity: player.opacity},
            {checkedWT: player.checkedWT, checkedWTMini: player.checkedWTMini}
        ]);
        const data = {packetSize, minimum, smallStack, mediumStack, bigStack, cacheTTL, playerSettings, unitPopValues};
        localStorage.setItem('overwatchSettings', JSON.stringify(data));
        showNotification('Settings saved');
    },

    updateFromUI() {
        Object.keys(unitPopValues).forEach(unit => {
            const el = document.getElementById(unit);
            if (el) unitPopValues[unit] = parseFloat(el.value) || 0;
        });
        packetSize = parseFloat($('#packetSize').val()) || 1000;
        cacheTTL   = parseFloat($('#cacheTTL').val())   || CACHE_TTL_DEFAULT;
        playerData.forEach(player => {
            const id = player.playerID.replace(/[\s()]/g,'');
            const valEl = document.getElementById('val' + id);
            const alpEl = document.getElementById('alp' + id);
            if (valEl) player.color   = valEl.value;
            if (alpEl) player.opacity = parseFloat(alpEl.value) || 0.3;
            player.checkedWT    = !!$('#checkMapWT'  + id).prop('checked');
            player.checkedWTMini= !!$('#checkWTMini' + id).prop('checked');
        });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  STACK TREND / HISTORY  (NEW)
// ═══════════════════════════════════════════════════════════════════════════════
var TrendManager = {
    snapshot() {
        const ts = Date.now();
        targetData.forEach(v => {
            if (!stackHistory[v.coord]) stackHistory[v.coord] = [];
            stackHistory[v.coord].push({ts, stack: v.totalStack});
            // keep only last N snapshots
            if (stackHistory[v.coord].length > TREND_MAX_SNAPSHOTS)
                stackHistory[v.coord].shift();
        });
        localStorage.setItem('overwatchStackHistory', JSON.stringify(stackHistory));
    },

    getTrend(coord) {
        const hist = stackHistory[coord];
        if (!hist || hist.length < 2) return 0;
        const last  = hist[hist.length - 1].stack;
        const prev  = hist[hist.length - 2].stack;
        return last - prev;
    },

    getTrendArrow(coord) {
        const delta = this.getTrend(coord);
        if (delta > 0)  return '<span class="ow-trend-up">↑</span>';
        if (delta < 0)  return '<span class="ow-trend-down">↓</span>';
        return '–';
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  NOTIFICATION MANAGER  (NEW)
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
            const cur  = parseInt(v.incomingAttacks) || 0;
            if (cur > prev && prev !== 0) {
                this._sendBrowserNotification(
                    `New incoming! ${v.coord}`,
                    `${v.playerName} – ${cur} attack(s) incoming. Stack: ${numberWithCommas(Math.floor(v.totalStack/1000))}k`
                );
            }
            this._prevAttacks[v.coord] = cur;
        });
    },

    _sendBrowserNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {body, icon: '/graphic//map/incoming_attack.webp'});
        } else {
            showNotification(title + ' – ' + body, 5000);
        }
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  CALCULATOR
// ═══════════════════════════════════════════════════════════════════════════════
var Calculator = {
    /** FIX: added complete coverage of all boundary cases + default */
    getStackColor(stack) {
        stack = parseFloat(stack) || 0;
        if (stack <= minimum)                              return 'rgba(117,255,255,0.5)';
        if (stack > minimum  && stack <= smallStack)       return 'rgba(0,0,0,0.5)';
        if (stack > smallStack  && stack <= mediumStack)   return 'rgba(255,0,0,0.5)';
        if (stack > mediumStack && stack <= bigStack)      return 'rgba(255,255,0,0.5)';
        return 'rgba(0,255,0,0.5)'; // > bigStack
    },

    packetsNeeded(totalStack) {
        return Math.max(0, Math.round((targetStackSize - totalStack) / packetSize));
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  MAP FILTER  (NEW)
// ═══════════════════════════════════════════════════════════════════════════════
var FilterManager = {
    FILTERS: {
        'empty'    : v => (parseFloat(v.totalStack)  || 0) <= (parseFloat(minimum) || 0),
        'attacked' : v => (parseInt(v.incomingAttacks) || 0) > 0,   // FIX: parens around ||0
        'lowwall'  : v => { const w = parseInt(v.wall); return !isNaN(w) && w < 20; },
        'hasWT'    : v => (parseInt(v.watchtower) || 0) > 0,        // FIX: parens around ||0
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
//  CSV EXPORT  (NEW)
// ═══════════════════════════════════════════════════════════════════════════════
var CSVExporter = {
    export() {
        const header = ['Coordinate','Player','Tribe','Current Stack','Total Stack','Packets Needed',
                        'Incoming Attacks','Wall','Watchtower','Trend'];
        const rows = targetData.map(v => [
            v.coord, v.playerName, v.tribeName,
            Math.floor(v.currentStack), Math.floor(v.totalStack),
            Calculator.packetsNeeded(v.totalStack),
            v.incomingAttacks, v.wall, v.watchtower,
            TrendManager.getTrend(v.coord)
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
//  PACKET CALCULATOR POPUP  (NEW)
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

        const popup = $(`
            <div id="owPacketCalc">
                <b>×</b><span id="owPCClose" style="cursor:pointer;float:right;font-size:18px;line-height:1;">×</span>
                <h2>📦 Packet Calculator – [coord]${coord}[/coord]</h2>
                <table>
                    <tr><td>Player</td><td><b>${village.playerName}</b> (${village.tribeName})</td></tr>
                    <tr><td>Total stack</td><td>${numberWithCommas(Math.floor(village.totalStack))}</td></tr>
                    <tr><td>Target stack</td><td>${numberWithCommas(targetStackSize)}</td></tr>
                    <tr><td>Packets needed</td><td><b>${needed}</b> × ${numberWithCommas(packetSize)} pop</td></tr>
                    <tr><td>Incoming</td><td>${village.incomingAttacks}</td></tr>
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

        popup.css({top: clamp(event.clientY - 20, 10, window.innerHeight - 300),
                   left: clamp(event.clientX + 10, 10, window.innerWidth - 360)});
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
        options   = $(membersDef).find('.input-nicer option:not(:first)');
        playerIDs = options.map((_, o) => o.value).get();
        urls      = playerIDs.map(id => `/game.php?screen=ally&mode=members_defense&player_id=${id}`);
    },

    async fetchBuildingIDs() {
        const membersBuildings = await $.get('/game.php?screen=ally&mode=members_buildings');
        const buildingOptions  = $(membersBuildings).find('.input-nicer option:not(:first)');
        const ids = buildingOptions.map((_, o) => o.value).get();
        buildingUrls = ids.map(id => `/game.php?screen=ally&mode=members_buildings&player_id=${id}`);
    },

    async fetchOwnVillages() {
        try {
            const page = await $.get('/game.php?screen=overview_villages&mode=combined');
            $(page).find('#combined_table tr:not(:first)').each((_, row) => {
                const coordMatch = $(row).find('td:first').text().match(/(\d+)\|(\d+)/);
                const name       = $(row).find('td:nth-child(2) a').text().trim();
                const id         = $(row).find('td:nth-child(2) a').attr('href')?.match(/village=(\d+)/)?.[1];
                if (coordMatch && id) ownVillages.push({coord: coordMatch[0], name, id});
            });
        } catch(e) { /* non-critical */ }
    },

    async fetchAllData() {
        // Check cache freshness
        const cached = localStorage.getItem('overwatchPlayerData');
        const cachedTs = parseInt(localStorage.getItem('overwatchPlayerDataTs') || 0);
        const ageMin = (Date.now() - cachedTs) / 60000;
        if (cached && ageMin < cacheTTL) {
            try {
                playerData = JSON.parse(cached);
                showNotification(`Loaded from cache (${Math.floor(ageMin)}m old, TTL ${cacheTTL}m)`);
                UIManager.createOverview();
                if (typeof jscolor !== 'undefined') jscolor.install();
                DataManager.setupMapInterceptors();
                recalculate();
                TrendManager.snapshot();
                NotificationManager.checkNewAttacks();
                MapRenderer.makeMap();
                return;
            } catch(e) { /* fall through to fresh fetch */ }
        }

        const total = urls.length + buildingUrls.length;
        let done = 0;
        const tick = () => setProgress(++done / total * 100);

        const defenseData  = await this.batchGetAll(urls,         this.processDefenseData.bind(this),  tick);
        const buildingData = await this.batchGetAll(buildingUrls, this.processBuildingData.bind(this), tick);

        setProgress(100);
        this.combineData(defenseData, buildingData);

        // Save to cache
        localStorage.setItem('overwatchPlayerData',   JSON.stringify(playerData));
        localStorage.setItem('overwatchPlayerDataTs', Date.now());

        UIManager.createOverview();
        if (typeof jscolor !== 'undefined') jscolor.install();
        this.setupMapInterceptors();
        recalculate();
        TrendManager.snapshot();
        NotificationManager.checkNewAttacks();
        MapRenderer.makeMap();
    },

    /**
     * NEW: batch requests in groups of 5 (≈5× faster than serial 200ms stagger)
     * FIX: race condition in lastRequestTime removed
     */
    batchGetAll(urlList, onLoad, onTick, batchSize = 5) {
        return new Promise((resolve, reject) => {
            const results = new Array(urlList.length);
            let nextIdx = 0;

            const worker = () => new Promise((res, rej) => {
                if (nextIdx >= urlList.length) { res(); return; }
                const i = nextIdx++;
                $.get(urlList[i])
                    .done(data => {
                        try {
                            results[i] = onLoad(i, data);
                            if (onTick) onTick();
                            res();
                        } catch(e) { rej(e); }
                    })
                    .fail(rej);
            });

            // spawn batchSize workers; each picks next available URL
            const run = async () => {
                const workers = [];
                for (let w = 0; w < Math.min(batchSize, urlList.length); w++) {
                    workers.push((async () => {
                        while (nextIdx < urlList.length) await worker();
                    })());
                }
                try {
                    await Promise.all(workers);
                    resolve(results);
                } catch(e) { reject(e); }
            };
            run();
        });
    },

    processDefenseData(i, data) {
        const playerName  = $(data).find('.input-nicer option:selected').text().trim();
        const tribeName   = $(data).find('#content_value h2')[0]?.innerText?.split('(')[0]?.trim() || '';
        const hasIncomings= $(data).find('#ally_content img[src*="unit/att.webp"]').length > 0;
        const attackCount = hasIncomings
            ? $(data).find('.table-responsive table tr:first th:last')[0]?.innerText?.replace(/[^0-9]/g,'') || '0'
            : 'Tell user to share incomings';
        const playerVillages = this.parseVillages(data, hasIncomings, attackCount);

        // Restore saved color/opacity from settings
        const saved = settingsData?.playerSettings?.[i];
        const defColor = DEFAULT_COLORS[i % DEFAULT_COLORS.length];
        return {
            playerID:       playerIDs[i],
            tribeName, playerName, attackCount, playerVillages,
            color:          (saved?.[0]?.color)              || defColor.color,
            opacity:        parseFloat(saved?.[0]?.opacity)  || defColor.opacity,
            checkedWT:      saved?.[1]?.checkedWT            || false,
            checkedWTMini:  saved?.[1]?.checkedWTMini        || false,
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
                if (!coordMatch) continue;          // FIX: null safety
                const coordinate = coordMatch[0];
                const unitsInVillage = {}, unitsEnroute = {};
                let currentPop = 0, totalPop = 0;

                game_data.units.forEach((unit, j) => {
                    const inTxt  = row0?.children?.[j + 3]?.innerText?.trim() || '0';
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
                    totalPop   += (unitsInVillage[unit] + unitsEnroute[unit]) * pop;
                });

                const attacksToVillage = hasIncomings
                    ? row0?.children?.[3 + game_data.units.length]?.innerText?.trim() || '0'
                    : '---';

                villages.push({coordinate, currentPop, totalPop, attacksToVillage, unitsInVillage, unitsEnroute});
            } catch(e) {
                console.warn('Overwatch: error parsing village row', i, e);
            }
        }
        return villages;
    },

    processBuildingData(j, buildingTable) {
        const villages = [];
        try {
            const hasWT      = $(buildingTable).find('#ally_content img[src*="buildings/watchtower.webp"]').length > 0;
            const cellIndex  = hasWT ? $(buildingTable).find('#ally_content img[src*="buildings/watchtower.webp"]').parent().index() : -1;
            const wallIndex  = $(buildingTable).find('#ally_content img[src*="buildings/wall.webp"]').parent().index();
            const rows       = $(buildingTable).find('#ally_content tr:nth-child(n+2)');
            rows.each((_, row) => {
                try {
                    const coordMatch = $(row).children(0).text().match(/\d+\|\d+/);
                    if (!coordMatch) return;
                    const coordinate  = coordMatch[0];
                    const watchtower  = hasWT ? parseInt($($(row).find('td')[cellIndex]).text().trim()) || 0 : 0;
                    const wall        = parseInt($($(row).find('td')[wallIndex]).text().trim()) || 0;
                    villages.push({coordinate, watchtower, wall});
                } catch(e) { /* skip malformed row */ }
            });
        } catch(e) { console.warn('Overwatch: error parsing buildings', e); }
        return villages;
    },

    combineData(defenseData, buildingData) {
        playerData = defenseData.map((player, i) => {
            if (!player) return null;
            const buildings = buildingData[i] || [];
            (player.playerVillages || []).forEach(village => {
                const build = buildings.find(b => b.coordinate === village.coordinate);
                village.watchtower = build ? build.watchtower : 0;
                village.wall       = build ? build.wall : '---';
            });
            return player;
        }).filter(Boolean);
    },

    setupMapInterceptors() {
        if (!TWMap?.popup) return;
        const origReceived = TWMap.popup.receivedPopupInformationForSingleVillage;
        TWMap.popup.receivedPopupInformationForSingleVillage = function(e) {
            origReceived.call(TWMap.popup, e);
            if (e && Object.keys(e).length > 0) MapRenderer.makeOutput(e);
        };
        const origDisplay = TWMap.popup.displayForVillage;
        TWMap.popup.displayForVillage = function(e, a, t) {
            origDisplay.call(TWMap.popup, e, a, t);
            if (e && Object.keys(e).length > 0) MapRenderer.makeOutput(e);
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
        try { $('#tribeLeaderUI').draggable(); } catch(e) {}
    },

    buildUI() {
        return `
        <div id="overwatchNotification">Placeholder</div>
        <div id="tribeLeaderUI" class="ui-widget-content vis" style="min-width:200px;background:#f4e4bc;position:fixed;cursor:move;z-index:999;top:60px;right:20px;">
            <div style="min-height:35px">
                <h3 id="titleOverwatch" style="display:none;margin:auto;text-align:center;padding-top:6px">Overwatch</h3>
                <img id="toggleIcon" style="position:absolute;left:20px;top:10px;" class="widget-button" src="graphic/minus.png"/>
                <div id="toggleUi">
                    ${this.buildFilterBar()}
                    <center>
                        <table style="margin:30px 20px">
                            <tr>
                                <td><input type="button" class="btn evt-confirm-btn btn-confirm-yes" id="playerSettingsButton" value="Player settings"/></td>
                                <td><input type="button" class="btn evt-confirm-btn btn-confirm-yes" id="stackSizeButton" value="Stack settings"/></td>
                                <td><input type="button" class="btn evt-confirm-btn btn-confirm-yes" id="stackListButton" value="Stack list"/></td>
                                <td><input type="button" class="btn evt-confirm-btn btn-confirm-yes" id="importExportButton" value="Import/Export"/></td>
                            </tr>
                        </table>
                        ${this.buildPlayerSettingsTab()}
                        ${this.buildStackSizeTab()}
                        ${this.buildStackListTab()}
                        ${this.buildImportExportTab()}
                        <div style="margin:20px 20px">
                            <a href="#" class="btn btn-default" id="redrawMapBtn">Redraw map</a>
                            <a href="#" class="btn btn-default" id="refreshDataBtn" style="margin-left:6px;">Refresh data</a>
                            <br><small style="margin-top:10px">Overwatch v2.0 – Script by Sass / STK</small>
                        </div>
                    </center>
                </div>
            </div>
        </div>`;
    },

    buildFilterBar() {
        return `
        <div id="owFilterBar">
            <span style="font-size:12px;font-weight:bold;align-self:center">Filter:</span>
            <button class="ow-filter-btn${activeFilters.has('empty')    ? ' active' : ''}" data-filter="empty">Empty</button>
            <button class="ow-filter-btn${activeFilters.has('attacked') ? ' active' : ''}" data-filter="attacked">Under attack</button>
            <button class="ow-filter-btn${activeFilters.has('lowwall')  ? ' active' : ''}" data-filter="lowwall">Wall &lt;20</button>
            <button class="ow-filter-btn${activeFilters.has('hasWT')    ? ' active' : ''}" data-filter="hasWT">Has WT</button>
            <button class="ow-filter-btn" id="clearFiltersBtn">✕ Clear</button>
        </div>`;
    },

    buildPlayerSettingsTab() {
        const hasWT = 'watchtower' in (game_data.village.buildings || {});
        let html = `
        <div id="playerSettings">
            <div style="max-height:600px!important;overflow-y:auto;margin:30px;width:fit-content;">
            <table class="vis overviewWithPadding" style="border:1px solid #7d510f;min-width:600px;max-width:900px;">
                <thead><tr>
                    <th>Player name</th>
                    ${hasWT ? '<th style="width:80px;text-align:center;">Map WT</th><th style="width:80px;text-align:center;">Minimap WT</th>' : ''}
                    <th style="width:80px;text-align:center;">Map color</th>
                    <th>Incoming attacks</th>
                    <th>Villages</th>
                </tr></thead>
                <tbody>`;
        playerData.forEach((player, i) => {
            const color   = player.color   || DEFAULT_COLORS[i % DEFAULT_COLORS.length].color;
            const opacity = player.opacity != null ? player.opacity : DEFAULT_COLORS[i % DEFAULT_COLORS.length].opacity;
            const id      = player.playerID.replace(/[\s()]/g,'');
            const rowClass= i % 2 === 0 ? 'row_b' : 'row_a';
            html += `
            <tr class="${rowClass}">
                <td>${player.playerName}</td>
                ${hasWT ? `
                <td><center><input id="checkMapWT${id}" type="checkbox" ${player.checkedWT ? 'checked' : ''}></center></td>
                <td><center><input id="checkWTMini${id}" type="checkbox" ${player.checkedWTMini ? 'checked' : ''}></center></td>` : ''}
                <td><center>
                    <button class="btn" id="color${id}" data-jscolor="{valueElement:'#val${id}',alphaElement:'#alp${id}'}"></button>
                    <input id="val${id}" value="${color}" type="hidden">
                    <input id="alp${id}" value="${opacity}" type="hidden">
                </center></td>
                <td>${player.attackCount}</td>
                <td>${(player.playerVillages||[]).length}</td>
            </tr>`;
        });
        html += `
            ${hasWT ? `<tr style="border-top:1px solid black">
                <td style="text-align:right">Select all:</td>
                <td><center><input id="checkAllWT" type="checkbox"></center></td>
                <td><center><input id="checkAllWTMini" type="checkbox"></center></td>
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
                <tr><th>Empty</th><th colspan="2" style="width:400px;text-align:center">Small – Medium stack</th><th>Big stack</th></tr>
                <tr style="height:70px">
                    <td><input type="text" id="emptyStack" name="emptyStack" onchange="minimum=$(this).val();updateStackSizes();"></td>
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
                    <td><input type="text" id="bigStack" name="bigStack" onchange="bigStack=$(this).val();updateStackSizes();"></td>
                </tr>
                <tr>
                    <td></td>
                    <td><label>Small stack</label><input type="text" style="margin-left:20px;" onchange="updateSmall(this)" id="smallStack"></td>
                    <td style="text-align:right"><label style="margin:0 10px 0 40px">Medium stack</label><input type="text" style="margin-right:20px;" onchange="updateMedium(this)" id="mediumStack"></td>
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
                    ${['spear','sword','axe','archer','spy','light','marcher','heavy','ram','catapult','knight','snob','militia'].map(u =>
                        `<td align="center"><input type="text" onchange="SettingsManager.save();" name="${u}" id="${u}" size="2" value="${unitPopValues[u]||0}"></td>`
                    ).join('')}
                </tr></tbody>
            </table>
            <table class="vis overviewWithPadding" style="border:1px solid #7d510f;margin:20px;">
                <tr>
                    <td><label>Packet size (pop)</label></td>
                    <td><input type="text" id="packetSize" value="${packetSize}" onchange="packetSize=$(this).val();SettingsManager.save();"></td>
                </tr>
                <tr>
                    <td><label>Cache TTL (minutes)</label></td>
                    <td><input type="text" id="cacheTTL" value="${cacheTTL}" onchange="cacheTTL=$(this).val();SettingsManager.save();" title="Data older than this will be re-fetched on next load"></td>
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
                <a href="#" class="btn btn-default" id="clearSelectionBtn" style="margin-top:8px;">Clear selection</a>
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
                    <a href="#" class="btn btn-default" id="exportBtn">Export players (JSON)</a>
                    <a href="#" class="btn btn-default" id="exportCsvBtn" style="margin-left:6px;">Export CSV (Google Sheets)</a>
                </p>
                <hr>
                <h1>Import data</h1>
                <p><textarea rows="3" style="width:590px;max-height:155px;overflow-y:auto;" id="importData"></textarea></p>
                <p><a href="#" class="btn btn-default" id="importBtn">Import players</a></p>
                <hr>
                <h1>Clear cache</h1>
                <p><a href="#" class="btn btn-default" id="clearCacheBtn">Clear cached data (force re-fetch)</a></p>
            </div>
        </div>`;
    },

    setupEventListeners() {
        // WT checkboxes
        $('#checkAllWT').click(function() {
            $('input:checkbox[id^="checkMapWT"]').not(this).prop('checked', this.checked);
        });
        $('#checkAllWTMini').click(function() {
            $('input:checkbox[id^="checkWTMini"]').not(this).prop('checked', this.checked);
        });

        // Filter buttons
        $(document).on('click', '.ow-filter-btn[data-filter]', function() {
            FilterManager.toggle($(this).data('filter'));
        });
        $(document).on('click', '#clearFiltersBtn', () => {
            activeFilters.clear();
            saveSettingsAndRedraw();
        });

        // Slider setup
        this._setupSliders();

        // UI toggle
        $('#toggleIcon').click(() => UIManager.toggleUI());

        // Tab buttons
        ['playerSettings','stackSize','stackList','importExport'].forEach(cat => {
            $(`#${cat}Button`).click(() => UIManager.displayCategory(cat));
        });

        // Redraw / Refresh
        $('#redrawMapBtn').click(e => { e.preventDefault(); saveSettingsAndRedraw(); });
        $('#refreshDataBtn').click(e => {
            e.preventDefault();
            localStorage.removeItem('overwatchPlayerData');
            localStorage.removeItem('overwatchPlayerDataTs');
            showNotification('Cache cleared – reloading page…');
            setTimeout(() => location.reload(), 800);
        });

        // Export / Import
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

        // Close packet calc on outside click
        $(document).on('click', function(e) {
            if (!$(e.target).closest('#owPacketCalc, canvas').length) $('#owPacketCalc').remove();
        });
    },

    _setupSliders() {
        const inputLeft  = document.getElementById('input-left');
        const inputRight = document.getElementById('input-right');
        if (!inputLeft || !inputRight) return;
        const thumbLeft  = document.querySelector('.slider > .thumb.left');
        const thumbRight = document.querySelector('.slider > .thumb.right');
        const range      = document.querySelector('.slider > .range');

        const setLeft = () => {
            inputLeft.value = Math.min(parseInt(inputLeft.value), parseInt(inputRight.value) - 1);
            const pct = ((inputLeft.value - inputLeft.min) / (inputLeft.max - inputLeft.min)) * 100;
            thumbLeft.style.left = pct + '%';
            range.style.left     = pct + '%';
            smallStack = Math.round(bigStack * pct / 100);
            $('#smallStack').val(smallStack);
            _updateTrack();
        };
        const setRight = () => {
            inputRight.value = Math.max(parseInt(inputRight.value), parseInt(inputLeft.value) + 1);
            const pct = ((inputRight.value - inputRight.min) / (inputRight.max - inputRight.min)) * 100;
            thumbRight.style.right = (100 - pct) + '%';
            range.style.right      = (100 - pct) + '%';
            mediumStack = Math.round(bigStack * pct / 100);
            $('#mediumStack').val(mediumStack);
            _updateTrack();
        };
        const _updateTrack = () => {
            const lv = parseInt(inputLeft.value), rv = parseInt(inputRight.value);
            const minPct = (minimum / bigStack) * 100;
            $('.track').css('background-image',
                `linear-gradient(to right,#75FFFF,black ${minPct}%,black ${lv-10}%,red ${lv}%,red ${rv}%,yellow ${rv+10}%,yellow 95%,green)`);
        };

        setLeft(); setRight();
        inputLeft.addEventListener('input', setLeft);
        inputRight.addEventListener('input', setRight);
        ['mouseover','mouseout','mousedown','mouseup'].forEach(ev => {
            inputLeft.addEventListener(ev, () => {
                if (ev==='mouseover') thumbLeft.classList.add('hover');
                if (ev==='mouseout')  thumbLeft.classList.remove('hover');
                if (ev==='mousedown') thumbLeft.classList.add('active');
                if (ev==='mouseup')   { thumbLeft.classList.remove('active'); SettingsManager.save(); }
            });
            inputRight.addEventListener(ev, () => {
                if (ev==='mouseover') thumbRight.classList.add('hover');
                if (ev==='mouseout')  thumbRight.classList.remove('hover');
                if (ev==='mousedown') thumbRight.classList.add('active');
                if (ev==='mouseup')   { thumbRight.classList.remove('active'); SettingsManager.save(); }
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
        const all = ['stackList','stackSize','playerSettings','importExport'];
        $(`#${cat}`).show();
        $(`#${cat}Button`).attr('class','btn evt-cancel-btn btn-confirm-yes');
        all.filter(c => c !== cat).forEach(c => {
            $(`#${c}`).hide();
            $(`#${c}Button`).attr('class','btn evt-confirm-btn btn-confirm-no');
        });
    },

    toggleUI() {
        const icon = $('#toggleIcon');
        icon.attr('src', icon.attr('src').includes('minus.png') ? 'graphic/plus.png' : 'graphic/minus.png');
        $('#toggleUi, #titleOverwatch').toggle();
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  MAP RENDERER
// ═══════════════════════════════════════════════════════════════════════════════
var MapRenderer = {
    makeMap() {
        if (!mapOverlay?.mapHandler) return;
        // Backup original only once
        if (!mapOverlay.mapHandler._spawnSector_orig) {
            mapOverlay.mapHandler._spawnSector_orig = mapOverlay.mapHandler.spawnSector;
        }
        mapOverlay.mapHandler.spawnSector = (data, sector) => {
            mapOverlay.mapHandler._spawnSector_orig(data, sector);
            // FIX: always remove old overlay canvases so they are re-created fresh
            $(`.mapOverlay_map_canvas[id^="mapOverlay_canvas_${sector.x}_${sector.y}"]`).remove();
            $(`.mapOverlay_topo_canvas`).remove();
            this.renderSector(data, sector);
        };
        // Remove stale canvases
        $('.mapOverlay_map_canvas, .mapOverlay_topo_canvas').remove();
        mapOverlay.reload();
    },

    renderSector(data, sector) {
        const sectorSize = mapOverlay.map?.sectorSize || 5; // FIX: use correct property

        // ── Main map canvas ──────────────────────────────────────────────────
        const canvas = document.createElement('canvas');
        canvas.style.position = 'absolute';
        canvas.width  = (mapOverlay.map?.scale?.[0] || 32) * sectorSize;
        canvas.height = (mapOverlay.map?.scale?.[1] || 32) * sectorSize;
        canvas.style.zIndex   = 10;
        canvas.className      = 'mapOverlay_map_canvas';
        canvas.id             = 'mapOverlay_canvas_' + sector.x + '_' + sector.y;
        const ctx             = canvas.getContext('2d');
        const st_pixel        = mapOverlay.map.pixelByCoord(sector.x, sector.y);

        let canvasUsed = false;

        targetData.forEach(element => {
            if (!FilterManager.passes(element)) return;
            const t  = element.coord.split('|');
            const tx = coordInt(t[0]), ty = coordInt(t[1]); // FIX: parseInt
            if (tx < sector.x || tx >= sector.x + sectorSize) return;
            if (ty < sector.y || ty >= sector.y + sectorSize) return;

            canvasUsed = true;
            const originXY = mapOverlay.map.pixelByCoord(tx, ty);
            const ox = (originXY[0] - st_pixel[0]) + tileWidthX / 2;
            const oy = (originXY[1] - st_pixel[1]) + tileWidthY / 2;

            const curColor = Calculator.getStackColor(element.currentStack);
            const totColor = Calculator.getStackColor(element.totalStack);

            this.drawLeftTriangle(canvas, ox, oy, curColor);
            this.drawRightTriangle(canvas, ox, oy, totColor);

            // Icons
            if (parseInt(element.incomingAttacks) > 0) this.iconOnMap(images[0], canvas, ox - 19, oy - 12, 15);
            if (element.wall !== '---' && parseInt(element.wall) < 20) this.iconOnMap(images[1], canvas, ox + 7, oy - 12, 15);
            this.iconOnMap(images[2], canvas, ox - 19, oy + 10, 15);

            // Text
            if (parseInt(element.incomingAttacks) > 0) this.textOnMap(element.incomingAttacks, ctx, ox - 5, oy - 8, 'white', '10px Arial');
            if (element.wall !== '---' && parseInt(element.wall) < 20) this.textOnMap(element.wall, ctx, ox + 20, oy - 8, 'white', '10px Arial');
            this.textOnMap(Math.floor(element.totalStack / 1000) + 'k', ctx, ox - 2, oy + 14, 'white', '10px Arial');

            // Trend arrow on map
            const delta = TrendManager.getTrend(element.coord);
            if (delta !== 0) {
                const arrow = delta > 0 ? '↑' : '↓';
                const col   = delta > 0 ? '#00ff44' : '#ff3300';
                this.textOnMap(arrow, ctx, ox + 14, oy + 14, col, 'bold 11px Arial');
            }

            // Watchtower circle
            if (parseInt(element.watchtower) > 0 && element.checkedWT) {
                this.drawMapTowers(canvas, ox, oy, element.watchtower, element.color, parseFloat(element.opacity));
            }

            // Highlight selected villages
            if (selectedVillageSet.has(element.coord)) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth   = 2;
                ctx.strokeRect(ox - tileWidthX/2, oy - tileWidthY/2, tileWidthX, tileWidthY);
            }
        });

        if (canvasUsed) sector.appendElement(canvas, 0, 0);

        // ── Minimap canvas ───────────────────────────────────────────────────
        if (!mapOverlay.minimap?._loadedSectors) return;
        for (const key in mapOverlay.minimap._loadedSectors) {
            const msec = mapOverlay.minimap._loadedSectors[key];
            if ($('#mapOverlay_topo_canvas_' + key).length) continue;
            const mc   = document.createElement('canvas');
            mc.style.position = 'absolute';
            mc.width  = 250; mc.height = 250;
            mc.style.zIndex   = 11;
            mc.className      = 'mapOverlay_topo_canvas';
            mc.id             = 'mapOverlay_topo_canvas_' + key;
            let miniUsed = false;
            targetData.forEach(element => {
                if (!FilterManager.passes(element)) return;
                const t  = element.coord.split('|');
                const x  = (coordInt(t[0]) - msec.x) * 5 + 3;
                const y  = (coordInt(t[1]) - msec.y) * 5 + 3;
                if (parseInt(element.watchtower) > 0 && element.checkedWTMini) {
                    this.drawTopoTowers(mc, x, y, element.watchtower, element.color, parseFloat(element.opacity));
                    miniUsed = true;
                }
            });
            // WT heatmap: mark overlapping zones slightly brighter
            this._drawHeatmap(mc, msec);
            if (miniUsed) msec.appendElement(mc, 0, 0);
        }
    },

    /** NEW: WT coverage heatmap on minimap */
    _drawHeatmap(canvas, sector) {
        const ctx = canvas.getContext('2d');
        const grid = new Float32Array(250 * 250);
        targetData.forEach(el => {
            if (!parseInt(el.watchtower)) return;
            const t = el.coord.split('|');
            const cx = (coordInt(t[0]) - sector.x) * 5 + 3;
            const cy = (coordInt(t[1]) - sector.y) * 5 + 3;
            const r  = Math.round(WATCHTOWER_RADIUS[el.watchtower - 1] * 5);
            for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
                if (dx*dx + dy*dy > r*r) continue;
                const px = cx + dx, py = cy + dy;
                if (px < 0 || px >= 250 || py < 0 || py >= 250) continue;
                grid[py * 250 + px]++;
            }
        });
        const imageData = ctx.getImageData(0, 0, 250, 250);
        for (let i = 0; i < grid.length; i++) {
            if (grid[i] >= 2) { // overlapping coverage
                imageData.data[i*4]   = 255;
                imageData.data[i*4+1] = 255;
                imageData.data[i*4+2] = 0;
                imageData.data[i*4+3] = Math.min(80, grid[i] * 20);
            }
        }
        ctx.putImageData(imageData, 0, 0);
    },

    drawMapTowers(canvas, x, y, wtLevel, color, opacity) {
        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.lineWidth   = 2;
        ctx.fillStyle   = color;
        ctx.globalAlpha = parseFloat(opacity) || 0.3; // FIX: ensure float
        const wtr = WATCHTOWER_RADIUS[wtLevel - 1];
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.ellipse(x, y, wtr * (mapOverlay.map?.scale?.[0]||32), wtr * (mapOverlay.map?.scale?.[1]||32), 0, 0, 2*Math.PI);
        ctx.stroke();
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.beginPath(); ctx.moveTo(x-6,y-6); ctx.lineTo(x+6,y+6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x+6,y-6); ctx.lineTo(x-6,y+6); ctx.stroke();
        ctx.restore();
    },

    drawTopoTowers(canvas, x, y, wtLevel, color, opacity) {
        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.lineWidth   = 1;
        ctx.fillStyle   = color;
        ctx.globalAlpha = parseFloat(opacity) || 0.3;
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.arc(x, y, WATCHTOWER_RADIUS[wtLevel-1]*5, 0, 2*Math.PI);
        ctx.stroke(); ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.beginPath(); ctx.moveTo(x-2,y-2); ctx.lineTo(x+2,y+2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x+2,y-2); ctx.lineTo(x-2,y+2); ctx.stroke();
        ctx.restore();
    },

    drawLeftTriangle(canvas, x, y, color) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x - tileWidthX/2, y - tileWidthY/2);
        ctx.lineTo(x + tileWidthX/2, y - tileWidthY/2);
        ctx.lineTo(x - tileWidthX/2, y + tileWidthY/2);
        ctx.fill();
    },

    drawRightTriangle(canvas, x, y, color) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x + tileWidthX/2, y - tileWidthY/2);
        ctx.lineTo(x + tileWidthX/2, y + tileWidthY/2);
        ctx.lineTo(x - tileWidthX/2, y + tileWidthY/2);
        ctx.fill();
    },

    iconOnMap(img, canvas, x, y, size) {
        canvas.getContext('2d').drawImage(img, x - size/2, y - size/2, size, size);
    },

    textOnMap(text, ctx, x, y, color, font) {
        ctx.save();
        ctx.font       = font;
        ctx.fillStyle  = color;
        ctx.textAlign  = 'center';
        ctx.strokeStyle= 'black';
        ctx.lineWidth  = 4;
        ctx.lineJoin   = 'round';
        ctx.miterLimit = 1;
        ctx.strokeText(text, x, y);
        ctx.fillText(text, x, y);
        ctx.restore();
    },

    makeOutput(data) {
        $('#overwatch_info').remove();
        if (!data?.xy) return;
        const xy  = data.xy.toString();
        const coord = xy.substring(0,3) + '|' + xy.substring(3,6);
        const el  = targetData.find(v => v.coord === coord);
        if (el) {
            const archersEnabled = game_data.units.includes('archer');
            const paladinEnabled = game_data.units.includes('knight');
            const trend = TrendManager.getTrendArrow(coord);
            $('#map_popup').append(`
                <div id="overwatch_info" style="background-color:#e5d7b2;">
                    <h1>Overwatch <span style="font-size:14px">${trend}</span></h1>
                    <table class="vis" style="width:100%">
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
                        ${Object.keys(el.unitsInVillage||{}).length > 0 ? `<tr><td>At home</td>${this.makeTroopTds(el.unitsInVillage)}</tr>` : ''}
                        ${Object.keys(el.unitsEnRoute||{}).length  > 0 ? `<tr><td>En route</td>${this.makeTroopTds(el.unitsEnRoute)}</tr>` : ''}
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
        const units = ['spear','sword','axe'];
        if (archersEnabled) units.push('archer');
        units.push('spy','light');
        if (archersEnabled) units.push('marcher');
        units.push('heavy','ram','catapult');
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
        bb    += `[*][coord]${el.coord}[/coord][|]${el.playerName}[|]${el.tribeName}[|]${numberWithCommas(Math.floor(el.totalStack))}[|]${pkt}\n`;
    });
    bb += '[/table]';
    const rows = Math.max(selectedVillages.length + 1, 10);
    $('#villageList').attr('rows', rows).val(plain);
    $('#villageListBB').attr('rows', rows + 3).val(bb);
    $('#countSelectedVillages').text(selectedVillages.length);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GLOBAL HELPERS (called from inline onchange / onclick)
// ═══════════════════════════════════════════════════════════════════════════════
function saveSettingsAndRedraw() {
    SettingsManager.updateFromUI();
    SettingsManager.save();
    recalculate();
    // Rebuild filter bar to reflect current state
    $('#owFilterBar').replaceWith(UIManager.buildFilterBar());
    $(document).off('click', '.ow-filter-btn[data-filter]').on('click', '.ow-filter-btn[data-filter]', function() {
        FilterManager.toggle($(this).data('filter'));
    });
    $(document).off('click','#clearFiltersBtn').on('click','#clearFiltersBtn', () => {
        activeFilters.clear(); saveSettingsAndRedraw();
    });
    MapRenderer.makeMap();
}

function recalculate() {
    targetData = [];
    playerData.forEach(player => {
        (player.playerVillages || []).forEach(village => {
            targetData.push({
                playerName:      player.playerName,
                tribeName:       player.tribeName,
                coord:           village.coordinate,
                incomingAttacks: village.attacksToVillage,
                currentStack:    village.currentPop,
                totalStack:      village.totalPop,
                watchtower:      village.watchtower || 0,
                wall:            village.wall       || '---',
                checkedWT:       player.checkedWT,
                checkedWTMini:   player.checkedWTMini,
                color:           player.color       || DEFAULT_COLORS[0].color,
                opacity:         parseFloat(player.opacity) || 0.3,
                unitsInVillage:  village.unitsInVillage,
                unitsEnRoute:    village.unitsEnroute,
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

function updateSmall(el)  { smallStack  = el.value; $('#input-left').val(Math.floor(smallStack/bigStack*100));  updateSlider(); SettingsManager.save(); }
function updateMedium(el) { mediumStack = el.value; $('#input-right').val(Math.floor(mediumStack/bigStack*100)); updateSlider(); SettingsManager.save(); }

function updateSlider() {
    const range      = document.querySelector('.slider > .range');
    const thumbLeft  = document.querySelector('.slider > .thumb.left');
    const thumbRight = document.querySelector('.slider > .thumb.right');
    if (!range || !thumbLeft || !thumbRight) return;
    const lp = (smallStack/bigStack*100), rp = (mediumStack/bigStack*100);
    thumbLeft.style.left   = lp + '%';
    thumbRight.style.right = (100 - rp) + '%';
    range.style.left  = lp + '%';
    range.style.right = (100 - rp) + '%';
    const minPct = (minimum / bigStack) * 100;
    $('.track').css('background-image',
        `linear-gradient(to right,#75FFFF,black ${minPct}%,black ${lp-10}%,red ${lp}%,red ${rp}%,yellow ${rp+10}%,yellow 95%,green)`);
}

function importData() {
    try {
        const arr = JSON.parse($('#importData').val());
        if (!Array.isArray(arr)) throw new Error('Not an array');
        playerData = playerData.concat(arr);
        showNotification('Imported ' + arr.length + ' player(s)');
        UIManager.createOverview();
        if (typeof jscolor !== 'undefined') jscolor.install();
    } catch(e) { showNotification('Import failed: ' + e.message, 4000); }
}

function exportData() {
    const text = JSON.stringify(playerData);
    navigator.clipboard.writeText(text)
        .then(()  => showNotification('Player data exported to clipboard'))
        .catch(() => showNotification('Clipboard write failed'));
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAP CLICK OVERRIDE
// ═══════════════════════════════════════════════════════════════════════════════
TWMap.map._handleClick = function(e) {
    const pos   = this.coordByEvent(e);
    const coord = pos.join('|');
    const vil   = TWMap.villages[pos[0]*1000 + pos[1]];

    // Right-click → open packet calculator
    if (e.button === 2 || e.ctrlKey) {
        PacketCalculator.show(coord, e);
        return false;
    }

    if (!vil?.id) return false;

    if (!selectedVillageSet.has(coord)) {
        // Select
        const el = targetData.find(v => v.coord === coord);
        if (!el) return false;
        selectedVillageSet.add(coord);
        selectedVillages.push(coord);
        $(`[id="map_village_${vil.id}"]`).css({filter:'brightness(800%) grayscale(100%)'});
    } else {
        // Deselect  FIX: Set-based, no prefix collision
        selectedVillageSet.delete(coord);
        selectedVillages = selectedVillages.filter(v => v !== coord);
        $(`[id="map_village_${vil.id}"]`).css({filter:'none'});
    }

    updateStackList();
    return false;
};

// Prevent context menu on map canvas (for right-click packet calc)
$(document).on('contextmenu', 'canvas', e => e.preventDefault());

// ═══════════════════════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════════════════════
SettingsManager.load();
NotificationManager.requestPermission();

(async () => {
    try {
        await DataManager.fetchPlayerIDs();
        await DataManager.fetchBuildingIDs();
        await DataManager.fetchOwnVillages();
        await DataManager.fetchAllData();
    } catch(e) {
        console.error('Overwatch init error:', e);
        showNotification('Overwatch: init error – ' + e.message, 6000);
    }
})();
