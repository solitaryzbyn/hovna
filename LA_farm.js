(async (ModuleLoader) => {
    'use strict';

    // Dependency loading
    await ModuleLoader.loadModule('utils/notify-utils');

    // Controls the window title
    TwFramework.setIdleTitlePreffix('FARMING', document.title);

    // Create global variables
    let maxDistanceA = localStorage.maxDistanceA || 0;
    let maxDistanceB = localStorage.maxDistanceB || 0;
    let maxDistanceC = localStorage.maxDistanceC || 0;
    let maxDistance = maxDistanceA;
    let switchSpeed;
    let speed; 
    let butABoo; 
    let butBBoo; 
    let stop; 
    let removeUnitsFrom; 
    let x = 0;
    let farmButton; 
    const am = game_data.features.AccountManager.active; 
    let tableNr = 4; 
    if (am) {
        tableNr = 6; 
    }

    // Define start variables
    if (localStorage.speed !== undefined) {
        speed = localStorage.speed;
    } else {
        speed = 500; // Střed mezi 450ms a 550ms
        localStorage.speed = speed;
    }
    if (localStorage.switchSpeed !== undefined) {
        switchSpeed = localStorage.switchSpeed;
    } else {
        switchSpeed = 0;
        localStorage.switchSpeed = switchSpeed;
    }
    if (localStorage.stop !== undefined) {
        stop = !!localStorage.stop;
    } else {
        stop = true;
        localStorage.stop = stop;
    }

    // Create input fields
    const distanceInputDiv = document.createElement("div");
    distanceInputDiv.id = "farm-bot-panel";
    distanceInputDiv.style = "background: #e3d5b8; border: 2px solid #7d510f; padding: 10px; margin: 10px 0;";
    
    const letters = ["Max. vzdálenost pro A ", "Max. vzdálenost pro B ", "Max. vzdálenost pro C "];
    const distanceInput = [
        "<input id='distInputA' value='" + maxDistanceA + "' style='width:35px'>",
        "<input id='distInputB' value='" + maxDistanceB + "' style='width:35px'>",
        "<input id='distInputC' value='" + maxDistanceC + "' style='width:35px'>"
    ];
    const buttons = [
        "<button id='buttonDistA' class='btn'>OK</button><span id='textA'></span>",
        "<button id='buttonDistB' class='btn'>OK</button><span id='textB'></span>",
        "<button id='buttonDistC' class='btn'>OK</button><span id='textC'></span>"
    ];

    for (let i = 0; i < 3; i++) {
        distanceInputDiv.innerHTML += "<p>" + letters[i] + distanceInput[i] + buttons[i] + "</p>";
    }

    distanceInputDiv.innerHTML += "<p>Refresh / Přepnutí vteřin: " +
        "<input id='switchSpeed' value='" + switchSpeed + "' style='width:50px'> " +
        "<button id='switchSpeedOk' class='btn'>OK</button><span id='textSwitch'></span></p>" +
        "<p>Prodleva mezi útoky (ms): " +
        "<input id='speed' value='" + speed + "' style='width:40px'> " +
        "<button id='speedOk' class='btn'>OK</button><span id='textSpeed'></span> </p>" +
        "<p><button id='start-stop' class='btn' style='font-weight:bold; padding:5px 15px;'></button></p>";

    // Oprava vkládání panelu - hledáme formulář pomocníka
    const anchor = document.querySelector("#am_widget_Farm") || document.querySelector("#content_value h3");
    if (anchor) {
        anchor.parentNode.insertBefore(distanceInputDiv, anchor);
    }

    // Event Listeners
    document.getElementById("distInputA").addEventListener("keydown", clickOnKeyPress.bind(this, 13, "#buttonDistA"));
    document.getElementById("distInputB").addEventListener("keydown", clickOnKeyPress.bind(this, 13, "#buttonDistB"));
    document.getElementById("distInputC").addEventListener("keydown", clickOnKeyPress.bind(this, 13, "#buttonDistC"));
    document.getElementById("switchSpeed").addEventListener("keydown", clickOnKeyPress.bind(this, 13, "#switchSpeedOk"));
    document.getElementById("speed").addEventListener("keydown", clickOnKeyPress.bind(this, 13, "#speedOk"));

    // Načítání jednotek (ponecháno v původní logice)
    let farmA = {
        spear: parseInt(document.querySelector('input[name="spear"]') ? document.querySelector('form:nth-child(1) input[name="spear"]').value : 0),
        sword: parseInt(document.querySelector('input[name="sword"]') ? document.querySelector('form:nth-child(1) input[name="sword"]').value : 0),
        axe: parseInt(document.querySelector('input[name="axe"]') ? document.querySelector('form:nth-child(1) input[name="axe"]').value : 0),
        spy: parseInt(document.querySelector('input[name="spy"]') ? document.querySelector('form:nth-child(1) input[name="spy"]').value : 0),
        light: parseInt(document.querySelector('input[name="light"]') ? document.querySelector('form:nth-child(1) input[name="light"]').value : 0),
        heavy: parseInt(document.querySelector('input[name="heavy"]') ? document.querySelector('form:nth-child(1) input[name="heavy"]').value : 0)
    };

    let farmB = {
        spear: parseInt(document.querySelector('input[name="spear"]') ? document.querySelector('form:nth-child(2) input[name="spear"]').value : 0),
        sword: parseInt(document.querySelector('input[name="sword"]') ? document.querySelector('form:nth-child(2) input[name="sword"]').value : 0),
        axe: parseInt(document.querySelector('input[name="axe"]') ? document.querySelector('form:nth-child(2) input[name="axe"]').value : 0),
        spy: parseInt(document.querySelector('input[name="spy"]') ? document.querySelector('form:nth-child(2) input[name="spy"]').value : 0),
        light: parseInt(document.querySelector('input[name="light"]') ? document.querySelector('form:nth-child(2) input[name="light"]').value : 0),
        heavy: parseInt(document.querySelector('input[name="heavy"]') ? document.querySelector('form:nth-child(2) input[name="heavy"]').value : 0)
    };

    let unitInVill = {
        spear: parseInt(document.getElementById("spear").innerText) || 0,
        sword: parseInt(document.getElementById("sword").innerText) || 0,
        axe: parseInt(document.getElementById("axe").innerText) || 0,
        spy: parseInt(document.getElementById("spy").innerText) || 0,
        light: parseInt(document.getElementById("light").innerText) || 0,
        heavy: parseInt(document.getElementById("heavy").innerText) || 0
    };

    checkUnits();

    if (!stop) {
        document.getElementById("start-stop").innerText = "Zastavit bota";
        startFarming();
    } else {
        document.getElementById("start-stop").innerText = "Spustit bota";
    }

    function startFarming() {
        let distance = 0;
        const rows = document.querySelectorAll("#plunder_list > tbody > tr");
        const entries = rows.length - 2;

        for (let i = 0; i < entries; i++) {
            try {
                distance = parseFloat(rows[i + 2].cells[7].innerText);
            } catch (e) {}

            if (distance <= maxDistance) {
                $(farmButton).eq(i).each(function () {
                    if (!($(this).parent().parent().find('img.tooltip').length)) {
                        try {
                            removeUnits(removeUnitsFrom);
                        } catch (e) {}
                        
                        // NASTAVENÍ PRODLEVY: 450ms - 550ms
                        let speedNow = (speed * ++x) - random(450, 550);
                        
                        setTimeout(function (myVar) {
                            if (!stop) {
                                $(myVar).click();
                                console.log("%c[Bot] Útok odeslán", "color: green");
                            }
                            if (document.querySelectorAll(".error").length) {
                                console.log("%c[Bot] Detekována chyba, restartuji...", "color: red");
                                reload();
                            }
                        }, speedNow, this);
                    }
                })
            }
        }
    }

    function random(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }

    function checkUnits() {
        // Kontrola jednotek zůstává stejná
        if (unitInVill.spear < farmA.spear || unitInVill.sword < farmA.sword || unitInVill.axe < farmA.axe ||
            unitInVill.spy < farmA.spy || unitInVill.light < farmA.light || unitInVill.heavy < farmA.heavy) {
            butABoo = false;
        } else {
            butABoo = true;
        }

        if (unitInVill.spear < farmB.spear || unitInVill.sword < farmB.sword || unitInVill.axe < farmB.axe ||
            unitInVill.spy < farmB.spy || unitInVill.light < farmB.light || unitInVill.heavy < farmB.heavy) {
            butBBoo = false;
        } else {
            butBBoo = true;
        }

        if (butABoo && $('#am_widget_Farm a.farm_icon_a').length > 0 && parseInt(maxDistanceA) !== 0) {
            farmButton = $('#am_widget_Farm a.farm_icon_a');
            maxDistance = maxDistanceA;
            removeUnitsFrom = farmA;
        } else if (butBBoo && $('#am_widget_Farm a.farm_icon_b').length > 0 && parseInt(maxDistanceB) !== 0) {
            farmButton = $('#am_widget_Farm a.farm_icon_b');
            maxDistance = maxDistanceB;
            removeUnitsFrom = farmB;
        } else {
            farmButton = $('#am_widget_Farm a.farm_icon_c');
            maxDistance = maxDistanceC;
        }
    }

    $("#start-stop").click(function () {
        if (stop) {
            this.innerText = "Zastavit bota";
            stop = false;
            localStorage.stop = "";
            console.log("%c[Bot] Spuštěno", "color: blue");
            checkUnits();
            startFarming();
        } else {
            this.innerText = "Spustit bota";
            stop = true;
            localStorage.stop = "true";
            console.log("%c[Bot] Zastaveno", "color: orange");
        }
    });

    function removeUnits(farm) {
        for (let unit in farm) {
            if (unitInVill[unit] !== undefined) unitInVill[unit] -= farm[unit];
        }
        checkUnits();
    }

    // Handlery pro OK tlačítka v češtině
    $("#buttonDistA").click(function () {
        maxDistanceA = parseInt($("#distInputA").val());
        localStorage.maxDistanceA = maxDistanceA;
        $("#textA").html(maxDistanceA === 0 ? " A vypnuto" : " Nastaveno: " + maxDistanceA);
    });

    $("#buttonDistB").click(function () {
        maxDistanceB = parseInt($("#distInputB").val());
        localStorage.maxDistanceB = maxDistanceB;
        $("#textB").html(maxDistanceB === 0 ? " B vypnuto" : " Nastaveno: " + maxDistanceB);
    });

    $("#speedOk").click(function () {
        speed = parseInt($("#speed").val());
        localStorage.speed = speed;
        $("#textSpeed").html(" Nastaveno na " + speed + "ms");
    });

    function reload() {
        try {
            document.querySelector('.arrowRight').click();
        } catch (e) {
            window.location.reload();
        }
    }

    function clickOnKeyPress(key, selector) {
        if (event.keyCode === key) {
            document.querySelector(selector).click();
            event.preventDefault();
        }
    }

    setTimeout(function () {
        if (parseInt(switchSpeed) !== 0 && !stop) {
            reload();
        }
    }, switchSpeed * 1000);

})({
    loadModule: moduleName => {
        return new Promise((resolve, reject) => {
            const moduleUrl = `https://raw.githubusercontent.com/joaovperin/TribalWars/master/Modules/${moduleName.replace('.', '/')}.js`;
            return $.ajax({ method: "GET", url: moduleUrl, dataType: "text" })
                .done(res => resolve(eval(res)))
                .fail(() => reject(console.error("Chyba modulu: " + moduleName)));
        });
    }
});
