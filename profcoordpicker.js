// B4LD PH4NT0M (opravená verze)
if (window.location.href.indexOf('screen=info_player') < 0) {
    UI.ErrorMessage("You have to run this script on a player profile", 5000);
} else {
    // Bug fix #1: pingTime s robustnějším parsováním
    if (!pingTime) {
        var pingTime = parseInt(($("#serverTime").attr("title") || "").match(/\d+/)?.[0]) || 100;

        // Přidání CSS pouze jednou
        $("#ds_body").append(
            `<style>
        .atkBtn {
            padding: 3px 9px 3px 25px;
        }
        .atkBtn-self {
            background: url(https://dsen.innogamescdn.com/asset/59169c4a/graphic/command/attack.png) no-repeat 3px, linear-gradient(to bottom, #947a62 0%,#7b5c3d 22%,#6c4824 30%,#6c4824 100%);
        }
        .atkBtn-self:hover {
            background: url(https://dsen.innogamescdn.com/asset/59169c4a/graphic/command/attack.png) no-repeat 3px, linear-gradient(to bottom, #b69471 0%,#9f764d 22%,#8f6133 30%,#6c4d2d 100%);
        }
        .atkBtn-ally {
            background: url(https://dsen.innogamescdn.com/asset/59169c4a/graphic/command/attack_ally.png) no-repeat 3px, linear-gradient(to bottom, #947a62 0%,#7b5c3d 22%,#6c4824 30%,#6c4824 100%);
        }
        .atkBtn-ally:hover {
            background: url(https://dsen.innogamescdn.com/asset/59169c4a/graphic/command/attack_ally.png) no-repeat 3px, linear-gradient(to bottom, #b69471 0%,#9f764d 22%,#8f6133 30%,#6c4d2d 100%);
        }
        </style>`);
    }

    if (!loadedCheck) {
        var loadedCheck = typeof $("table#villages_list tr:last").eq(0).find('a')[0]?.onclick === 'function';
        const playerID = (new URL(location.href)).searchParams.get('id');
        if (playerID) $("table#villages_list tr:last").eq(0).remove();
        const display_url = `/game.php?village=${(new URL(location.href)).searchParams.get('village')}&screen=info_player&ajax=fetch_villages&player_id=${playerID || InfoPlayer.player_id}`;
        Player.getAllVillages(this, display_url);
    }

    setTimeout(() => {
        fetchCoords("");
    }, pingTime * 2);


    // Bug fix #2: fetchCoords jako lokální var místo globální přiřazení
    var fetchCoords = function(sortType) {
        const coords = getCoords(sortType);
        UI.AjaxPopup(null, "coordinates_not_under_attack", `
        <input class="btn" id="allCoords" type="button" value="All coordinates" />
        <input class="btn" id="fetchNoAttacks" type="button" value="No attacks" />
        <input class="btn atkBtn atkBtn-self" id="fetchNoOwnAttacks" type="button" value="Only no own attacks">
        <input class="btn atkBtn atkBtn-ally" id="fetchNoAllyAttacks" type="button" value="Only no ally attacks" />
        <h2>Found coordinates: <span id="coordCount">${coords[1]}</span></h2>
        <textarea rows="7" cols="50" id="coord_text_area">${coords[0]}</textarea>
        <br>
        <input class="btn btn-success" id="copy_to_clipboard" type="button" value="Copy to clipboard" />`,
        "Player coordinates", null, { dataType: "prerendered" }, 600, "auto");

        $("#coord_text_area").focus().select();

        // Bug fix #3: .off("click") před každým .on("click"), aby se předešlo duplikaci listenerů
        $("#copy_to_clipboard").off("click").on("click", () => {
            navigator.clipboard.writeText($("#coord_text_area").val());
            UI.InfoMessage("Coordinates copied");
        });

        $("#allCoords").off("click").on("click", () => {
            const newCoords = getCoords("");
            $("#coordCount").text(newCoords[1]);
            $("#coord_text_area").val(newCoords[0]).focus().select();
        });

        $("#fetchNoAttacks").off("click").on("click", () => {
            const newCoords = getCoords("span.command-attack-ally,span.command-attack");
            $("#coordCount").text(newCoords[1]);
            $("#coord_text_area").val(newCoords[0]).focus().select();
        });

        $("#fetchNoOwnAttacks").off("click").on("click", () => {
            const newCoords = getCoords("span.command-attack");
            $("#coordCount").text(newCoords[1]);
            $("#coord_text_area").val(newCoords[0]).focus().select();
        });

        $("#fetchNoAllyAttacks").off("click").on("click", () => {
            const newCoords = getCoords("span.command-attack-ally");
            $("#coordCount").text(newCoords[1]);
            $("#coord_text_area").val(newCoords[0]).focus().select();
        });
    };

    // Bug fix #4: prázdný sortType nesmí generovat :not(:has()) se špatným selektorem
    var getCoords = function(sortType) {
        let coords = "";
        // Pokud sortType je prázdný string, vrátíme všechny řádky bez filtru
        const rows = sortType
            ? $(`table#villages_list > tbody > tr:not(:has(${sortType}))`)
            : $(`table#villages_list > tbody > tr`);

        [...rows].forEach(row => {
            coords += $(row).find('>td:nth-last-child(2)').text().trim() + " ";
        });

        return [coords.trim(), rows.length];
    };
}
