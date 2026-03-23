javascript:(function () {
    if (!document.URL.match("mode=incomings&subtype=attacks")) {
        self.location = game_data.link_base_pure.replace(/screen\=\w*/i, "screen=overview_villages&mode=incomings&subtype=attacks");
        return;
    }

    $("#incomings_table").find("tr").eq(0).find("th").last().after('<th>Watchtower</th>');

    var url = "https://" + location.host + game_data.link_base_pure + "overview_villages&mode=buildings&group=0&page=-1";
    var url2 = "https://" + location.host + "/interface.php?func=get_unit_info";

    var towerCoords = [];
    var towerLevels = [];
    var unitSpeed = [];
    var timesRun = 1;

    // Počet příchozích útoků
    var rows = Number($("#incomings_table").find("th").first().text().split(" ")[1].replace("(", "").replace(")", ""));

    // Mapování úrovně wachtovny na poloměr detekce
    var levelToRadius = {
        1: 1.1, 2: 1.3, 3: 1.5, 4: 1.7, 5: 2.0,
        6: 2.3, 7: 2.6, 8: 3.0, 9: 3.4, 10: 3.9,
        11: 4.4, 12: 5.1, 13: 5.8, 14: 6.7, 15: 7.6,
        16: 8.7, 17: 10.0, 18: 11.5, 19: 13.1, 20: 15.0
    };

    // Detekce jednotky dle názvu příkazu – podporuje CZ, SK i EN servery
    function getUnitIndex(commandName) {
        var name = commandName.toLowerCase();
        // Sword / Mečíř / Kopijník
        if (name.includes("me\u010d") || name.includes("sword") || name.includes("spear")) return 0;
        // Axe / Sekera
        if (name.includes("sekera") || name.includes("axe")) return 1;
        // Scout / Špeh
        if (name.includes("\u0161peh") || name.includes("scout") || name.includes("spy")) return 2;
        // Light cavalry / LK
        if (name.includes("lk") || name.includes("light")) return 3;
        // Heavy cavalry / TK
        if (name.includes("tk") || name.includes("heavy")) return 4;
        // Ram / Beranidlo / Katapult
        if (name.includes("beranidlo") || name.includes("ram") || name.includes("cat")) return 5;
        // Nobleman / Šlechta / Snob
        if (name.includes("\u0161lechta") || name.includes("snob") || name.includes("noble")) return 6;
        return -1;
    }

    // Výpočet průsečíků přímky a kružnice
    function findCircleLineIntersections(r, h, k, m, isVertical, vertX) {
        var points = [];
        if (isVertical) {
            // Svislá přímka: x = vertX
            var dx = vertX - h;
            var discriminant = r * r - dx * dx;
            if (discriminant < 0) return points;
            var sqrtD = Math.sqrt(discriminant);
            points.push(vertX + "|" + (k + sqrtD));
            if (discriminant > 0) points.push(vertX + "|" + (k - sqrtD));
        } else {
            // y = m*x + n  → n je y-intercept
            var n = k - m * h; // přepočítáme n relativně ke středu kružnice
            // Správný výpočet: (x-h)^2 + (mx+b-k)^2 = r^2, kde b je y-intercept přímky
            // Přímka: y = m*x + lineN (lineN je globální y-intercept předané jako parametr)
            // Volán jinak – viz níže
        }
        return points;
    }

    // Správná funkce průsečíku přímky y = m*x + lineN s kružnicí (h,k,r)
    function intersectLineCircle(r, h, k, m, lineN) {
        var points = [];
        var a = 1 + m * m;
        var b = -2 * h + 2 * m * (lineN - k);
        var c = h * h + (lineN - k) * (lineN - k) - r * r;
        var d = b * b - 4 * a * c;
        if (d < 0) return points;
        var x1 = (-b + Math.sqrt(d)) / (2 * a);
        var x2 = (-b - Math.sqrt(d)) / (2 * a);
        points.push(x1 + "|" + (m * x1 + lineN));
        if (d > 0) points.push(x2 + "|" + (m * x2 + lineN));
        return points;
    }

    // Průsečík svislé přímky x = vertX s kružnicí (h,k,r)
    function intersectVerticalCircle(r, h, k, vertX) {
        var points = [];
        var dx = vertX - h;
        var d = r * r - dx * dx;
        if (d < 0) return points;
        var sqrtD = Math.sqrt(d);
        points.push(vertX + "|" + (k + sqrtD));
        if (d > 0) points.push(vertX + "|" + (k - sqrtD));
        return points;
    }

    function loadData(callback) {
        $.ajax({
            url: url2,
            async: false,
            success: function (data) {
                $.each(["sword", "axe", "spy", "light", "heavy", "ram", "snob"], function (key, val) {
                    unitSpeed.push(Number($(data).find("config > " + val + " > speed").text()) * 60);
                });
            }
        });

        $.ajax({
            url: url,
            async: false,
            success: function (datas) {
                $(datas).find("#villages").find("tr").each(function (key, val) {
                    var levelText = $(val).find(".upgrade_building.b_watchtower").text();
                    var level = Number(levelText);
                    if (level > 0 && levelToRadius[level]) {
                        var coordMatch = $(val).find(".quickedit-label").text().match(/\d+\|\d+/);
                        if (coordMatch) {
                            towerCoords.push(coordMatch[0]);
                            towerLevels.push(levelToRadius[level]);
                        }
                    }
                });

                if (towerCoords.length === 0) {
                    UI.ErrorMessage("Žádná z tvých vesnic nemá wachtovnu!", 5000);
                    return;
                }

                callback();
            }
        });
    }

    function doStuff() {
        if (timesRun >= rows + 1) return;

        var row = $("#incomings_table").find("tr").eq(timesRun);

        // Přidej buňku do řádku
        row.find("td").last().after("<td></td>");

        var commandName = row.find("td").eq(0).text().trim();
        var unitIdx = getUnitIndex(commandName);

        if (unitIdx === -1) {
            row.find("td").last().text("Neznámá jednotka").css({ "font-weight": "bold", "color": "gray" });
            timesRun++;
            setTimeout(doStuff, 0);
            return;
        }

        var distance = Number(row.find("td").eq(4).text().trim());
        var destination = row.find("td").eq(1).text().match(/\d+\|\d+/)[0];
        var origin = row.find("td").eq(2).text().match(/\d+\|\d+/)[0];

        var hms = row.find("td").eq(6).text().split(':');
        var totalSeconds = (+hms[0]) * 3600 + (+hms[1]) * 60 + (+hms[2]);

        var remainingFields = totalSeconds / unitSpeed[unitIdx];

        var target = destination.split("|").map(Number);
        var source = origin.split("|").map(Number);

        var dx = target[0] - source[0];
        var dy = target[1] - source[1];
        var isVertical = (dx === 0);
        var m = isVertical ? 0 : dy / dx;
        var lineN = isVertical ? 0 : (source[1] - m * source[0]);

        // Najdi všechny průsečíky trasy s wachtovnami
        var intersectionPoints = [];
        for (var i = 0; i < towerCoords.length; i++) {
            var tc = towerCoords[i].split("|").map(Number);
            var h = tc[0], k = tc[1], r = towerLevels[i];
            var pts;
            if (isVertical) {
                pts = intersectVerticalCircle(r, h, k, source[0]);
            } else {
                pts = intersectLineCircle(r, h, k, m, lineN);
            }
            intersectionPoints = intersectionPoints.concat(pts);
        }

        if (intersectionPoints.length === 0) {
            row.find("td").last().text("Neodhalitelný").css({ "font-weight": "bold", "color": "red" });
            timesRun++;
            setTimeout(doStuff, 0);
            return;
        }

        // Najdi průsečík nejbližší k vesnici původu
        var block = intersectionPoints.map(function (pt) {
            var coords = pt.split("|").map(Number);
            return Math.sqrt(Math.pow(coords[0] - source[0], 2) + Math.pow(coords[1] - source[1], 2));
        });

        var idx = block.indexOf(Math.min.apply(null, block));
        var nearest = intersectionPoints[idx].split("|").map(Number);

        var currentDistance = distance - remainingFields;
        var distanceToEntry = Math.sqrt(Math.pow(nearest[0] - source[0], 2) + Math.pow(nearest[1] - source[1], 2));
        var remaining = distanceToEntry - currentDistance;
        var sec = remaining * unitSpeed[unitIdx];

        var currentRow = timesRun;
        var myTimer = setInterval(function () {
            sec--;
            if (sec <= 0) {
                clearInterval(myTimer);
                row.find("td").last().text("Odhaleno").css({ "font-weight": "bold", "color": "green" });
            } else {
                var s = Math.floor(sec % 60);
                var min = Math.floor((sec / 60) % 60);
                var hr = Math.floor(sec / 3600);
                var time = (hr < 10 ? "0" + hr : hr) + ":" + (min < 10 ? "0" + min : min) + ":" + (s < 10 ? "0" + s : s);
                row.find("td").last().text(time).css("font-weight", "bold");
            }
        }, 1000);

        timesRun++;
        setTimeout(doStuff, 0);
    }

    loadData(function () {
        doStuff();
    });

    void(0);
})();
