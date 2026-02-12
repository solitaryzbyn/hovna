(function() {
    'use strict';

    // Odstraněna závislost na TwFramework a notify-utils (nepovinné pro funkčnost)
    let buildingObject;
    let selection;
    let scriptStatus = false;
    let isBuilding = false;

    class BQueue {
        constructor(bQueue, bQueueLength) {
            this.buildingQueue = bQueue;
            this.buildingQueueLength = bQueueLength;
        }
        add(building, display) {
            this.buildingQueue.push(building);
            if (display) {
                let ele = document.createElement("tr");
                ele.innerHTML = `<td>${building}</td><td class="delete-icon-large hint-toggle float_left"></td>`;
                ele.addEventListener("click", () => { this.removeBuilding(ele); });
                document.getElementById("autoBuilderTable").appendChild(ele);
            }
        }
        removeBuilding(ele) {
            this.buildingQueue.splice(ele.rowIndex - 3, 1);
            ele.remove();
            localStorage.buildingObject = JSON.stringify(buildingObject);
        }
    }

    // --- FUNKCE PROSTŘEDÍ (NÁHRADA ZA MODULY) ---
    function updateTitle(status) {
        document.title = status ? `(BUILDING) ${game_data.village.name}` : game_data.village.name;
    }

    function init() {
        const putEleBefore = document.getElementById("content_value");
        if (!putEleBefore) return;

        let newDiv = document.createElement("div");
        const selectBuildingHtml = "<td><select id=\"selectBuildingHtml\"> " +
            "<option value=\"main\">Headquarters</option> " +
            "<option value=\"barracks\">Barracks</option> " +
            "<option value=\"stable\">Stable</option> " +
            "<option value=\"garage\">Workshop</option> " +
            "<option value=\"watchtower\">Watchtower</option> " +
            "<option value=\"smith\">Smithy</option> " +
            "<option value=\"market\">Market</option> " +
            "<option value=\"wood\">Timber Camp</option> " +
            "<option value=\"stone\">Clay Pit</option> " +
            "<option value=\"iron\">Iron Mine</option> " +
            "<option value=\"farm\">Farm</option> " +
            "<option value=\"storage\">Warehouse</option> " +
            "<option value=\"hide\">Hiding Place</option> " +
            "<option value=\"wall\">Wall</option> " +
            "</select></td>";
            
        let newTable = `<table id="autoBuilderTable" class="vis">
        <tr><td><button id="startBuildingScript" class="btn">Start</button></td></tr>
        <tr><td>Queue length:</td><td><input id='queueLengthInput' style='width:30px'></td><td><button id='queueLengthBtn' class='btn'>OK</button></td><td><span id='queueText'></span></td></tr>
        <tr><td>Building</td>${selectBuildingHtml}<td><button id='addBuilding' class='btn'>Add</button></td></tr>
        </table>`;

        newDiv.innerHTML = newTable;
        putEleBefore.parentElement.parentElement.insertBefore(newDiv, putEleBefore.parentElement);

        selection = document.getElementById("selectBuildingHtml");
        let premiumBQueueLength = (window.game_data && game_data.features.Premium.active) ? 5 : 2;

        if (localStorage.buildingObject) {
            let storage = JSON.parse(localStorage.buildingObject);
            if (storage[game_data.village.id]) {
                let data = storage[game_data.village.id];
                buildingObject = new BQueue(data.buildingQueue, data.buildingQueueLength);
                document.getElementById("queueLengthInput").value = buildingObject.buildingQueueLength;
                buildingObject.buildingQueue.forEach((b) => { addBuildingRow(b); });
            } else {
                buildingObject = new BQueue([], premiumBQueueLength);
                storage[game_data.village.id] = buildingObject;
                localStorage.buildingObject = JSON.stringify(storage);
            }
        } else {
            buildingObject = new BQueue([], premiumBQueueLength);
            localStorage.buildingObject = JSON.stringify({ [game_data.village.id]: buildingObject });
        }

        eventListeners();

        if (localStorage.scriptStatus) {
            scriptStatus = JSON.parse(localStorage.scriptStatus);
            if (scriptStatus) {
                document.getElementById("startBuildingScript").innerText = "Stop";
                updateTitle(true);
                startScript();
            }
        }
    }

    function startScript() {
        setInterval(function () {
            if (!scriptStatus) return;
            
            // Instant free build
            let btn = document.querySelector(".btn-instant-free");
            if (btn && btn.style.display != "none") { btn.click(); }

            if (buildingObject.buildingQueue.length !== 0) {
                let building = buildingObject.buildingQueue[0];
                let wood = parseInt(document.getElementById("wood").textContent);
                let stone = parseInt(document.getElementById("stone").textContent);
                let iron = parseInt(document.getElementById("iron").textContent);
                
                let woodCost, stoneCost, ironCost;
                try {
                    let row = document.querySelector("#main_buildrow_" + building);
                    woodCost = parseInt(row.querySelector(".cost_wood").getAttribute("data-cost"));
                    stoneCost = parseInt(row.querySelector(".cost_stone").getAttribute("data-cost"));
                    ironCost = parseInt(row.querySelector(".cost_iron").getAttribute("data-cost"));
                } catch (e) { return; }

                let currentBuildLength = 0;
                if (document.getElementById("buildqueue")) {
                    currentBuildLength = document.getElementById("buildqueue").rows.length - 2;
                }

                if (currentBuildLength < buildingObject.buildingQueueLength && !isBuilding && wood >= woodCost && stone >= stoneCost && iron >= ironCost) {
                    isBuilding = true;
                    setTimeout(function () { buildBuilding(building); }, Math.floor(Math.random() * 500 + 1000));
                }
            }
        }, 1000);
    }

    function addBuildingRow(building) {
        let ele = document.createElement("tr");
        ele.innerHTML = `<td>${building}</td><td class="delete-icon-large hint-toggle float_left" style="cursor:pointer"></td>`;
        ele.querySelector(".delete-icon-large").addEventListener("click", function () { removeBuilding(ele); });
        document.getElementById("autoBuilderTable").appendChild(ele);
    }

    function removeBuilding(ele) {
        buildingObject.buildingQueue.splice(ele.rowIndex - 3, 1);
        let storage = JSON.parse(localStorage.buildingObject);
        storage[game_data.village.id] = buildingObject;
        localStorage.buildingObject = JSON.stringify(storage);
        ele.remove();
    }

    function buildBuilding(building) {
        let data = { "id": building, "force": 1, "destroy": 0, "source": game_data.village.id, "h": game_data.csrf };
        let url = `/game.php?village=${game_data.village.id}&screen=main&ajaxaction=upgrade_building&type=main&`;
        
        $.ajax({
            url: url, type: "post", data: data,
            headers: { "Accept": "application/json, text/javascript, */*; q=0.01", "TribalWars-Ajax": 1 }
        }).done(function (r) {
            let response = JSON.parse(r);
            if (response.response && response.response.success) {
                buildingObject.buildingQueue.splice(0, 1);
                let storage = JSON.parse(localStorage.buildingObject);
                storage[game_data.village.id] = buildingObject;
                localStorage.buildingObject = JSON.stringify(storage);
                setTimeout(() => { window.location.reload(); }, 500);
            }
        }).always(() => { isBuilding = false; });
    }

    function eventListeners() {
        document.getElementById("queueLengthBtn").addEventListener("click", function () {
            let qLength = parseInt(document.getElementById("queueLengthInput").value) || 2;
            buildingObject.buildingQueueLength = qLength;
            let storage = JSON.parse(localStorage.buildingObject);
            storage[game_data.village.id] = buildingObject;
            localStorage.buildingObject = JSON.stringify(storage);
            document.getElementById("queueText").innerText = " Saved: " + qLength;
        });

        document.getElementById("addBuilding").addEventListener("click", function () {
            let b = selection.value;
            buildingObject.buildingQueue.push(b);
            let storage = JSON.parse(localStorage.buildingObject);
            storage[game_data.village.id] = buildingObject;
            localStorage.buildingObject = JSON.stringify(storage);
            addBuildingRow(b);
        });

        document.getElementById("startBuildingScript").addEventListener("click", function () {
            scriptStatus = !scriptStatus;
            this.innerText = scriptStatus ? "Stop" : "Start";
            localStorage.scriptStatus = JSON.stringify(scriptStatus);
            updateTitle(scriptStatus);
            if (scriptStatus) startScript();
        });
    }

    init();
})();
