// ==UserScript==
// @name                 Advanced Command Scheduler - Ghost Mode
// @version              0.22
// @description          Server Time Sync Display with Set Day & Time button and Blood-Red Style.
// @author               TheBrain🧠
// @include              https://**.tribalwars.*/game.php?**&screen=place*&try=confirm*
// ==/UserScript==

(async (ModuleLoader) => {
    'use strict';

    //****************************** Configuration ******************************//
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
        countdownInterval: null,

        init: function () {
            if ($('#ACSMainContainer').length > 0 || this.initialized) return;
            this.initialized = true;

            const formTable = $('#command-data-form').find('tbody')[0];
            if (!formTable) return;

            $(formTable).append(
                `<tr class="acs-row-blood">
                    <td colspan="2" style="text-align:center;">
                        <button type="button" id="ACSToggleBtn" class="btn btn-blood" style="width:100%;">Open Attack Planner</button>
                        
                        <div id="ACSMainContainer" style="display:none; margin-top: 10px; border-top: 1px solid #4a0000; padding-top: 10px;">
                            <table style="width:100%;">
                                <tr>
                                    <td style="color: #ff4d4d; font-weight: bold; width: 30%;">Target Arrival:</td>
                                    <td style="display: flex; gap: 5px;">
                                        <input type="datetime-local" id="ACStime" step=".001" class="blood-input" style="flex-grow: 1;">
                                        <button type="button" id="ACSSetTimeBtn" class="btn btn-blood-bright">SET DAY & TIME</button>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="color: #ff4d4d; font-weight: bold;">Network Correction (ms):</td>
                                    <td><input type="number" id="ACSInternetDelay" class="blood-input"></td>
                                </tr>
                            </table>
                            
                            <button type="button" id="ACSbutton" class="btn btn-blood" style="margin-top:10px; width:100%;">Confirm Ghost Mode</button>
                            
                            <div id="ACSCountdownContainer" style="display:none; margin-top: 10px; padding: 10px; border: 1px dashed #ff0000; background: #1a0000;">
                                <div id="ACSCountdown" style="color: #ff0000; font-family: monospace; font-size: 14pt; font-weight: bold; text-align: center;">00:00:00.000</div>
                                <div id="ACSTargetDisplay" style="color: #8a0303; font-size: 8pt; text-align: center; margin-top: 3px;">Sending at: --:--:-- (Server Time)</div>
                            </div>

                            <div style="font-size: 9pt; color: #8a0303; margin-top: 10px; text-align: right; font-weight: bold; text-shadow: 1px 1px 1px #000;">
                                Powered by TheBrain 🧠
                            </div>
                        </div>
                    </td>
                 </tr>`
            );

            this.confirmButton = $('#troop_confirm_submit');
            const durationRow = $('#command-data-form').find('td:contains("Trvání:"), td:contains("Doba trvání"), td:contains("Duração:"), td:contains("Duration:")').next();
            this.duration = durationRow.text().trim().split(':').map(Number);
            this.internetDelay = localStorage.getItem('ACS.internetDelay') || defaultInternetDelay;
            
            $('#ACSInternetDelay').val(this.internetDelay);
            let d = new Date(Timing.getCurrentServerTime());
            d.setSeconds(d.getSeconds() + 10);
            $('#ACStime').val(this.convertToInput(d));

            this.preventVisibilityDetection();

            $('#ACSSetTimeBtn').click(() => {
                document.getElementById('ACStime').showPicker();
            });

            $('#ACSToggleBtn').click(() => {
                $('#ACSMainContainer').toggle();
                const isVisible = $('#ACSMainContainer').is(':visible');
                $('#ACSToggleBtn').text(isVisible ? 'Close Attack Planner' : 'Open Attack Planner');
            });

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
            if (isNaN(attackTime.getTime())) return;

            this.internetDelay = parseInt($('#ACSInternetDelay').val());
            localStorage.setItem('ACS.internetDelay', this.internetDelay);
            
            const ghostJitter = Math.floor(Math.random() * (jitterRange * 2 + 1)) - jitterRange;
            const finalDelay = this.internetDelay + ghostJitter;

            this.confirmButton.addClass('btn-disabled');
            $('#ACSbutton').text('GHOST ACTIVE').addClass('btn-active-blood').prop('disabled', true);
            
            $('#ACSCountdownContainer').show();
            
            // Synchronizace zobrazení s časem serveru
            const serverDate = new Date(attackTime.getTime());
            const dateStr = serverDate.getFullYear() + '-' + 
                           String(serverDate.getMonth() + 1).padStart(2, '0') + '-' + 
                           String(serverDate.getDate()).padStart(2, '0');
            const timeStr = String(serverDate.getHours()).padStart(2, '0') + ':' + 
                           String(serverDate.getMinutes()).padStart(2, '0') + ':' + 
                           String(serverDate.getSeconds()).padStart(2, '0');
            const msStr = String(serverDate.getMilliseconds()).padStart(3, '0');
            
            $('#ACSTargetDisplay').text(`Sending at: ${dateStr} ${timeStr}.${msStr} (Server Time)`);
            
            this.startCountdown(attackTime);

            const timeToWait = (attackTime - Timing.getCurrentServerTime()) - loopStartTime;

            setTimeout(() => {
                this.simulateHumanBehavior();
            }, Math.max(0, (attackTime - Timing.getCurrentServerTime()) - 3000));

            setTimeout(() => {
                this.startLoop(attackTime, finalDelay);
            }, timeToWait);
        },

        startCountdown: function(target) {
            this.countdownInterval = setInterval(() => {
                const now = Timing.getCurrentServerTime();
                const diff = target - now;

                if (diff <= 0) {
                    if (!this.sent) $('#ACSCountdown').text("00:00:00.000");
                    clearInterval(this.countdownInterval);
                    return;
                }

                const hours = Math.floor(diff / 3600000);
                const minutes = Math.floor((diff % 3600000) / 60000);
                const seconds = Math.floor((diff % 60000) / 1000);
                const ms = Math.floor(diff % 1000);

                $('#ACSCountdown').text(
                    `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
                );
            }, 50);
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
                        clearInterval(this.countdownInterval);
                    }
                }
            };
        },

        executeSend: function () {
            const btn = this.confirmButton[0];
            ['mousedown', 'mouseup', 'click'].forEach(type => {
                btn.dispatchEvent(new MouseEvent(type, { view: window, bubbles: true, cancelable: true, detail: 1 }));
            });
            $('#ACSCountdown').text("!BAZINGA!").addClass('bazinga-final');
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
        },

        addGlobalStyle: function (css) {
            var head = document.getElementsByTagName('head')[0];
            if (!head) return;
            var style = document.createElement('style');
            style.type = 'text/css';
            style.innerHTML = css;
            head.appendChild(style);
        }
    };

    CommandSender.addGlobalStyle(`
        .blood-input { background: #2b0000 !important; color: #ff4d4d !important; border: 1px solid #8a0303 !important; font-family: Verdana,Arial; padding: 2px; width: 100%; }
        .btn-blood { background: linear-gradient(to bottom, #8a0303 0%, #4a0000 100%) !important; color: white !important; border: 1px solid #330000 !important; cursor: pointer; padding: 6px 12px; font-weight: bold; border-radius: 3px; }
        .btn-blood-bright { background: #ff0000 !important; color: white !important; border: 1px solid #ffffff !important; cursor: pointer; padding: 4px 8px; font-weight: bold; border-radius: 3px; white-space: nowrap; font-size: 8pt; }
        .btn-blood:hover, .btn-blood-bright:hover { background: #660000 !important; box-shadow: 0 0 5px #ff0000; }
        .btn-active-blood { background: #1a0000 !important; color: #8a0303 !important; border: 1px solid #4a0000 !important; }
        .bazinga-final { color: #ccff00 !important; animation: bazinga-blink 0.4s infinite alternate; text-shadow: 0 0 10px #99ff00; }
        @keyframes bazinga-blink { from { color: #ccff00; } to { color: #ffff00; } }
    `);

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
