javascript:
// Mass scavenging by TheBrain - Ghost Mode Enabled
// Version: 0.2
var version = 0.2;

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
                readyToSend(); // Voláme přímo funkci pro výpočet

                // Čekání na vygenerování UI s tlačítky pro odeslání
                setTimeout(() => {
                    const btnLaunch = $("#sendMass[value*='" + langShinko[8] + "1']").first();
                    if (btnLaunch.length) {
                        console.log("Ghost Mode: Launching Group 1...");
                        btnLaunch.click();
                    } else {
                        // Záložní hledání v tabulce výsledků
                        const btnFinal = $("#massScavengeSophieFinalTable #sendMass").first();
                        if (btnFinal.length) btnFinal.click();
                    }
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

var langShinko = [
    "Mass scavenging",
    "Select unit types/ORDER to scavenge with (drag units to order)",
    "Select categories to use",
    "When do you want your scav runs to return (approximately)?",
    "Runtime here",
    "Calculate runtimes for each page",
    "Creator: ",
    "Mass scavenging: send per 50 villages",
    "Launch group "
];

if (game_data.locale == "ro_RO") {
    langShinko = ["Curatare in masa", "Selecteaza tipul unitatii/ORDONEAZA sa curete cu (trage unitatea pentru a ordona)", "Selecteaza categoria", "Cand vrei sa se intoarca trupele de la curatare (aproximativ)", "Durata aici", "Calculeaza durata pentru každou pagina", "Creator: ", "Cueatare in masa: trimite pe 50 de sate", "Lanseaza grup "];
}
if (game_data.locale == "nl_NL") {
    langShinko = ["Massa rooftochten", "Kies welke troeptypes je wil mee roven, sleep om prioriteit te ordenen", "Kies categorieën die je wil gebruiken", "Wanneer wil je dat je rooftochten terug zijn?", "Looptijd hier invullen", "Bereken rooftochten voor iedere pagina", "Scripter: ", "Massa rooftochten: verstuur per 50 dorpen", "Verstuur groep "];
}

if (localStorage.getItem("troopTypeEnabled") == null) {
    worldUnits = game_data.units;
    var troopTypeEnabled = {};
    for (var i = 0; i < worldUnits.length; i++) {
        if (worldUnits[i] != "militia" && worldUnits[i] != "snob" && worldUnits[i] != "ram" && worldUnits[i] != "catapult" && worldUnits[i] != "spy" && worldUnits[i] != "knight") {
            troopTypeEnabled[worldUnits[i]] = false;
        }
    };
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

if (localStorage.getItem("timeElement") == null) {
    localStorage.setItem("timeElement", "Date");
    tempElementSelection = "Date";
} else {
    tempElementSelection = localStorage.getItem("timeElement");
}

if (localStorage.getItem("sendOrder") == null) {
    worldUnits = game_data.units;
    var sendOrder = [];
    for (var i = 0; i < worldUnits.length; i++) {
        if (worldUnits[i] != "militia" && worldUnits[i] != "snob" && worldUnits[i] != "ram" && worldUnits[i] != "catapult" && worldUnits[i] != "spy" && worldUnits[i] != "knight") {
            sendOrder.push(worldUnits[i]);
        }
    };
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

var premiumBtnEnabled = false;
var URLReq = (game_data.player.sitter > 0) ? `game.php?t=${game_data.player.id}&screen=place&mode=scavenge_mass` : "game.php?&screen=place&mode=scavenge_mass";

var arrayWithData, enabledCategories = [], availableUnits = [], squad_requests = [], squad_requests_premium = [], scavengeInfo, duration_factor = 0, duration_exponent = 0, duration_initial_seconds = 0;
var categoryNames = JSON.parse("[" + $.find('script:contains("ScavengeMassScreen")')[0].innerHTML.match(/\{.*\:\{.*\:.*\}\}/g) + "]")[0];
var time = {'off': 0, 'def': 0};

var backgroundColor = "#36393f", borderColor = "#3e4147", headerColor = "#202225", titleColor = "#ffffdf";
cssClassesSophie = `<style>.sophRowA {background-color: #32353b; color: white;} .sophRowB {background-color: #36393f; color: white;} .sophHeader {background-color: #202225; font-weight: bold; color: white;} .btnSophie {background-image: linear-gradient(#6e7178 0%, #36393f 30%, #202225 80%, black 100%);} .btnSophie:hover {background-image: linear-gradient(#7b7e85 0%, #40444a 30%, #393c40 80%, #171717 100%);} #x {position: absolute; background: red; color: white; top: 0px; right: 0px; width: 30px; height: 30px;} #cog {position: absolute; background: #32353b; color: white; top: 0px; right: 30px; width: 30px; height: 30px;}</style>`;

$("#contentContainer").eq(0).prepend(cssClassesSophie);
$("#mobileHeader").eq(0).prepend(cssClassesSophie);

$.getAll = function (urls, onLoad, onDone, onError) {
    var numDone = 0, lastRequestTime = 0, minWaitTime = 200;
    loadNext();
    function loadNext() {
        if (numDone == urls.length) { onDone(); return; }
        let now = Date.now();
        let timeElapsed = now - lastRequestTime;
        if (timeElapsed < minWaitTime) { setTimeout(loadNext, minWaitTime - timeElapsed); return; }
        lastRequestTime = now;
        $.get(urls[numDone]).done((data) => { try { onLoad(numDone, data); ++numDone; loadNext(); } catch (e) { onError(e); } }).fail((xhr) => { onError(xhr); });
    }
};

function getData() {
    $("#massScavengeSophie").remove();
    URLs = [];
    $.get(URLReq, function (data) {
        amountOfPages = ($(".paged-nav-item").length > 0) ? parseInt($(".paged-nav-item")[$(".paged-nav-item").length - 1].href.match(/page=(\d+)/)[1]) : 0;
        for (var i = 0; i <= amountOfPages; i++) {
            URLs.push(URLReq + "&page=" + i);
            tempData = JSON.parse($(data).find('script:contains("ScavengeMassScreen")').html().match(/\{.*\:\{.*\:.*\}\}/g)[0]);
            duration_exponent = tempData[1].duration_exponent;
            duration_factor = tempData[1].duration_factor;
            duration_initial_seconds = tempData[1].duration_initial_seconds;
        }
    }).done(function () {
        arrayWithData = "[";
        $.getAll(URLs, (i, data) => {
            thisPageData = $(data).find('script:contains("ScavengeMassScreen")').html().match(/\{.*\:\{.*\:.*\}\}/g)[2];
            arrayWithData += thisPageData + ",";
        }, () => {
            arrayWithData = arrayWithData.substring(0, arrayWithData.length - 1) + "]";
            scavengeInfo = JSON.parse(arrayWithData);
            for (var i = 0; i < scavengeInfo.length; i++) { calculateHaulCategories(scavengeInfo[i]); }
            squads = {}; squads_premium = {}; per200 = 0; groupNumber = 0;
            squads[groupNumber] = []; squads_premium[groupNumber] = [];
            for (var k = 0; k < squad_requests.length; k++) {
                if (per200 == 200) { groupNumber++; squads[groupNumber] = []; squads_premium[groupNumber] = []; per200 = 0; }
                per200++; squads[groupNumber].push(squad_requests[k]); squads_premium[groupNumber].push(squad_requests_premium[k]);
            }
            htmlWithLaunchButtons = `<div id="massScavengeFinal" class="ui-widget-content" style="position:fixed;background-color:${backgroundColor};z-index:50;"><button class="btn" id="x" onclick="closeWindow('massScavengeFinal')">X</button><table id="massScavengeSophieFinalTable" class="vis" border="1" style="width: 100%;background-color:${backgroundColor};border-color:${borderColor}"><tr><td colspan="10" style="text-align:center; background-color:${headerColor}"><h3><font color="${titleColor}">${langShinko[7]}</font></h3></td></tr>`;
            for (var s = 0; s < Object.keys(squads).length; s++) {
                htmlWithLaunchButtons += `<tr id="sendRow${s}"><td style="text-align:center;"><input type="button" class="btn btnSophie" id="sendMass" onclick="sendGroup(${s},false)" value="${langShinko[8]}${s + 1}"></td></tr>`;
            }
            htmlWithLaunchButtons += "</table></div>";
            $(".maincell").eq(0).prepend(htmlWithLaunchButtons);
        }, (error) => { console.error(error); });
    });
}

html = `<div id="massScavengeSophie" class="ui-widget-content" style="width:600px;background-color:${backgroundColor};z-index:50;position:fixed;"><button class="btn" id ="cog" onclick="settings()">⚙️</button><button class="btn" id="x" onclick="closeWindow('massScavengeSophie')">X</button><table id="massScavengeSophieTable" class="vis" border="1" style="width: 100%;background-color:${backgroundColor};border-color:${borderColor}"><tr><td colspan="10" style="text-align:center; background-color:${headerColor}"><h3><font color="${titleColor}">${langShinko[0]}</font></h3></td></tr><tr id="imgRow"></tr></table><table class="vis" border="1" style="width: 100%;"><tr><td colspan="4" style="text-align:center;background-color:${headerColor}"><font color="${titleColor}">${langShinko[2]}</font></td></tr><tr id="categories"><td>${categoryNames[1].name} <input type="checkbox" id="category1"></td><td>${categoryNames[2].name} <input type="checkbox" id="category2"></td><td>${categoryNames[3].name} <input type="checkbox" id="category3"></td><td>${categoryNames[4].name} <input type="checkbox" id="category4"></td></tr></table><table class="vis" border="1" style="width: 100%;"><tr><td style="background-color:${backgroundColor}"><input type="radio" ID="timeSelectorDate" name="timeSelector"> Datum</td><td style="background-color:${backgroundColor}"><input type="date" id="offDay" value="${setDayToField(runTimes.off)}"><input type="time" id="offTime" value="${setTimeToField(runTimes.off)}"></td></tr><tr><td style="background-color:${backgroundColor}"><input type="radio" ID="timeSelectorHours" name="timeSelector"> Hodiny</td><td style="background-color:${backgroundColor}"><input type="text" class="runTime_off" value="${runTimes['off']}"> Off <input type="text" class="runTime_def" value="${runTimes['def']}"> Def</td></tr></table><center><input type="button" class="btn btnSophie" id="sendMass" onclick="readyToSend()" value="${langShinko[5]}"></center></div>`;

$(".maincell").eq(0).prepend(html);

function readyToSend() {
    for (var i = 0; i < sendOrder.length; i++) { troopTypeEnabled[sendOrder[i]] = $(`:checkbox#${sendOrder[i]}`).is(":checked"); keepHome[sendOrder[i]] = $(`#${sendOrder[i]}Backup`).val(); }
    enabledCategories = [$("#category1").is(":checked"), $("#category2").is(":checked"), $("#category3").is(":checked"), $("#category4").is(":checked")];
    if ($("#timeSelectorDate")[0].checked) {
        time.off = (Date.parse($("#offDay").val().replace(/-/g, "/") + " " + $("#offTime").val()) - serverDate) / 1000 / 3600;
        time.def = (Date.parse($("#defDay").val().replace(/-/g, "/") + " " + $("#defTime").val()) - serverDate) / 1000 / 3600;
    } else {
        time.off = $('.runTime_off').val(); time.def = $('.runTime_def').val();
    }
    categoryEnabled = enabledCategories;
    getData();
}

function sendGroup(groupNr, premiumEnabled) {
    tempSquads = squads[groupNr];
    TribalWars.post('scavenge_api', { ajaxaction: 'send_squads' }, { "squad_requests": tempSquads }, function () { UI.SuccessMessage("Group sent"); }, !1);
    setTimeout(() => { $(`#sendRow${groupNr}`).remove(); }, 200);
}

function calculateHaulCategories(data) {
    if (data.has_rally_point) {
        var troopsAllowed = {};
        for (key in troopTypeEnabled) { if (troopTypeEnabled[key]) troopsAllowed[key] = Math.max(0, data.unit_counts_home[key] - keepHome[key]); }
        totalLoot = 0;
        for (key in troopsAllowed) {
            let factors = {"spear":25, "sword":15, "axe":10, "archer":10, "light":80, "marcher":50, "heavy":50, "knight":100};
            if(factors[key]) totalLoot += troopsAllowed[key] * (data.unit_carry_factor * factors[key]);
        }
        if (totalLoot == 0) return;
        haul = parseInt(((time.off * 3600) / duration_factor - duration_initial_seconds) ** (1 / (duration_exponent)) / 100) ** (1 / 2);
        haulCategoryRate = {1: (enabledCategories[0] && !data.options[1].is_locked) ? haul/0.1 : 0, 2: (enabledCategories[1] && !data.options[2].is_locked) ? haul/0.25 : 0, 3: (enabledCategories[2] && !data.options[3].is_locked) ? haul/0.50 : 0, 4: (enabledCategories[3] && !data.options[4].is_locked) ? haul/0.75 : 0};
        totalHaul = haulCategoryRate[1] + haulCategoryRate[2] + haulCategoryRate[3] + haulCategoryRate[4];
        unitsReadyForSend = calculateUnitsPerVillage(troopsAllowed);
        for (var k = 0; k < 4; k++) {
            if (Object.keys(unitsReadyForSend[k]).length > 0) {
                squad_requests.push({ "village_id": data.village_id, "candidate_squad": {"unit_counts": unitsReadyForSend[k], "carry_max": 99999999}, "option_id": k + 1, "use_premium": false });
                squad_requests_premium.push({ "village_id": data.village_id, "candidate_squad": {"unit_counts": unitsReadyForSend[k], "carry_max": 99999999}, "option_id": k + 1, "use_premium": true });
            }
        }
    }
}

function calculateUnitsPerVillage(troopsAllowed) {
    let unitsReadyForSend = {0:{}, 1:{}, 2:{}, 3:{}};
    let unitHaul = {"spear":25, "sword":15, "axe":10, "archer":10, "light":80, "marcher":50, "heavy":50, "knight":100};
    for (var j = 3; j >= 0; j--) {
        var reach = haulCategoryRate[j + 1];
        sendOrder.forEach((unit) => {
            if (troopsAllowed[unit] > 0 && reach > 0) {
                var amountNeeded = Math.floor(reach / (unitHaul[unit] || 10));
                var toSend = Math.min(amountNeeded, troopsAllowed[unit]);
                if(toSend > 0) { unitsReadyForSend[j][unit] = toSend; reach -= toSend * unitHaul[unit]; troopsAllowed[unit] -= toSend; }
            }
        });
    }
    return unitsReadyForSend;
}

function setTimeToField(r) { d = new Date(Date.parse(serverDate) + r*3600000); return zeroPadded(d.getHours())+":"+zeroPadded(d.getMinutes()); }
function setDayToField(r) { d = new Date(Date.parse(serverDate) + r*3600000); return d.getFullYear()+"-"+zeroPadded(d.getMonth()+1)+"-"+zeroPadded(d.getDate()); }
function zeroPadded(v) { return v < 10 ? '0'+v : v; }
function closeWindow(t) { $("#" + t).remove(); }

// Renderování jednotek do UI
for (var i = 0; i < sendOrder.length; i++) {
    $("#imgRow").append(`<td align="center" style="background-color:${backgroundColor}"><img src="https://dsen.innogamescdn.com/asset/cf2959e7/graphic/unit/unit_${sendOrder[i]}.png"><br><input type="checkbox" id="${sendOrder[i]}" ${troopTypeEnabled[sendOrder[i]]?'checked':''}></td>`);
}

// Spuštění Ghost Mode
setTimeout(startGhostMode, 1000);
