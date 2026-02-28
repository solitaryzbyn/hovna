// ==UserScript==
// @name                 Advanced Command Scheduler - Ghost Mode v2
// @version              0.30
// @description          Server Time Sync Display with 12h/24h format toggle, tooltips, attack history, and Blood-Red Style.
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
    const maxHistoryEntries = 5;
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
        use12h: false,
        sendTimestamp: null,

        init: function () {
            if ($('#ACSMainContainer').length > 0 || this.initialized) return;
            this.initialized = true;

            const formTable = $('#command-data-form').find('tbody')[0];
            if (!formTable) return;

            // Load 12h preference
            this.use12h = localStorage.getItem('ACS.use12h') === 'true';

            $(formTable).append(
                `<tr class="acs-row-blood">
                    <td colspan="2" style="padding: 0;">
                        <button type="button" id="ACSToggleBtn" class="btn btn-blood" 
                            style="width:100%; box-sizing: border-box; display: block; margin: 0;"
                            title="Otevře/zavře pokročilý plánovač útoků Ghost Mode">
                            Open Attack Planner
                        </button>

                        <div id="ACSMainContainer" style="display:none; border-top: 1px solid #4a0000; box-sizing: border-box; background: rgba(43, 0, 0, 0.1);">
                            <div style="padding: 10px 0;">
                                <table style="width:100%; border-spacing: 0 5px; border-collapse: separate;">

                                    <!-- Time format toggle row -->
                                    <tr>
                                        <td style="color: #ff4d4d; font-weight: bold; width: 35%; padding-left: 5px;" 
                                            title="Přepíná zobrazení času mezi 12h (AM/PM – obvyklé v USA) a 24h formátem (obvyklé v Evropě)">
                                            Time Format:
                                        </td>
                                        <td style="padding-right: 5px;">
                                            <div style="display: flex; align-items: center; gap: 8px;">
                                                <span id="ACSFormat24Label" style="color: #ff4d4d; font-weight: bold; font-size: 9pt;">24h</span>
                                                <label class="acs-toggle-switch" title="Přepnout mezi 24h (evropský standard) a 12h AM/PM (americký standard) formátem">
                                                    <input type="checkbox" id="ACSFormatToggle" ${this.use12h ? 'checked' : ''}>
                                                    <span class="acs-toggle-slider"></span>
                                                </label>
                                                <span id="ACSFormat12Label" style="color: #ff4d4d; font-weight: bold; font-size: 9pt;">12h (AM/PM)</span>
                                            </div>
                                        </td>
                                    </tr>

                                    <!-- Target arrival -->
                                    <tr>
                                        <td style="color: #ff4d4d; font-weight: bold; padding-left: 5px;" 
                                            title="Čas, kdy má útok DORAZIT do cílové vesnice. Script automaticky odečte dobu cestování vojsk.">
                                            Target Arrival:
                                        </td>
                                        <td style="padding-right: 5px;">
                                            <div style="display: flex; gap: 5px; width: 100%;">
                                                <input type="datetime-local" id="ACStime" step=".001" class="blood-input" 
                                                    style="flex: 1; min-width: 0;"
                                                    title="Zadej přesný datum a čas, kdy chceš aby útok dorazil do cíle">
                                                <button type="button" id="ACSSetTimeBtn" class="btn btn-blood-bright"
                                                    title="Otevře výběr datumu a času v prohlížeči">
                                                    SET DAY &amp; TIME
                                                </button>
                                            </div>
                                            <!-- Quick time offset buttons -->
                                            <div style="display:flex; gap:4px; margin-top: 4px;" id="ACSQuickButtons">
                                                <button type="button" class="acs-quick-btn" data-offset="3600" title="Přidat 1 hodinu k cílovému času">+1h</button>
                                                <button type="button" class="acs-quick-btn" data-offset="21600" title="Přidat 6 hodin k cílovému času">+6h</button>
                                                <button type="button" class="acs-quick-btn" data-offset="43200" title="Přidat 12 hodin k cílovému času">+12h</button>
                                                <button type="button" class="acs-quick-btn" data-offset="86400" title="Přidat 1 den k cílovému času">+1d</button>
                                                <button type="button" class="acs-quick-btn" data-offset="-3600" title="Odebrat 1 hodinu z cílového času" style="color:#ff8080;">-1h</button>
                                            </div>
                                        </td>
                                    </tr>

                                    <!-- Network delay -->
                                    <tr>
                                        <td style="color: #ff4d4d; font-weight: bold; padding-left: 5px;" 
                                            title="Kompenzace síťového zpoždění v milisekundách. Vyšší číslo = příkaz se odešle dříve. Doporučeno: 20-50ms pro rychlé připojení, 50-100ms pro pomalejší.">
                                            Network Correction:
                                        </td>
                                        <td style="padding-right: 5px;">
                                            <input type="number" id="ACSInternetDelay" class="blood-input" 
                                                style="width: 100%; box-sizing: border-box;"
                                                title="Síťová latence v ms. Ping zjistíš například na fast.com nebo speedtest.net">
                                        </td>
                                    </tr>

                                </table>
                            </div>

                            <!-- Warning display -->
                            <div id="ACSWarning" style="display:none; margin: 0 5px 5px 5px; padding: 5px 8px; background: #3a2000; border: 1px solid #ff8800; color: #ffaa00; font-size: 8pt; border-radius: 2px;"></div>

                            <button type="button" id="ACSbutton" class="btn btn-blood" 
                                style="width:100%; box-sizing: border-box; display: block; margin: 0;"
                                title="Aktivuje Ghost Mode – script automaticky odešle útok ve správný čas, i když je záložka na pozadí">
                                Confirm Ghost Mode
                            </button>

                            <div id="ACSCountdownContainer" style="display:none; box-sizing: border-box; border-top: 1px dashed #ff0000; border-bottom: 1px dashed #ff0000; background: #1a0000; width: 100%;">
                                <div style="padding: 10px;">
                                    <div id="ACSCountdown" style="color: #ff0000; font-family: monospace; font-size: 14pt; font-weight: bold; text-align: center;" 
                                        title="Odpočet do okamžiku odeslání útoku (čas odeslání = čas příchodu − doba cestování)">
                                        00:00:00.000
                                    </div>
                                    <div id="ACSTargetDisplay" style="color: #8a0303; font-size: 8pt; text-align: center; margin-top: 3px;" 
                                        title="Přesný serverový čas odeslání útoku">
                                        Sending at: --:--:-- (Server Time)
                                    </div>
                                    <div id="ACSSendAccuracy" style="display:none; color: #ffcc00; font-size: 8pt; text-align: center; margin-top: 3px;"
                                        title="Přesnost odeslání v milisekundách oproti ideálnímu cílovému času">
                                    </div>
                                </div>
                            </div>

                            <!-- Attack History -->
                            <div id="ACSHistoryContainer" style="display:none; border-top: 1px dashed #4a0000; padding: 5px;">
                                <div style="color: #8a0303; font-size: 8pt; font-weight: bold; margin-bottom: 3px;" 
                                    title="Posledních ${maxHistoryEntries} odeslaných útoků z tohoto scriptu">
                                    📋 Attack History:
                                </div>
                                <div id="ACSHistoryList" style="font-size: 7.5pt; font-family: monospace; color: #cc3333; max-height: 80px; overflow-y: auto;"></div>
                            </div>

                            <div style="padding: 5px 5px 10px 0; font-size: 9pt; color: #8a0303; text-align: right; font-weight: bold; text-shadow: 1px 1px 1px #000;">
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
            this.renderHistory();
            this.updateFormatLabels();

            // ---- Event Bindings ----

            $('#ACSFormatToggle').change(() => {
                this.use12h = $('#ACSFormatToggle').is(':checked');
                localStorage.setItem('ACS.use12h', this.use12h);
                this.updateFormatLabels();
            });

            $('#ACSSetTimeBtn').click(() => {
                document.getElementById('ACStime').showPicker();
            });

            $('#ACSToggleBtn').click(() => {
                $('#ACSMainContainer').toggle();
                const isVisible = $('#ACSMainContainer').is(':visible');
                $('#ACSToggleBtn').text(isVisible ? 'Close Attack Planner' : 'Open Attack Planner');
            });

            // Quick offset buttons
            $(document).on('click', '.acs-quick-btn', (e) => {
                const offset = parseInt($(e.target).data('offset'));
                const currentVal = $('#ACStime').val();
                if (!currentVal) return;
                const d = new Date(currentVal.replace('T', ' '));
                d.setSeconds(d.getSeconds() + offset);
                const tzoffset = d.getTimezoneOffset() * 60000;
                $('#ACStime').val((new Date(d - tzoffset)).toISOString().slice(0, -1));
            });

            // Validate on time change
            $('#ACStime').on('change input', () => this.validateTime());

            $('#ACSbutton').click((e) => {
                e.preventDefault();
                this.executeLogic();
            });
        },

        updateFormatLabels: function() {
            if (this.use12h) {
                $('#ACSFormat24Label').css('opacity', '0.4');
                $('#ACSFormat12Label').css('opacity', '1');
            } else {
                $('#ACSFormat24Label').css('opacity', '1');
                $('#ACSFormat12Label').css('opacity', '0.4');
            }
        },

        formatServerTime: function(date) {
            if (this.use12h) {
                let hours = date.getHours();
                const ampm = hours >= 12 ? 'PM' : 'AM';
                hours = hours % 12 || 12;
                return `${String(hours).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}.${String(date.getMilliseconds()).padStart(3, '0')} ${ampm}`;
            } else {
                return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}.${String(date.getMilliseconds()).padStart(3, '0')}`;
            }
        },

        validateTime: function() {
            const attackTime = this.getAttackTime();
            if (isNaN(attackTime.getTime())) return;
            const now = Timing.getCurrentServerTime();
            const diff = attackTime - now;
            const warning = $('#ACSWarning');

            if (diff < 0) {
                warning.text('⚠️ Čas odeslání je v minulosti! Uprav cílový čas příchodu.').show();
            } else if (diff < 5000) {
                warning.text('⚠️ Zbývá méně než 5 sekund – příliš brzy na bezpečné odeslání!').show();
            } else if (diff > 86400000 * 7) {
                warning.text('ℹ️ Čas je více než 7 dní dopředu – zkontroluj datum.').show();
            } else {
                warning.hide();
            }
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

            // Validate before proceeding
            const now = Timing.getCurrentServerTime();
            if (attackTime - now < 5000) {
                alert('Čas odeslání je příliš blízko nebo v minulosti!');
                return;
            }

            this.internetDelay = parseInt($('#ACSInternetDelay').val());
            localStorage.setItem('ACS.internetDelay', this.internetDelay);

            const ghostJitter = Math.floor(Math.random() * (jitterRange * 2 + 1)) - jitterRange;
            const finalDelay = this.internetDelay + ghostJitter;

            this.confirmButton.addClass('btn-disabled');
            $('#ACSbutton').text('GHOST ACTIVE').addClass('btn-active-blood').prop('disabled', true);

            $('#ACSCountdownContainer').show();
            $('#ACSSendAccuracy').hide();

            const serverDate = new Date(attackTime.getTime());
            const dateStr = serverDate.getFullYear() + '-' +
                           String(serverDate.getMonth() + 1).padStart(2, '0') + '-' +
                           String(serverDate.getDate()).padStart(2, '0');

            $('#ACSTargetDisplay').text(`Sending at: ${dateStr} ${this.formatServerTime(serverDate)} (Server Time)`);

            this.sendTimestamp = attackTime.getTime();
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
                        const actualSendTime = Timing.getCurrentServerTime();
                        this.executeSend();
                        worker.terminate();
                        clearInterval(this.countdownInterval);

                        // Show send accuracy
                        const accuracyMs = actualSendTime - this.sendTimestamp;
                        const sign = accuracyMs >= 0 ? '+' : '';
                        $('#ACSSendAccuracy').text(`Přesnost odeslání: ${sign}${accuracyMs}ms`).show();

                        // Save to history
                        this.saveHistory(new Date(attackTime.getTime()), accuracyMs);
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

        saveHistory: function(arrivalDate, accuracyMs) {
            let history = JSON.parse(localStorage.getItem('ACS.history') || '[]');
            const sign = accuracyMs >= 0 ? '+' : '';
            history.unshift({
                arrival: arrivalDate.toISOString(),
                accuracy: `${sign}${accuracyMs}ms`,
                ts: Date.now()
            });
            if (history.length > maxHistoryEntries) history = history.slice(0, maxHistoryEntries);
            localStorage.setItem('ACS.history', JSON.stringify(history));
            this.renderHistory();
        },

        renderHistory: function() {
            let history = JSON.parse(localStorage.getItem('ACS.history') || '[]');
            if (history.length === 0) return;

            $('#ACSHistoryContainer').show();
            const list = $('#ACSHistoryList');
            list.empty();

            history.forEach((entry, i) => {
                const d = new Date(entry.arrival);
                const dateStr = `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')} ${this.formatServerTime(d)}`;
                const color = entry.accuracy.includes('-') ? '#ff8888' :
                              parseInt(entry.accuracy) <= 10 ? '#88ff88' : '#ffcc44';
                list.append(`<div style="color:${color}; border-bottom: 1px solid #2a0000; padding: 1px 0;" 
                    title="Útok č.${i+1}: Cílový příchod ${dateStr}, přesnost odeslání ${entry.accuracy}">
                    #${i+1} → ${dateStr} <span style="color:${color}">(${entry.accuracy})</span>
                </div>`);
            });
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
        .blood-input { background: #2b0000 !important; color: #ff4d4d !important; border: 1px solid #8a0303 !important; font-family: Verdana,Arial; padding: 2px; }
        .btn-blood { background: linear-gradient(to bottom, #8a0303 0%, #4a0000 100%) !important; color: white !important; border: 1px solid #330000 !important; cursor: pointer; padding: 6px 12px; font-weight: bold; border-radius: 0; }
        .btn-blood-bright { background: #ff0000 !important; color: white !important; border: 1px solid #ffffff !important; cursor: pointer; padding: 4px 8px; font-weight: bold; border-radius: 3px; white-space: nowrap; font-size: 8pt; }
        .btn-blood:hover, .btn-blood-bright:hover { background: #660000 !important; box-shadow: 0 0 5px #ff0000; }
        .btn-active-blood { background: #1a0000 !important; color: #8a0303 !important; border: 1px solid #4a0000 !important; }
        .bazinga-final { color: #ccff00 !important; animation: bazinga-blink 0.4s infinite alternate; text-shadow: 0 0 10px #99ff00; }
        @keyframes bazinga-blink { from { color: #ccff00; } to { color: #ffff00; } }

        /* Quick offset buttons */
        .acs-quick-btn {
            background: #2b0000; color: #ff4d4d; border: 1px solid #4a0000;
            padding: 2px 6px; cursor: pointer; font-size: 8pt; border-radius: 2px;
            transition: background 0.15s, box-shadow 0.15s;
        }
        .acs-quick-btn:hover { background: #4a0000; box-shadow: 0 0 4px #ff0000; }

        /* Toggle switch */
        .acs-toggle-switch { position: relative; display: inline-block; width: 36px; height: 18px; cursor: pointer; }
        .acs-toggle-switch input { opacity: 0; width: 0; height: 0; }
        .acs-toggle-slider {
            position: absolute; inset: 0;
            background: #2b0000; border: 1px solid #8a0303; border-radius: 18px;
            transition: background 0.3s;
        }
        .acs-toggle-slider::before {
            content: ''; position: absolute;
            width: 12px; height: 12px; left: 2px; top: 2px;
            background: #8a0303; border-radius: 50%;
            transition: transform 0.3s, background 0.3s;
        }
        .acs-toggle-switch input:checked + .acs-toggle-slider { background: #3a0000; }
        .acs-toggle-switch input:checked + .acs-toggle-slider::before {
            transform: translateX(18px);
            background: #ff4d4d;
        }

        /* Native title tooltips – enhanced via CSS for browsers that support it */
        [title] { cursor: help; }
        button[title], input[title] { cursor: pointer; }
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
