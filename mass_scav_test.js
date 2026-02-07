javascript:
// Mass scavenging by TheBrain - Ghost Mode Enabled
// Version: 0.2
var version = 0.3;

// --- GHOST MODE LOGIC ---
function startGhostMode() {
    let timeLeft = 30;
    const btnCalculate = $("#sendMass");
    
    if (btnCalculate.length) {
        const originalValue = btnCalculate.val();
        const countdownInterval = setInterval(() => {
            btnCalculate.val(originalValue + " (Ghost: " + timeLeft + "s)");
            timeLeft--;

            if (timeLeft < 0) {
                clearInterval(countdownInterval);
                btnCalculate.val(originalValue);
                console.log("Ghost Mode: Calculating runtimes...");
                readyToSend(); 

                // Čekání na vygenerování odesílacích tlačítek a automatické klikání na všechny skupiny
                setTimeout(() => {
                    let groupIndex = 0;
                    const launchAllGroups = setInterval(() => {
                        const btnLaunch = $(`#sendRow${groupIndex} .btnSophie`).first();
                        if (btnLaunch.length) {
                            console.log(`Ghost Mode: Launching Group ${groupIndex + 1}...`);
                            btnLaunch.click();
                            groupIndex++;
                        } else {
                            console.log("Ghost Mode: All groups sent or no groups found.");
                            clearInterval(launchAllGroups);
                        }
                    }, 1000); // Pauza 1 sekunda mezi skupinami pro stabilitu
                }, 2000);
            }
        }, 1000);
    }
}

// --- PŮVODNÍ KÓD SOPHIE (KOMPLETNÍ) ---
serverTimeTemp = $("#serverDate")[0].innerText + " " + $("#serverTime")[0].innerText;
serverTime = serverTimeTemp.match(/^([0][1-9]|[12][0-9]|3[01])[\/\-]([0][1-9]|1[012])[\/\-](\d{4})( (0?[0-9]|[1][0-9]|[2][0-3])[:]([0-5][0-9])([:]([0-5][0-9]))?)?$/);
serverDate = Date.parse(serverTime[3] + "/" + serverTime[2] + "/" + serverTime[1] + serverTime[4]);
var is_mobile = !!navigator.userAgent.match(/iphone|android|blackberry/ig) || false;
var scavengeInfo;
var tempElementSelection="";

if (window.location.href.indexOf('screen=place&mode=scavenge_mass') < 0) {
    window.location.assign(game_data.link_base_pure + "place&mode=scavenge_mass");
}

$("#massScavengeSophie").remove();

var langShinko = ["Mass scavenging", "Select unit types/ORDER to scavenge with", "Select categories to use", "When do you want your scav runs to return?", "Runtime here", "Calculate runtimes for each page", "Creator: ", "Mass scavenging: send per 50 villages", "Launch group "];

// Nastavení jednotek - pokud jsou všechna vypnutá, zapneme základní pro sběr
if (localStorage.getItem("troopTypeEnabled") == null) {
    worldUnits = game_data.units;
    var troopTypeEnabled = {};
    for (var i = 0; i < worldUnits.length; i++) {
        if (["spear", "sword", "axe", "archer", "light", "heavy"].includes(worldUnits[i])) {
            troopTypeEnabled[worldUnits[i]] = true; // Automaticky zapneme základní jednotky
        } else {
            troopTypeEnabled[worldUnits[i]] = false;
        }
    }
    localStorage.setItem("troopTypeEnabled", JSON.stringify(troopTypeEnabled));
} else {
    var troopTypeEnabled = JSON.parse(localStorage.getItem("troopTypeEnabled"));
}

if (localStorage.getItem("keepHome") == null) {
    var keepHome = {"spear": 0, "sword": 0, "axe": 0, "archer": 0, "light": 0, "marcher": 0, "heavy": 0};
    localStorage.setItem("keepHome", JSON.stringify(keepHome));
} else {
    var keepHome = JSON.parse(localStorage.getItem("keepHome"));
}

if (localStorage.getItem("categoryEnabled") == null) {
    var categoryEnabled = [true, true, true, true];
    localStorage.setItem("categoryEnabled", JSON.stringify(categoryEnabled));
} else {
    var categoryEnabled = JSON.parse(localStorage.getItem("categoryEnabled"));
}

if (localStorage.getItem("prioritiseHighCat") == null) {
    var prioritiseHighCat = false;
    localStorage.setItem("prioritiseHighCat", JSON.stringify(prioritiseHighCat));
} else {
    var prioritiseHighCat = JSON.parse(localStorage.getItem("prioritiseHighCat"));
}

if (localStorage.getItem("sendOrder") == null) {
    worldUnits = game_data.units;
    var sendOrder = [];
    for (var i = 0; i < worldUnits.length; i++) {
        if (!["militia", "snob", "ram", "catapult", "spy", "knight"].includes(worldUnits[i])) {
            sendOrder.push(worldUnits[i]);
        }
    }
    localStorage.setItem("sendOrder", JSON.stringify(sendOrder));
} else {
    var sendOrder = JSON.parse(localStorage.getItem("sendOrder"));
}

if (localStorage.getItem("runTimes") == null) {
    var runTimes = {"off": 4, "def": 3};
    localStorage.setItem("runTimes", JSON.stringify(runTimes));
} else {
    var runTimes = JSON.parse(localStorage.getItem("runTimes"));
}

var URLReq = (game_data.player.sitter > 0) ? `game.php?t=${game_data.player.id}&screen=place&mode=scavenge_mass` : "game.php?&screen=place&mode=scavenge_mass";
var squad_requests = [], enabledCategories = [], time = {'off': 0, 'def': 0};
var categoryNames = JSON.parse("[" + $.find('script:contains("ScavengeMassScreen")')[0].innerHTML.match(/\{.*\:\{.*\:.*\}\}/g) + "]")[0];
var backgroundColor = "#36393f", borderColor = "#3e4147", headerColor = "#202225", titleColor = "#ffffdf";

$.getAll = function (urls, onLoad, onDone, onError) {
    var numDone = 0, lastRequestTime = 0, minWaitTime = 200;
    loadNext();
    function loadNext() {
        if (numDone == urls.length) { onDone(); return; }
        let now = Date.now();
        if (now - lastRequestTime < minWaitTime) { setTimeout(loadNext, minWaitTime - (now - lastRequestTime)); return; }
        lastRequestTime = now;
        $.get(urls[numDone]).done((data) => { try { onLoad(numDone, data); ++numDone; loadNext(); } catch (e) { onError(e); } }).fail((xhr) => { onError(xhr); });
    }
};

function getData() {
    $("#massScavengeSophie").remove();
    let URLs = [];
    $.get(URLReq, function (data) {
        let pages = ($(".paged-nav-item").length > 0) ? parseInt($(".paged-nav-item")[$(".paged-nav-item").length - 1].href.match(/page=(\d+)/)[1]) : 0;
        for (let i = 0; i <= pages; i++) URLs.push(URLReq + "&page=" + i);
        let tempData = JSON.parse($(data).find('script:contains("ScavengeMassScreen")').html().match(/\{.*\:\{.*\:.*\}\}/g)[0]);
        duration_exponent = tempData[1].duration_exponent;
        duration_factor = tempData[1].duration_factor;
        duration_initial_seconds = tempData[1].duration_initial_seconds;
    }).done(function () {
        let arrayWithData = "[";
        $.getAll(URLs, (i, data) => {
            arrayWithData += $(data).find('script:contains("ScavengeMassScreen")').html().match(/\{.*\:\{.*\:.*\}\}/g)[2] + ",";
        }, () => {
            scavengeInfo = JSON.parse(arrayWithData.substring(0, arrayWithData.length - 1) + "]");
            for (let i = 0; i < scavengeInfo.length; i++) calculateHaulCategories(scavengeInfo[i]);
            
            let squads = {}, groupNumber = 0, per200 = 0;
            squads[groupNumber] = [];
            for (let k = 0; k < squad_requests.length; k++) {
                if (per200 == 200) { groupNumber++; squads[groupNumber] = []; per200 = 0; }
                per200++; squads[groupNumber].push(squad_requests[k]);
            }
            window.squads = squads;

            let htmlFinal = `<div id="massScavengeFinal" class="ui-widget-content" style="position:fixed;background-color:${backgroundColor};z-index:100;top:50px;left:50px;padding:10px;border:2px solid ${borderColor};"><button class="btn" onclick="closeWindow('massScavengeFinal')">X</button><table id="massScavengeSophieFinalTable" class="vis">`;
            for (let s = 0; s < Object.keys(squads).length; s++) {
                htmlFinal += `<tr id="sendRow${s}"><td><input type="button" class="btn btnSophie" onclick="sendGroup(${s})" value="${langShinko[8]}${s + 1}"></td></tr>`;
            }
            $(".maincell").eq(0).prepend(htmlFinal + "</table></div>");
        }, (e) => console.error(e));
    });
}

function calculateHaulCategories(data) {
    if (!data.has_rally_point) return;
    let troopsAllowed = {};
    for (let key in troopTypeEnabled) {
        if (troopTypeEnabled[key]) {
            let available = (data.unit_counts_home[key] || 0) - (keepHome[key] || 0);
            if (available > 0) troopsAllowed[key] = available;
        }
    }
    if (Object.keys(troopsAllowed).length === 0) return;

    let haul = parseInt(((time.off * 3600) / duration_factor - duration_initial_seconds) ** (1 / (duration_exponent)) / 100) ** (1 / 2);
    let haulRate = {1: (enabledCategories[0] && !data.options[1].is_locked) ? haul/0.1 : 0, 2: (enabledCategories[1] && !data.options[2].is_locked) ? haul/0.25 : 0, 3: (enabledCategories[2] && !data.options[3].is_locked) ? haul/0.50 : 0, 4: (enabledCategories[3] && !data.options[4].is_locked) ? haul/0.75 : 0};
    
    let unitsReady = calculateUnitsPerVillage(troopsAllowed, haulRate);
    for (let k = 0; k < 4; k++) {
        if (Object.keys(unitsReady[k]).length > 0) {
            squad_requests.push({ "village_id": data.village_id, "candidate_squad": {"unit_counts": unitsReady[k], "carry_max": 99999999}, "option_id": k + 1, "use_premium": false });
        }
    }
}

function calculateUnitsPerVillage(troops, rates) {
    let result = {0:{}, 1:{}, 2:{}, 3:{}};
    let unitHaul = {"spear":25, "sword":15, "axe":10, "archer":10, "light":80, "marcher":50, "heavy":50, "knight":100};
    for (let j = 3; j >= 0; j--) {
        let reach = rates[j + 1];
        sendOrder.forEach((u) => {
            if (troops[u] > 0 && reach > 0) {
                let toSend = Math.min(Math.floor(reach / unitHaul[u]), troops[u]);
                if (toSend > 0) { result[j][u] = toSend; reach -= toSend * unitHaul[u]; troops[u] -= toSend; }
            }
        });
    }
    return result;
}

function readyToSend() {
    for (let i = 0; i < sendOrder.length; i++) {
        troopTypeEnabled[sendOrder[i]] = $(`#${sendOrder[i]}`).is(":checked");
        keepHome[sendOrder[i]] = parseInt($(`#${sendOrder[i]}Backup`).val()) || 0;
    }
    enabledCategories = [$("#category1").is(":checked"), $("#category2").is(":checked"), $("#category3").is(":checked"), $("#category4").is(":checked")];
    if ($("#timeSelectorDate")[0].checked) {
        time.off = (Date.parse($("#offDay").val().replace(/-/g, "/") + " " + $("#offTime").val()) - serverDate) / 1000 / 3600;
        time.def = (Date.parse($("#defDay").val().replace(/-/g, "/") + " " + $("#defTime").val()) - serverDate) / 1000 / 3600;
    } else {
        time.off = $('.runTime_off').val(); time.def = $('.runTime_def').val();
    }
    localStorage.setItem("troopTypeEnabled", JSON.stringify(troopTypeEnabled));
    localStorage.setItem("keepHome", JSON.stringify(keepHome));
    getData();
}

function sendGroup(n) {
    TribalWars.post('scavenge_api', { ajaxaction: 'send_squads' }, { "squad_requests": window.squads[n] }, function () { UI.SuccessMessage("Skupina odeslána"); }, !1);
}

function setTimeToField(r) { let d = new Date(Date.parse(serverDate) + r*3600000); return zeroPadded(d.getHours())+":"+zeroPadded(d.getMinutes()); }
function setDayToField(r) { let d = new Date(Date.parse(serverDate) + r*3600000); return d.getFullYear()+"-"+zeroPadded(d.getMonth()+1)+"-"+zeroPadded(d.getDate()); }
function zeroPadded(v) { return v < 10 ? '0'+v : v; }
function closeWindow(t) { $("#" + t).remove(); }

// UI vykreslení
let html = `<div id="massScavengeSophie" class="ui-widget-content" style="width:600px;background-color:${backgroundColor};z-index:50;position:fixed;padding:10px;border:1px solid ${borderColor};"><button class="btn" onclick="closeWindow('massScavengeSophie')">X</button><table class="vis" style="width:100%"><tr><td colspan="10" style="text-align:center; background-color:${headerColor}"><font color="${titleColor}">Mass Scavenge Ghost 0.3</font></td></tr><tr id="imgRow"></tr></table><table class="vis" style="width:100%"><tr><td colspan="4" style="text-align:center;background-color:${headerColor}"><font color="${titleColor}">Kategorie</font></td></tr><tr><td>Líný <input type="checkbox" id="category1" ${categoryEnabled[0]?'checked':''}></td><td>Běžný <input type="checkbox" id="category2" ${categoryEnabled[1]?'checked':''}></td><td>Chytrý <input type="checkbox" id="category3" ${categoryEnabled[2]?'checked':''}></td><td>Velký <input type="checkbox" id="category4" ${categoryEnabled[3]?'checked':''}></td></tr></table><table class="vis" style="width:100%"><tr><td><input type="radio" id="timeSelectorDate" name="timeSelector" checked> Datum</td><td><input type="date" id="offDay" value="${setDayToField(runTimes.off)}"><input type="time" id="offTime" value="${setTimeToField(runTimes.off)}"></td></tr><tr><td><input type="radio" id="timeSelectorHours" name="timeSelector"> Hodiny</td><td><input type="text" class="runTime_off" value="${runTimes.off}" size="3"> Off <input type="text" class="runTime_def" value="${runTimes.def}" size="3"> Def</td></tr></table><center><input type="button" class="btn btnSophie" id="sendMass" onclick="readyToSend()" value="Calculate runtimes"></center></div>`;
$(".maincell").eq(0).prepend(html);
for (let i = 0; i < sendOrder.length; i++) {
    $("#imgRow").append(`<td align="center"><img src="https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_${sendOrder[i]}.png"><br><input type="checkbox" id="${sendOrder[i]}" ${troopTypeEnabled[sendOrder[i]]?'checked':''}><br>B:<input type="text" id="${sendOrder[i]}Backup" value="${keepHome[sendOrder[i]]||0}" size="2"></td>`);
}

setTimeout(startGhostMode, 1000);
