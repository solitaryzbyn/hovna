javascript:
// Created by TheBrain
// Version: 0.9
var version = 0.9;

// --- GHOST MODE LOGIC ---
function checkCaptcha() {
    if ($("#bot_check").length > 0 || $("body").text().includes("Boti") || $("#captcha").length > 0) {
        console.error("CAPTCHA DETECTED! Stopping bot for safety.");
        return true;
    }
    return false;
}

function startGhostMode() {
    if (checkCaptcha()) return;
    console.log("Ghost Mode: Starting initialization...");
    let timeLeft = 30;
    const btnCalculate = $("#sendMass");
    
    if (btnCalculate.length) {
        const originalValue = btnCalculate.val();
        const countdownInterval = setInterval(() => {
            if (checkCaptcha()) { clearInterval(countdownInterval); return; }
            btnCalculate.val(originalValue + " (Ghost: " + timeLeft + "s)");
            timeLeft--;

            if (timeLeft < 0) {
                clearInterval(countdownInterval);
                btnCalculate.val(originalValue);
                console.log("Ghost Mode: Calculating runtimes...");
                readyToSend(); 

                setTimeout(() => {
                    let groupIndex = 0;
                    function launchNext() {
                        if (checkCaptcha()) return;
                        const btnLaunch = $(`#sendRow${groupIndex} .btnSophie`).first();
                        if (btnLaunch.length) {
                            let humanDelay = Math.floor(Math.random() * (3800 - 1500 + 1) + 1500);
                            console.log(`Ghost Mode: Launching Group ${groupIndex + 1} with human delay ${humanDelay}ms...`);
                            btnLaunch.click();
                            groupIndex++;
                            setTimeout(launchNext, humanDelay);
                        } else {
                            let randomDelayMinutes = Math.floor(Math.random() * (9 - 3 + 1) + 3);
                            let totalDelaySeconds = (120 * 60) + (randomDelayMinutes * 60);
                            console.log(`Ghost Mode: All groups processed. Next run in 120min + ${randomDelayMinutes}min.`);
                            setTimeout(() => { if (!checkCaptcha()) location.reload(); }, totalDelaySeconds * 1000);
                        }
                    }
                    launchNext();
                }, 3000);
            }
        }, 1000);
    } else {
        setTimeout(startGhostMode, 5000);
    }
}

// --- PŮVODNÍ KÓD (UPRAVENÝ VIZUÁL & PODPIS) ---
serverTimeTemp = $("#serverDate")[0].innerText + " " + $("#serverTime")[0].innerText;
serverTime = serverTimeTemp.match(/^([0][1-9]|[12][0-9]|3[01])[\/\-]([0][1-9]|1[012])[\/\-](\d{4})( (0?[0-9]|[1][0-9]|[2][0-3])[:]([0-5][0-9])([:]([0-5][0-9]))?)?$/);
serverDate = Date.parse(serverTime[3] + "/" + serverTime[2] + "/" + serverTime[1] + serverTime[4]);
var is_mobile = !!navigator.userAgent.match(/iphone|android|blackberry/ig) || false;
var scavengeInfo;

if (window.location.href.indexOf('screen=place&mode=scavenge_mass') < 0) {
    window.location.assign(game_data.link_base_pure + "place&mode=scavenge_mass");
}

$("#massScavengeSophie").remove();
var langShinko = ["Mass scavenging", "Select units", "Categories", "Return time", "Runtime", "Calculate runtimes", "Creator: ", "Mass scavenging", "Launch group "];

// BARVY - TMÁVĚ ČERVENÁ / RUDÁ
var backgroundColor = "#1a0000", borderColor = "#8B0000", headerColor = "#4d0000", titleColor = "#ffcccc";

if (localStorage.getItem("troopTypeEnabled") == null) {
    worldUnits = game_data.units;
    var troopTypeEnabled = {};
    for (var i = 0; i < worldUnits.length; i++) {
        if (["spear", "sword", "axe", "archer", "light", "heavy"].includes(worldUnits[i])) troopTypeEnabled[worldUnits[i]] = true;
        else troopTypeEnabled[worldUnits[i]] = false;
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

localStorage.setItem("timeElement", "Hours");
var runTimes = {"off": 1.99, "def": 1.99};

if (localStorage.getItem("sendOrder") == null) {
    worldUnits = game_data.units;
    var sendOrder = [];
    for (var i = 0; i < worldUnits.length; i++) {
        if (!["militia", "snob", "ram", "catapult", "spy", "knight"].includes(worldUnits[i])) sendOrder.push(worldUnits[i]);
    }
    localStorage.setItem("sendOrder", JSON.stringify(sendOrder));
} else {
    var sendOrder = JSON.parse(localStorage.getItem("sendOrder"));
}

var URLReq = (game_data.player.sitter > 0) ? `game.php?t=${game_data.player.id}&screen=place&mode=scavenge_mass` : "game.php?&screen=place&mode=scavenge_mass";
var squad_requests = [], enabledCategories = [true, true, true, true], time = {'off': 1.99, 'def': 1.99};

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
            let htmlFinal = `<div id="massScavengeFinal" class="ui-widget-content" style="position:fixed;background-color:${backgroundColor};z-index:100;top:50px;left:50px;padding:10px;border:2px solid ${borderColor};color:white;"><button class="btn" onclick="closeWindow('massScavengeFinal')">X</button><table id="massScavengeSophieFinalTable" class="vis">`;
            for (let s = 0; s < Object.keys(squads).length; s++) {
                htmlFinal += `<tr id="sendRow${s}"><td><input type="button" class="btn btnSophie" style="background:#8B0000;color:white;border:1px solid #ffcccc" onclick="sendGroup(${s})" value="${langShinko[8]}${s + 1}"></td></tr>`;
            }
            $(".maincell").eq(0).prepend(htmlFinal + "</table><br><small>Created by TheBrain</small></div>");
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
    getData();
}

function sendGroup(n) {
    TribalWars.post('scavenge_api', { ajaxaction: 'send_squads' }, { "squad_requests": window.squads[n] }, function () { UI.SuccessMessage("Odesláno"); }, !1);
}

function zeroPadded(v) { return v < 10 ? '0'+v : v; }
function closeWindow(t) { $("#" + t).remove(); }

let html = `<div id="massScavengeSophie" class="ui-widget-content" style="width:600px;background-color:${backgroundColor};z-index:50;position:fixed;padding:15px;border:3px solid ${borderColor};color:white;box-shadow: 0 0 15px #8B0000;"><button class="btn" style="float:right" onclick="closeWindow('massScavengeSophie')">X</button><h2 style="text-align:center;color:${titleColor}">Mass Scavenge Ghost 0.9</h2><p style="text-align:center;margin-top:-10px"><i>Developed by TheBrain</i></p><hr style="border-color:${borderColor}"><div id="imgRow" style="display:flex;justify-content:center;flex-wrap:wrap"></div><hr style="border-color:${borderColor}"><center>Hours: 1.99 | Mode: Auto-Hours<br><br><input type="button" class="btn btnSophie" id="sendMass" style="background:${borderColor};color:white;padding:10px" onclick="readyToSend()" value="Calculate runtimes"></center></div>`;
$(".maincell").eq(0).prepend(html);
for (let i = 0; i < sendOrder.length; i++) {
    $("#imgRow").append(`<div style="margin:5px;text-align:center"><img src="https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_${sendOrder[i]}.png"><br><input type="checkbox" id="${sendOrder[i]}" ${troopTypeEnabled[sendOrder[i]]?'checked':''}></div>`);
}

setTimeout(startGhostMode, 1500);
