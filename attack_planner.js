// ==UserScript==
// @name                 Advanced Command Scheduler - Fixed Base
// @version              0.1
// @description          Opravená základní verze pro české servery.
// @author               TheBrain
// @include              https://**.tribalwars.*/game.php?**&screen=place*&try=confirm*
// ==/UserScript==

(async (ModuleLoader) => {
    'use strict';

    const defaultInternetDelay = 30;
    const worldBackwardDelay = 50;
    const loopStartTime = 1500;

    try {
        await ModuleLoader.loadModule('utils/notify-utils');
    } catch(e) { console.debug("Notify module skipped."); }

    const CommandSender = {
        confirmButton: null,
        duration: null,
        internetDelay: null,
        sent: false,
        initialized: false,

        init: function () {
            if ($('#ACStime').length > 0 || this.initialized) return;
            this.initialized = true;

            const formTable = $('#command-data-form').find('tbody')[0];
            if (!formTable) return;

            $(formTable).append(
                `<tr class="acs-row">
                    <td>Čas dorazu:</td><td><input type="datetime-local" id="ACStime" step=".001"></td>
                 </tr>
                 <tr class="acs-row">
                    <td>Internet Delay:</td>
                    <td><input type="number" id="ACSInternetDelay"><button type="button" id="ACSbutton" class="btn">Confirm Plan</button></td>
                 </tr>`
            );

            this.confirmButton = $('#troop_confirm_submit');
            
            // OPRAVA SELEKTORU: Přidáno "Trvání:" pro český server
            const durationRow = $('#command-data-form').find('td:contains("Trvání:"), td:contains("Doba trvání"), td:contains("Duração:")').next();
            const durationText = durationRow.text().trim();
            
            if (!durationText) {
                console.error("KRITICKÁ CHYBA: Nepodařilo se najít dobu trvání útoku v tabulce.");
                return;
            }

            this.duration = durationText.split(':').map(Number);
            this.internetDelay = localStorage.getItem('ACS.internetDelay') || defaultInternetDelay;
            
            $('#ACSInternetDelay').val(this.internetDelay);
            
            let d = new Date();
            d.setSeconds(d.getSeconds() + 10);
            $('#ACStime').val(this.convertToInput(d));

            $('#ACSbutton').click((e) => {
                e.preventDefault();
                console.log("Tlačítko stisknuto, spouštím logiku...");
                this.executeLogic();
            });
        },

        executeLogic: function () {
            const attackTime = this.getAttackTime();
            if (isNaN(attackTime.getTime())) {
                alert("Neplatný formát času!");
                return;
            }

            this.internetDelay = parseInt($('#ACSInternetDelay').val());
            localStorage.setItem('ACS.internetDelay', this.internetDelay);
            
            this.confirmButton.addClass('btn-disabled');
            $('#ACSbutton').text('NAPLÁNOVÁNO').css('background', '#218838').prop('disabled', true);
            
            const timeToWait = (attackTime - Timing.getCurrentServerTime()) - loopStartTime;
            
            console.log("Útok naplánován. Cílový čas odeslání:", attackTime.toISOString());
            console.log("Smyčka se spustí za (ms):", timeToWait);

            if (timeToWait < 0) {
                alert("CHYBA: Čas odeslání již vypršel! Nastavte čas v budoucnosti.");
                return;
            }

            setTimeout(() => {
                this.startLoop(attackTime);
            }, timeToWait);
        },

        startLoop: function (attackTime) {
            const targetMs = attackTime.getMilliseconds();
            const targetSec = attackTime.getSeconds();

            console.log("Vysokorychlostní smyčka spuštěna...");
            const blob = new Blob([`setInterval(() => postMessage(''), 1);`]);
            const worker = new Worker(window.URL.createObjectURL(blob));

            worker.onmessage = () => {
                if (this.sent) return;

                const realOffset = parseInt(this.internetDelay) - worldBackwardDelay;
                const now = new Date(Timing.getCurrentServerTime() + realOffset);

                if (now.getSeconds() >= targetSec || now.getMinutes() > attackTime.getMinutes()) {
                    if (now.getMilliseconds() >= targetMs) {
                        this.sent = true;
                        console.log("BUM! Klikám na tlačítko.");
                        this.confirmButton.click();
                        worker.terminate();
                    }
                }
            };
        },

        getAttackTime: function () {
            const val = $('#ACStime').val().replace('T', ' ');
            const d = new Date(val);
            d.setHours(d.getHours() - (this.duration[0] || 0));
            d.setMinutes(d.getMinutes() - (this.duration[1] || 0));
            d.setSeconds(d.getSeconds() - (this.duration[2] || 0));
            return d;
        },

        convertToInput: function (t) {
            const displayDate = new Date(t.getTime());
            displayDate.setHours(displayDate.getHours() + (this.duration[0] || 0));
            displayDate.setMinutes(displayDate.getMinutes() + (this.duration[1] || 0));
            displayDate.setSeconds(displayDate.getSeconds() + (this.duration[2] || 0));
            
            const tzoffset = displayDate.getTimezoneOffset() * 60000;
            return (new Date(displayDate - tzoffset)).toISOString().slice(0, -1);
        }
    };

    const _initCheck = setInterval(() => {
        if (document.getElementById('command-data-form') && typeof jQuery !== 'undefined') {
            CommandSender.init();
            clearInterval(_initCheck);
        }
    }, 500);

})({
    loadModule: moduleName => {
        return new Promise((resolve) => {
            const modulePath = moduleName.replace('.', '/');
            const moduleUrl = `https://raw.githubusercontent.com/joaovperin/TribalWars/master/Modules/${modulePath}.js`;
            $.ajax({ method: "GET", url: moduleUrl, dataType: "text" })
                .done(res => resolve(eval(res)))
                .fail(() => resolve(null));
        });
    }
});
