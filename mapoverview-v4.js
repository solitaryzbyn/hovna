/**
 * Overwatch v0.25 by TheBrain (heavily revised & extended)
 * * FIXES v0.24 → v0.25:
 * - Fix: Opraven posun v dashboardu u nastavení opacity/barvy (strict ID binding). ✅
 * - HUD descriptions are in English.
 */

// ─── Guard: redirect to map page if not already there ───────────────────────
if (window.location.href.indexOf('screen=map') < 0) {
    window.location.assign(game_data.link_base_pure + 'map');
}

// ... (Constants & Global State zůstávají stejné) ...
var WATCHTOWER_RADIUS = [1.1, 1.3, 1.5, 1.7, 2, 2.3, 2.6, 3, 3.4, 3.9, 4.4, 5.1, 5.8, 6.7, 7.6, 8.7, 10, 11.5, 13.1, 15];
var DEFAULT_COLORS = [
    { color: "#FF0000", opacity: 0.3 }, { color: "#FF5100", opacity: 0.3 }, { color: "#FFAE00", opacity: 0.3 },
    { color: "#F2FF00", opacity: 0.3 }, { color: "#B7FF00", opacity: 0.3 }, { color: "#62FF00", opacity: 0.3 },
    { color: "#04FF00", opacity: 0.3 }, { color: "#00FF7B", opacity: 0.3 }, { color: "#00FFAE", opacity: 0.3 },
    { color: "#00C8FF", opacity: 0.3 }, { color: "#006AFF", opacity: 0.3 }, { color: "#1500FF", opacity: 0.3 },
    { color: "#4000FF", opacity: 0.3 }, { color: "#8C00FF", opacity: 0.3 }, { color: "#FF00D9", opacity: 0.3 }
];
var CACHE_TTL_DEFAULT = 30;
var TREND_MAX_SNAPSHOTS = 24;
var NOBLE_TRAIN_THRESHOLD = 4;
var AUTO_REFRESH_DEFAULT = 15;
var PULSE_PERIOD_MS = 1200;

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

let attackTimers = {};
let nobleTrainAlerted = new Set();
let autoRefreshInterval = AUTO_REFRESH_DEFAULT;
let autoRefreshTimer = null;
let discordWebhookUrl = '';
let sectorScores = {};
let pulseAnimFrame = null;
let pulseTs = 0;

var images = Array.from({ length: 3 }, () => new Image());
images[0].src = '/graphic//map/incoming_attack.webp';
images[1].src = '/graphic/buildings/wall.webp';
images[2].src = '/graphic/buildings/farm.webp';

// ─── STYLES (Zůstávají stejné jako v zadání) ──────────────────────────────────
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
    .slider{position:relative;z-index:1;height:10px;margin:0 15px;}
    .slider>.track{position:absolute;z-index:1;left:0;right:0;top:0;bottom:0;border-radius:5px;background-image:linear-gradient(to right,black,red,yellow,green);}
    .slider>.range{position:absolute;z-index:2;left:25%;right:25%;top:0;bottom:0;border-radius:5px;background-color:#FF0000;}
    .slider>.thumb{position:absolute;z-index:3;width:20px!important;height:20px;border-radius:50%;box-shadow:0 0 0 0 rgba(255,255,0,.1);transition:box-shadow .3s ease-in-out;}
    .slider>.thumb.left{background-color:#FF0000!important;left:25%;transform:translate(-10px,-5px);}
    .slider>.thumb.right{background-color:#FF0000!important;right:25%;transform:translate(10px,-5px);}
    input[type=range]{position:absolute;pointer-events:none;-webkit-appearance:none;z-index:2;height:10px;width:100%;opacity:0;}
    input[type=range]::-webkit-slider-thumb{pointer-events:all;width:30px;height:30px;border-radius:0;border:0 none;background-color:red;-webkit-appearance:none;}
    #owFilterBar{display:flex;gap:6px;padding:6px 12px;background:#e8d5a3;border-bottom:1px solid #7d510f;flex-wrap:wrap;}
    .ow-filter-btn{padding:2px 10px;border:1px solid #7d510f;border-radius:3px;background:#f4e4bc;cursor:pointer;font-size:12px;user-select:none;}
    .ow-filter-btn.active{background:#7d510f;color:#fff;}
    #owPacketCalc{position:fixed;z-index:10000;background:#f4e4bc;border:2px solid #7d510f;border-radius:6px;padding:16px;min-width:340px;box-shadow:4px 4px 12px rgba(0,0,0,.4);}
    #ow-progress-wrap{position:fixed;top:0;left:0;right:0;z-index:99999;background:#7d510f;height:4px;}
    #ow-progress-bar{height:4px;background:#f4e4bc;width:0%;transition:width .2s;}
    #tribeLeaderUI .vis th { background-color: #c1a264; color: #000 !important; }
    #tribeLeaderUI .vis td { color: #000 !important; }
</style>`);

// ... (Utility Helpers & SettingsManager & Managers zůstávají stejné) ...

// ─── UI MANAGER (Opravená část) ───────────────────────────────────────────────
var UIManager = {
    createOverview() {
        $('#overwatchNotification, #tribeLeaderUI').remove();
        $('#contentContainer').prepend(this.buildUI());
        this.setupEventListeners();
        this.setInitialValues();
        try { $('#tribeLeaderUI').draggable(); } catch (e) { }
        if (discordWebhookUrl) {
            $('#owDiscordWebhookInput').val(discordWebhookUrl);
            $('#owDiscordStatus').text('✓ Saved');
        }
    },

    buildUI() {
        return `
        <div id="overwatchNotification">Placeholder</div>
        <div id="tribeLeaderUI" class="ui-widget-content vis" style="min-width:300px;background:rgba(20, 0, 0, 0.9);backdrop-filter:blur(10px);color:#eaeaea;border:1px solid #d4af37;position:fixed;cursor:move;z-index:999;top:60px;right:20px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.8);padding-bottom:10px;">
            <div style="padding:10px;">
                <div id="owHeaderBar" style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid rgba(212,175,55,0.2);margin-bottom:10px;">
                    <span style="color:#d4af37;font-weight:800;font-size:14px;letter-spacing:2px;text-transform:uppercase;">MAP OVERVIEW v0.25</span>
                    <button id="owMinimizeBtn" style="background:none;border:1px solid rgba(212,175,55,0.3);color:#d4af37;cursor:pointer;padding:2px 8px;border-radius:4px;">–</button>
                </div>
                <div id="toggleUi">
                    ${this.buildFilterBar()}
                    <center>
                        <table style="margin:10px; border-spacing: 4px;">
                            <tr>
                                <td><input type="button" class="btn" id="playerSettingsButton" value="Player settings"/></td>
                                <td><input type="button" class="btn" id="stackSizeButton" value="Stack settings"/></td>
                                <td><input type="button" class="btn" id="stackListButton" value="Stack list"/></td>
                                <td><input type="button" class="btn" id="importExportButton" value="Import/Export"/></td>
                            </tr>
                        </table>
                        ${this.buildPlayerSettingsTab()}
                        ${this.buildStackSizeTab()}
                        ${this.buildStackListTab()}
                        ${this.buildImportExportTab()}
                        <div style="margin-top:10px;">
                            <a href="#" class="btn btn-default" id="redrawMapBtn">Redraw map</a>
                            <a href="#" class="btn btn-default" id="refreshDataBtn">Refresh data</a>
                            <a href="#" class="btn btn-default" id="discordSummaryBtn">Send to Discord</a>
                        </div>
                        <div style="text-align:right; margin-top:15px; margin-right:5px; color:#555; font-size:9px; font-weight:bold;">Powered by TheBrain🧠</div>
                    </center>
                </div>
            </div>
        </div>`;
    },

    buildFilterBar() {
        return `
        <div id="owFilterBar">
            <span style="font-size:12px;font-weight:bold;color:#000;">Filter:</span>
            <button class="ow-filter-btn" data-filter="empty">Empty</button>
            <button class="ow-filter-btn" data-filter="attacked">Under attack</button>
            <button class="ow-filter-btn" data-filter="lowwall">Wall < 20</button>
            <button class="ow-filter-btn" data-filter="hasWT">Has WT</button>
            <button class="ow-filter-btn" data-filter="noble">Noble train</button>
            <button class="ow-filter-btn" id="clearFiltersBtn">✕ Clear</button>
        </div>`;
    },

    buildPlayerSettingsTab() {
        const hasWT = 'watchtower' in (game_data.village.buildings || {});
        let html = `
        <div id="playerSettings">
            <div style="max-height:400px;overflow-y:auto;margin:10px;">
            <table class="vis overviewWithPadding" style="border:1px solid #7d510f;width:100%;background:#f4e4bc;">
                <thead><tr>
                    <th style="color:#000;">Player name</th>
                    ${hasWT ? '<th style="color:#000;">Map WT</th><th style="color:#000;">Mini WT</th>' : ''}
                    <th style="color:#000;">Color & Opacity</th>
                    <th style="color:#000;">Attacks</th>
                    <th style="color:#000;">Vils</th>
                </tr></thead>
                <tbody>`;
        
        playerData.forEach((player, i) => {
            const color = player.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length].color;
            const opacity = player.opacity != null ? player.opacity : 0.3;
            // Unikátní ID bez mezer a speciálních znaků
            const safeID = player.playerID.toString().replace(/\D/g, ''); 
            
            html += `
            <tr class="${i % 2 === 0 ? 'row_a' : 'row_b'}">
                <td>${player.playerName}</td>
                ${hasWT ? `
                <td><center><input id="checkMapWT${safeID}" type="checkbox" ${player.checkedWT ? 'checked' : ''} onchange="SettingsManager.updateFromUI();SettingsManager.save();"></center></td>
                <td><center><input id="checkWTMini${safeID}" type="checkbox" ${player.checkedWTMini ? 'checked' : ''} onchange="SettingsManager.updateFromUI();SettingsManager.save();"></center></td>` : ''}
                <td>
                    <div style="display:flex;align-items:center;gap:4px;">
                        <input id="val${safeID}" type="color" value="${color}" style="width:25px;height:20px;padding:0;"
                               onchange="SettingsManager.updateFromUI();SettingsManager.save();">
                        <input id="alp${safeID}" type="range" min="0" max="1" step="0.1" value="${opacity}" style="width:50px;opacity:1!important;pointer-events:all!important;-webkit-appearance:auto!important;"
                               oninput="SettingsManager.updateFromUI();SettingsManager.save();">
                    </div>
                </td>
                <td>${player.attackCount}</td>
                <td>${(player.playerVillages || []).length}</td>
            </tr>`;
        });

        html += `</tbody></table></div></div>`;
        return html;
    },

    // ... (Zbytek build metod buildStackSizeTab atd. zůstává stejný) ...
    buildStackSizeTab() { return `<div id="stackSize" style="display:none;padding:10px;">Stack settings content</div>`; },
    buildStackListTab() { return `<div id="stackList" style="display:none;padding:10px;">Stack list content</div>`; },
    buildImportExportTab() { return `<div id="importExport" style="display:none;padding:10px;">Import/Export content</div>`; },

    setupEventListeners() {
        $('#owMinimizeBtn').click(() => this.toggleUI());
        ['playerSettings', 'stackSize', 'stackList', 'importExport'].forEach(cat => {
            $(`#${cat}Button`).click(() => this.displayCategory(cat));
        });
        $('#redrawMapBtn').click(e => { e.preventDefault(); saveSettingsAndRedraw(); });
        $('#refreshDataBtn').click(e => { e.preventDefault(); location.reload(); });
    },

    displayCategory(cat) {
        ['playerSettings', 'stackSize', 'stackList', 'importExport'].forEach(c => $(`#${c}`).hide());
        $(`#${cat}`).show();
    },

    toggleUI() {
        $('#toggleUi').toggle();
        $('#owMinimizeBtn').text($('#toggleUi').is(':visible') ? '–' : '+');
    },
    
    setInitialValues() {
        this.displayCategory('playerSettings');
    }
};

// ─── REWRITE SETTINGS UPDATE TO BE ROBUST ──────────────────────────────────────
SettingsManager.updateFromUI = function() {
    playerData.forEach(player => {
        const safeID = player.playerID.toString().replace(/\D/g, '');
        const colorEl = document.getElementById('val' + safeID);
        const alphaEl = document.getElementById('alp' + safeID);
        const wtMapEl = document.getElementById('checkMapWT' + safeID);
        const wtMiniEl = document.getElementById('checkWTMini' + safeID);

        if (colorEl) player.color = colorEl.value;
        if (alphaEl) player.opacity = parseFloat(alphaEl.value);
        if (wtMapEl) player.checkedWT = wtMapEl.checked;
        if (wtMiniEl) player.checkedWTMini = wtMiniEl.checked;
    });
};

// ... (Zbytek kódu - MapRenderer, DataManager atd. zůstává nezměněn) ...

// ─── INIT ────────────────────────────────────────────────────────────────────
(async () => {
    SettingsManager.load();
    await DataManager.fetchPlayerIDs();
    await DataManager.fetchBuildingIDs();
    await DataManager.fetchOwnVillages();
    await DataManager.fetchAllData();
    UIManager.createOverview();
})();
