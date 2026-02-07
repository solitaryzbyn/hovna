// ==UserScript==
// @name                 Advanced Command Scheduler - Fixed Base
// @version              0.1
// @description          Opravená základní verze pro české servery.
// @author               TheBrain
// @include              https://**.tribalwars.*/game.php?**&screen=place*&try=confirm*
// ==/UserScript==

(async (ModuleLoader) => {
    'use strict';

    //****************************** Konfigurace ******************************//
    const defaultInternetDelay = 30;
    const worldBackwardDelay = 50;
    const loopStartTime = 1800; 
    const jitterRange = 12;     
    //*************************************************************************//

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

            // Ghost UI 
            $(formTable).append(
                `<tr class="acs-row">
                    <td>Čas dorazu (Ghost):</td><td><input type="datetime-local" id="ACStime" step=".001" style="background: #f4e4bc; border: 1px solid #7d510f;"></td>
                 </tr>
                 <tr class="acs-row">
                    <td>Korekce sítě (ms):</td>
                    <td>
                        <input type="number" id="ACSInternetDelay">
                        <button type="button" id="ACSbutton" class="btn btn-confirm-ghost">Confirm Ghost Mode</button>
                        <div style="font-size: 8pt; color: #7d510f; margin-top: 5px; text-align: right; font-style: italic;">Powered by <b>TheBrain</b></div>
                    </td>
                 </tr>`
            );

            this.confirmButton = $('#troop_confirm_submit');
            
            const durationRow = $('#command-data-form').find('td:contains("Trvání:"), td:contains("Doba trvání"), td:contains("Duração:")').next();
            const durationText = durationRow.text().trim();
            
            if (!durationText) {
                console.error("KRITICKÁ CHYBA: Nepodařilo se najít dobu trvání.");
                return;
            }

            this.duration = durationText.split(':').map(Number);
            this.internetDelay = localStorage.getItem('ACS.internetDelay') || defaultInternetDelay;
            
            $('#ACSInternetDelay').val(this.internetDelay);
            
            let d = new Date();
            d.setSeconds(d.getSeconds() + 10);
            $('#ACStime').val(this.convertToInput(d));

            this.preventVisibilityDetection();

            $('#ACSbutton').click((e) => {
                e.preventDefault();
                this.executeLogic();
            });
        },

        preventVisibilityDetection: function() {
            Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
            Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
            window.addEventListener('blur', (e) => e.stopImmediatePropagation(), true);
            window.addEventListener('visibilitychange', (e) => e.stopImmediatePropagation(), true);
        },

        executeLogic: function () {
            const attackTime = this.getAttackTime();
            if (isNaN(attackTime.getTime())) {
                alert("Neplatný formát času!");
                return;
            }

            this.internetDelay = parseInt($('#ACSInternetDelay').val());
            localStorage.setItem('ACS.internetDelay', this.internetDelay);
            
            const ghostJitter = Math.floor(Math.random() * (jitterRange * 2 + 1)) - jitterRange;
            const finalDelay = this.internetDelay + ghostJitter;

            this.confirmButton.addClass('btn-disabled');
            $('#ACSbutton').text('GHOST ARMED').css('background', '#444').prop('disabled', true);
            
            const timeToWait = (attackTime - Timing.getCurrentServerTime()) - loopStartTime;
            
            console.log(`%c [GHOST] Naplánováno (TheBrain Edition). Jitter: ${ghostJitter}ms`, 'color: #00ff00; font-weight: bold;');

            setTimeout(() => {
                this.simulateHumanBehavior();
            }, Math.max(0, (attackTime - Timing.getCurrentServerTime()) - 3000));

            setTimeout(() => {
                this.startLoop(attackTime, finalDelay);
            }, timeToWait);
        },

        simulateHumanBehavior: function() {
            const btn = this.confirmButton[0];
            const rect = btn.getBoundingClientRect();
            const x = rect.left + (rect.width / 2) + (Math.random() * 10 - 5);
            const y = rect.top + (rect.height / 2) + (Math.random() * 10 - 5);
            btn.dispatchEvent(new MouseEvent('mouseover', { clientX: x, clientY: y, bubbles: true }));
        },

        startLoop: function (attackTime, delay) {
            const targetMs = attackTime.getMilliseconds();
            const targetSec = attackTime.getSeconds();

            const blob = new Blob([`setInterval(() => postMessage(''), ${0.7 + Math.random() * 0.5});`]);
            const worker = new Worker(window.URL.createObjectURL(blob));

            worker.onmessage = () => {
                if (this.sent) return;
                const realOffset = delay - worldBackwardDelay;
                const now = new Date(Timing.getCurrentServerTime() + realOffset);

                if (now.getSeconds() >= targetSec || now.getMinutes() > attackTime.getMinutes()) {
                    if (now.getMilliseconds() >= targetMs) {
                        this.sent = true;
                        this.executeSend();
                        worker.terminate();
                    }
                }
            };
        },

        executeSend: function () {
            const btn = this.confirmButton[0];
            ['mousedown', 'mouseup', 'click'].forEach(type => {
                btn.dispatchEvent(new MouseEvent(type, {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    detail: 1
                }));
            });
            console.log('%c [GHOST] Příkaz odeslán pod dohledem TheBrain.', 'color: #00ffff; font-weight: bold;');
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
