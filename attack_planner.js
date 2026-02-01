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
    } catch(e) { console.log("Notify module skipped."); }

    const CommandSender = {
        confirmButton: null,
        duration: null,
        internetDelay: null,
        sent: false,
        init: function () {
            // Přidání UI do tabulky
            $($('#command-data-form').find('tbody')[0]).append(
                `<tr>
                    <td>Chegada:</td><td><input type="datetime-local" id="ACStime" step=".001"></td>
                 </tr>
                 <tr>
                    <td>Delay da internet:</td>
                    <td><input type="number" id="ACSInternetDelay"><button type="button" id="ACSbutton" class="btn">Confirm</button></td>
                 </tr>`
            );

            this.confirmButton = $('#troop_confirm_submit');
            
            // OPRAVA: Detekce textu pro CZ i PT verzi
            const durationRow = $('#command-data-form').find('td:contains("Doba trvání"), td:contains("Duração:")').next();
            this.duration = durationRow.text().split(':').map(Number);
            
            this.internetDelay = localStorage.getItem('ACS.internetDelay') || defaultInternetDelay;
            
            // Nastavení výchozího času (nyní + 10s)
            let d = new Date();
            d.setSeconds(d.getSeconds() + 10);
            $('#ACStime').val(this.convertToInput(d));
            $('#ACSInternetDelay').val(this.internetDelay);

            $('#ACSbutton').click(() => {
                this.executeLogic();
            });
        },

        executeLogic: function () {
            const attackTime = this.getAttackTime();
            this.internetDelay = parseInt($('#ACSInternetDelay').val());
            localStorage.setItem('ACS.internetDelay', this.internetDelay);
            
            this.confirmButton.addClass('btn-disabled');
            
            const timeToWait = (attackTime - Timing.getCurrentServerTime()) - loopStartTime;
            
            setTimeout(() => {
                this.startLoop(attackTime);
            }, timeToWait);
            
            $('#ACSbutton').text('Čekám...').prop('disabled', true);
        },

        startLoop: function (attackTime) {
            const targetMs = attackTime.getMilliseconds();
            const targetSec = attackTime.getSeconds();

            const blob = new Blob([`setInterval(() => postMessage(''), 1);`]);
            const worker = new Worker(window.URL.createObjectURL(blob));

            worker.onmessage = () => {
                const realOffset = parseInt(this.internetDelay) - worldBackwardDelay;
                const now = new Date(Timing.getCurrentServerTime() + realOffset);

                if (now.getSeconds() >= targetSec || now.getMinutes() > attackTime.getMinutes()) {
                    if (now.getMilliseconds() >= targetMs) {
                        if (!this.sent) {
                            this.sent = true;
                            this.confirmButton.click();
                            worker.terminate();
                        }
                    }
                }
            };
        },

        getAttackTime: function () {
            const val = $('#ACStime').val().replace('T', ' ');
            const d = new Date(val);
            d.setHours(d.getHours() - this.duration[0]);
            d.setMinutes(d.getMinutes() - this.duration[1]);
            d.setSeconds(d.getSeconds() - this.duration[2]);
            return d;
        },

        convertToInput: function (t) {
            t.setHours(t.getHours() + this.duration[0]);
            t.setMinutes(t.getMinutes() + this.duration[1]);
            t.setSeconds(t.getSeconds() + this.duration[2]);
            return t.toISOString().slice(0, 23);
        }
    };

    const _temporaryLoop = setInterval(() => {
        if (document.getElementById('command-data-form') && typeof jQuery !== 'undefined') {
            CommandSender.init();
            clearInterval(_temporaryLoop);
        }
    }, 100);

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
