// ==UserScript==
// @name                 Advanced Command Scheduler - Ghost Mode v3
// @version              0.33
// @description          Server Time Sync with 12h/24h toggle, editable datetime input, attack history, tooltips.
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
        // Internal stored datetime always as Date object
        _selectedDate: null,

        init: function () {
            if ($('#ACSMainContainer').length > 0 || this.initialized) return;
            this.initialized = true;

            const formTable = $('#command-data-form').find('tbody')[0];
            if (!formTable) return;

            this.use12h = localStorage.getItem('ACS.use12h') === 'true';

            $(formTable).append(
                `<tr class="acs-row-blood">
                    <td colspan="2" style="padding: 0;">

                        <button type="button" id="ACSToggleBtn" class="btn btn-blood"
                            style="width:100%; box-sizing:border-box; display:block; margin:0;"
                            title="Open or close the Ghost Mode attack scheduler panel">
                            Open Attack Planner
                        </button>

                        <div id="ACSMainContainer" style="display:none; border-top:1px solid #4a0000; box-sizing:border-box; background:rgba(43,0,0,0.1);">
                            <div style="padding:10px 0;">
                                <table style="width:100%; border-spacing:0 5px; border-collapse:separate;">

                                    <!-- Time format toggle -->
                                    <tr>
                                        <td style="color:#ff4d4d; font-weight:bold; width:35%; padding-left:5px;"
                                            title="Switch the time display format between 24h (European standard) and 12h AM/PM (US/UK standard)">
                                            Time Format:
                                        </td>
                                        <td style="padding-right:5px;">
                                            <div style="display:flex; align-items:center; gap:8px;">
                                                <span id="ACSFormat24Label" style="color:#ff4d4d; font-weight:bold; font-size:9pt;"
                                                    title="24-hour format — common in Europe, Asia, and most of the world">24h</span>
                                                <label class="acs-toggle-switch"
                                                    title="Toggle between 24h (e.g. 22:30) and 12h AM/PM (e.g. 10:30 PM) time format">
                                                    <input type="checkbox" id="ACSFormatToggle">
                                                    <span class="acs-toggle-slider"></span>
                                                </label>
                                                <span id="ACSFormat12Label" style="color:#ff4d4d; font-weight:bold; font-size:9pt;"
                                                    title="12-hour AM/PM format — common in the USA, Canada, and Australia">12h (AM/PM)</span>
                                            </div>
                                        </td>
                                    </tr>

                                    <!-- Target arrival – editable text input + hidden native picker -->
                                    <tr>
                                        <td style="color:#ff4d4d; font-weight:bold; padding-left:5px;"
                                            title="Type directly to set arrival time — changes apply instantly as you type. Press ENTER or click away to finish editing.">
                                            Target Arrival:
                                        </td>
                                        <td style="padding-right:5px;">
                                            <div style="display:flex; gap:5px; width:100%; position:relative;">
                                                <!-- Editable text input — reflects active 12h/24h format -->
                                                <input type="text" id="ACSTimeText" class="blood-input acs-time-editable"
                                                    placeholder="DD/MM/YYYY HH:MM:SS.mmm"
                                                    spellcheck="false" autocomplete="off"
                                                    style="flex:1; min-width:170px; width:100%; font-family:monospace; font-size:9pt; box-sizing:border-box;"
                                                    title="Type the target arrival date/time directly. Format: DD/MM/YYYY HH:MM:SS.mmm (24h) or DD/MM/YYYY HH:MM:SS.mmm AM/PM (12h). Press Enter or click outside to confirm.">
                                                <!-- Hidden native datetime-local input (used only for picker) -->
                                                <input type="datetime-local" id="ACStime" step=".001"
                                                    style="position:absolute; opacity:0; pointer-events:none; width:1px; height:1px; top:0; left:0;"
                                                    tabindex="-1">
                                                <button type="button" id="ACSSetTimeBtn" class="btn btn-blood-bright"
                                                    title="Open the browser date/time picker to set the target arrival time">
                                                    SET DAY &amp; TIME
                                                </button>
                                            </div>
                                            <!-- Quick offset buttons -->
                                            <div style="display:flex; gap:4px; margin-top:4px;" id="ACSQuickButtons">
                                                <button type="button" class="acs-quick-btn" data-offset="3600"
                                                    title="Add 1 hour to the current target arrival time">+1h</button>
                                                <button type="button" class="acs-quick-btn" data-offset="21600"
                                                    title="Add 6 hours to the current target arrival time">+6h</button>
                                                <button type="button" class="acs-quick-btn" data-offset="43200"
                                                    title="Add 12 hours to the current target arrival time">+12h</button>
                                                <button type="button" class="acs-quick-btn" data-offset="86400"
                                                    title="Add 1 day to the current target arrival time">+1d</button>
                                                <button type="button" class="acs-quick-btn" data-offset="-3600"
                                                    title="Subtract 1 hour from the current target arrival time" style="color:#ff8080;">-1h</button>
                                            </div>
                                        </td>
                                    </tr>

                                    <!-- Network correction -->
                                    <tr>
                                        <td style="color:#ff4d4d; font-weight:bold; padding-left:5px;"
                                            title="Network latency compensation in milliseconds. Higher value = command sent earlier. Recommended: 20–50ms for fast connections, 50–100ms for slower ones.">
                                            Network Correction:
                                        </td>
                                        <td style="padding-right:5px;">
                                            <input type="number" id="ACSInternetDelay" class="blood-input"
                                                style="width:100%; box-sizing:border-box;"
                                                title="Your network ping in ms. You can check it at fast.com or speedtest.net">
                                        </td>
                                    </tr>

                                </table>
                            </div>

                            <!-- Arrival preview — always visible, shows computed arrival time -->
                            <div id="ACSArrivalPreview" style="margin:0 5px 4px 5px; padding:5px 8px; background:#0d0000; border:1px solid #2a0000; color:#8a0303; font-size:8pt; border-radius:2px; font-family:monospace; display:flex; justify-content:space-between; align-items:center;"
                                title="Calculated arrival time at the target village — based on current Target Arrival input">
                                <span style="color:#ffffff; font-weight:bold;">⚔ Arrives at:</span>
                                <span id="ACSArrivalTime" style="color:#ff4d4d; font-weight:bold; letter-spacing:0.5px;">--:--:--.--- (--/--/----)</span>
                            </div>

                            <!-- Validation warning -->
                            <div id="ACSWarning" style="display:none; margin:0 5px 5px 5px; padding:5px 8px; background:#3a2000; border:1px solid #ff8800; color:#ffaa00; font-size:8pt; border-radius:2px;"></div>

                            <button type="button" id="ACSbutton" class="btn btn-blood"
                                style="width:100%; box-sizing:border-box; display:block; margin:0;"
                                title="Activate Ghost Mode — the script will automatically send the attack at the correct time, even if the tab is in the background">
                                Confirm Ghost Mode
                            </button>

                            <!-- Countdown -->
                            <div id="ACSCountdownContainer" style="display:none; box-sizing:border-box; border-top:1px dashed #ff0000; border-bottom:1px dashed #ff0000; background:#1a0000; width:100%;">
                                <div style="padding:10px;">
                                    <div id="ACSCountdown"
                                        style="color:#ff0000; font-family:monospace; font-size:14pt; font-weight:bold; text-align:center;"
                                        title="Countdown to the moment the attack is sent (send time = arrival time minus travel duration)">
                                        00:00:00.000
                                    </div>
                                    <div id="ACSTargetDisplay"
                                        style="color:#8a0303; font-size:8pt; text-align:center; margin-top:3px;"
                                        title="Exact server time at which the attack command will be dispatched">
                                        Sending at: --:--:-- (Server Time)
                                    </div>
                                    <div id="ACSSendAccuracy" style="display:none; color:#ffcc00; font-size:8pt; text-align:center; margin-top:3px;"
                                        title="Measured send precision in milliseconds relative to the ideal target time. Green = excellent, yellow = good, red = late.">
                                    </div>
                                </div>
                            </div>

                            <!-- Attack History -->
                            <div id="ACSHistoryContainer" style="display:none; border-top:1px dashed #4a0000; padding:5px;">
                                <div style="color:#8a0303; font-size:8pt; font-weight:bold; margin-bottom:3px;"
                                    title="Last ${maxHistoryEntries} attacks sent via this script. Color: green = &lt;10ms accuracy, yellow = &lt;50ms, red = late.">
                                    📋 Attack History:
                                </div>
                                <div id="ACSHistoryList" style="font-size:7.5pt; font-family:monospace; color:#cc3333; max-height:80px; overflow-y:auto; background:#0d0000; border:1px solid #2a0000; border-radius:2px; padding:2px 4px;"></div>
                            </div>

                            <div id="ACSPoweredBy"
                                style="padding:5px 5px 10px 0; font-size:9pt; color:#8a0303; text-align:right; font-weight:bold; text-shadow:1px 1px 1px #000; cursor:help;"
                                title="B4LD PH4NT0M">
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

            // Set default arrival time = now + travel duration + 60s
            // This ensures the send time is ~60s in the future right from the start
            let d = new Date(Timing.getCurrentServerTime());
            d.setHours(d.getHours()   + (this.duration[0] || 0));
            d.setMinutes(d.getMinutes() + (this.duration[1] || 0));
            d.setSeconds(d.getSeconds() + (this.duration[2] || 0) + 60);
            this._setSelectedDate(d);

            // Apply saved 12h toggle state AFTER the checkbox exists in DOM
            $('#ACSFormatToggle').prop('checked', this.use12h);
            this.updateFormatLabels();
            this.renderTimeDisplay();

            this.preventVisibilityDetection();
            this.renderHistory();

            // ---- Event Bindings ----

            $('#ACSFormatToggle').change(() => {
                this.use12h = $('#ACSFormatToggle').is(':checked');
                localStorage.setItem('ACS.use12h', this.use12h);
                this.updateFormatLabels();
                this.renderTimeDisplay();
                this.renderHistory(); // re-render history with new format
            });

            $('#ACSSetTimeBtn').click(() => {
                // Sync hidden input to current selection, then trigger picker
                const tzoffset = this._selectedDate.getTimezoneOffset() * 60000;
                $('#ACStime').val((new Date(this._selectedDate - tzoffset)).toISOString().slice(0, 23));
                document.getElementById('ACStime').showPicker();
            });

            $('#ACStime').on('change', () => {
                const val = $('#ACStime').val();
                if (!val) return;
                const parsed = new Date(val.replace('T', ' '));
                if (!isNaN(parsed.getTime())) {
                    this._setSelectedDate(parsed);
                }
            });

            // Live parsing — every keystroke immediately tries to parse and apply.
            // No Enter needed. Red border = incomplete/invalid, clears as soon as valid.
            const liveParseInput = () => {
                const raw = $('#ACSTimeText').val();
                const parsed = this.parseManualInput(raw);
                if (parsed) {
                    this._setSelectedDate(parsed, true); // skipInputUpdate=true — don't overwrite while typing
                    $('#ACSTimeText').css('border-color', '');
                } else {
                    $('#ACSTimeText').css('border-color', '#550000'); // subtle dark-red while incomplete
                }
            };
            // on input covers typing, paste, cut, browser autofill
            $('#ACSTimeText').on('input', liveParseInput);
            // blur: final commit + restore display if field was left mid-edit
            $('#ACSTimeText').on('blur', () => {
                const raw = $('#ACSTimeText').val();
                const parsed = this.parseManualInput(raw);
                if (parsed) {
                    this._setSelectedDate(parsed); // full update — re-render display
                    $('#ACSTimeText').css('border-color', '');
                } else if (this._selectedDate) {
                    // Revert to last valid value
                    this.renderTimeDisplay();
                    $('#ACSTimeText').css('border-color', '');
                }
            });
            // Keep Enter as convenience shortcut to blur (confirm + exit field)
            $('#ACSTimeText').on('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); $('#ACSTimeText').blur(); }
            });

            // Segment definitions for DD/MM/YYYY HH:MM:SS.mmm [start, end (exclusive), maxLen]
            const ACS_SEGMENTS = [
                [0,  2,  2],  // DD
                [3,  5,  2],  // MM
                [6,  10, 4],  // YYYY
                [11, 13, 2],  // HH
                [14, 16, 2],  // MM
                [17, 19, 2],  // SS
                [20, 23, 3],  // mmm
            ];

            // Helper: find which segment index the cursor pos falls in
            const getSegmentAt = (pos) => {
                for (let i = 0; i < ACS_SEGMENTS.length; i++) {
                    const [s, e_] = ACS_SEGMENTS[i];
                    if (pos >= s && pos <= e_) return i;
                }
                return -1;
            };

            // Smart double-click: select only the segment under cursor
            $('#ACSTimeText').on('dblclick', function(e) {
                e.preventDefault();
                const pos = this.selectionStart;
                const idx = getSegmentAt(pos);
                if (idx >= 0) {
                    const [s, e_] = ACS_SEGMENTS[idx];
                    this.setSelectionRange(s, e_);
                } else {
                    this.select();
                }
            });

            // Auto-advance: after typing fills a segment, jump to next segment
            $('#ACSTimeText').on('input', function() {
                const input = this;
                const pos = input.selectionStart;
                const val = input.value;
                const idx = getSegmentAt(pos - 1); // pos-1 because cursor is after typed char
                if (idx < 0) return;

                const [segStart, segEnd, maxLen] = ACS_SEGMENTS[idx];
                const segContent = val.slice(segStart, segEnd);
                const typedLen = segContent.replace(/[^\d]/g, '').length;

                // If segment is full and there's a next segment, jump to it
                if (typedLen >= maxLen && idx < ACS_SEGMENTS.length - 1) {
                    const [nextStart, nextEnd] = ACS_SEGMENTS[idx + 1];
                    // Small timeout so browser finishes processing the input event first
                    setTimeout(() => {
                        input.setSelectionRange(nextStart, nextEnd);
                    }, 0);
                }
            });

            $('#ACSToggleBtn').click(() => {
                $('#ACSMainContainer').toggle();
                const isVisible = $('#ACSMainContainer').is(':visible');
                $('#ACSToggleBtn').text(isVisible ? 'Close Attack Planner' : 'Open Attack Planner');
            });

            // Quick offset buttons
            $(document).on('click', '.acs-quick-btn', (e) => {
                const offset = parseInt($(e.target).data('offset'));
                if (!this._selectedDate) return;
                const newDate = new Date(this._selectedDate.getTime() + offset * 1000);
                this._setSelectedDate(newDate);
            });

            $('#ACSbutton').click((e) => {
                e.preventDefault();
                this.executeLogic();
            });
        },

        // Internal: set selected date, update display & validate
        _setSelectedDate: function(date, skipInputUpdate) {
            this._selectedDate = date;
            if (!skipInputUpdate) this.renderTimeDisplay();
            this.validateTime();
            this.updateArrivalPreview();
        },

        renderTimeDisplay: function() {
            if (!this._selectedDate) return;
            const d = this._selectedDate;
            const dateStr = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
            const timeStr = this.formatTimeOnly(d);
            const msStr = String(d.getMilliseconds()).padStart(3,'0');
            const formatted = `${dateStr} ${timeStr}.${msStr}`;
            // Only update when not actively typing
            if (document.activeElement !== document.getElementById('ACSTimeText')) {
                $('#ACSTimeText').val(formatted).css('border-color', '');
            }
            // Update placeholder to reflect active format
            const ph = this.use12h ? 'DD/MM/YYYY HH:MM:SS.mmm AM/PM' : 'DD/MM/YYYY HH:MM:SS.mmm';
            $('#ACSTimeText').attr('placeholder', ph);
            this.updateArrivalPreview();
        },

        // Parse a manually typed datetime string — accepts both 24h and 12h formats
        // Supported: DD/MM/YYYY HH:MM:SS.mmm  |  DD/MM/YYYY HH:MM:SS  |  DD/MM/YYYY HH:MM
        // With optional trailing AM/PM for 12h mode
        parseManualInput: function(raw) {
            raw = raw.trim();
            let ampm = null;
            const ampmMatch = raw.match(/\s+(AM|PM)$/i);
            if (ampmMatch) {
                ampm = ampmMatch[1].toUpperCase();
                raw = raw.replace(/\s+(AM|PM)$/i, '').trim();
            }
            const re = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
            const m = raw.match(re);
            if (!m) return null;
            let [, dd, mo, yyyy, hh, mm, ss = '0', ms = '0'] = m;
            let hours = parseInt(hh, 10);
            const mins  = parseInt(mm, 10);
            const secs  = parseInt(ss, 10);
            const msNum = parseInt(ms.padEnd(3, '0'), 10);
            if (ampm === 'AM' && hours === 12) hours = 0;
            else if (ampm === 'PM' && hours !== 12) hours += 12;
            const result = new Date(parseInt(yyyy,10), parseInt(mo,10)-1, parseInt(dd,10), hours, mins, secs, msNum);
            return isNaN(result.getTime()) ? null : result;
        },

        // Update the "⚔ Arrives at:" preview line
        updateArrivalPreview: function() {
            if (!this._selectedDate) return;
            // _selectedDate IS the arrival time — display it directly
            const d = this._selectedDate;
            const timeStr = this.formatServerTime(d);
            const dateStr = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
            $('#ACSArrivalTime').text(`${timeStr} (${dateStr})`);
        },

        // Format just the HH:MM:SS part (no ms) respecting 12h/24h
        formatTimeOnly: function(date) {
            if (this.use12h) {
                let hours = date.getHours();
                const ampm = hours >= 12 ? 'PM' : 'AM';
                hours = hours % 12 || 12;
                return `${String(hours).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}:${String(date.getSeconds()).padStart(2,'0')} ${ampm}`;
            } else {
                return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}:${String(date.getSeconds()).padStart(2,'0')}`;
            }
        },

        // Full time string including ms
        formatServerTime: function(date) {
            const ms = String(date.getMilliseconds()).padStart(3,'0');
            return `${this.formatTimeOnly(date)}.${ms}`;
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

        validateTime: function() {
            if (!this._selectedDate) return;
            const sendTime = this._getAttackTimeFromSelected(); // arrival minus travel = when to click send
            if (!sendTime || isNaN(sendTime.getTime())) return;
            const nowMs = new Date(Timing.getCurrentServerTime()).getTime();
            const sendMs = sendTime.getTime();
            const diff = sendMs - nowMs;
            const warning = $('#ACSWarning');

            if (diff < 0) {
                // Show how far in the past the send time is, to help user correct it
                const pastSec = Math.round(-diff / 1000);
                warning.text(`⚠️ Send time is ${pastSec}s in the past! Increase the target arrival time.`).show();
            } else if (diff < 5000) {
                warning.text('⚠️ Less than 5 seconds until send — too close to activate safely!').show();
            } else if (diff > 86400000 * 7) {
                warning.text('ℹ️ Target arrival is more than 7 days ahead — please verify the date.').show();
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
            const attackTime = this._getAttackTimeFromSelected();
            if (!attackTime || isNaN(attackTime.getTime())) return;

            const nowMs = new Date(Timing.getCurrentServerTime()).getTime();
            if (attackTime.getTime() - nowMs < 5000) {
                alert('Send time is too close or already in the past!');
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
            const dateStr = `${serverDate.getFullYear()}-${String(serverDate.getMonth()+1).padStart(2,'0')}-${String(serverDate.getDate()).padStart(2,'0')}`;
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

                const hours   = Math.floor(diff / 3600000);
                const minutes = Math.floor((diff % 3600000) / 60000);
                const seconds = Math.floor((diff % 60000) / 1000);
                const ms      = Math.floor(diff % 1000);

                $('#ACSCountdown').text(
                    `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${String(ms).padStart(3,'0')}`
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
            const targetMs  = attackTime.getMilliseconds();
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

                        const accuracyMs = actualSendTime - this.sendTimestamp;
                        const sign = accuracyMs >= 0 ? '+' : '';
                        $('#ACSSendAccuracy').text(`Send accuracy: ${sign}${accuracyMs}ms`).show();

                        // Save to history using _selectedDate (arrival time, not send time)
                        this.saveHistory(new Date(this._selectedDate.getTime()), accuracyMs);
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

        // Compute send time from _selectedDate by subtracting travel duration
        _getAttackTimeFromSelected: function () {
            if (!this._selectedDate) return null;
            const d = new Date(this._selectedDate.getTime());
            d.setHours(d.getHours()   - (this.duration[0] || 0));
            d.setMinutes(d.getMinutes() - (this.duration[1] || 0));
            d.setSeconds(d.getSeconds() - (this.duration[2] || 0));
            return d;
        },

        // Legacy alias kept for compatibility
        getAttackTime: function () {
            return this._getAttackTimeFromSelected();
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
                const dateStr = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} ${this.formatServerTime(d)}`;
                const accVal = parseInt(entry.accuracy);
                const color = accVal < 0 ? '#ff8888' : accVal <= 10 ? '#88ff88' : '#ffcc44';
                list.append(`<div style="color:${color}; border-bottom:1px solid #2a0000; padding:1px 0;"
                    title="Attack #${i+1}: Target arrival ${dateStr} | Send accuracy ${entry.accuracy} (green &lt;10ms, yellow &lt;50ms, red = late)">
                    #${i+1} → ${dateStr} <span style="color:${color}">(${entry.accuracy})</span>
                </div>`);
            });
        },

        addGlobalStyle: function (css) {
            const head = document.getElementsByTagName('head')[0];
            if (!head) return;
            const style = document.createElement('style');
            style.type = 'text/css';
            style.innerHTML = css;
            head.appendChild(style);
        }
    };

    CommandSender.addGlobalStyle(`
        .blood-input {
            background: #2b0000 !important; color: #ff4d4d !important;
            border: 1px solid #8a0303 !important; font-family: Verdana,Arial; padding: 2px;
        }
        .acs-time-editable {
            padding: 3px 5px; font-family: monospace; font-size: 9pt;
            min-height: 22px; min-width: 170px; box-sizing: border-box;
            transition: border-color 0.2s;
            outline: none; overflow: visible;
        }
        .acs-time-editable:focus {
            border-color: #ff4d4d !important;
            box-shadow: 0 0 4px #ff000088;
        }
        .btn-blood {
            background: linear-gradient(to bottom, #8a0303 0%, #4a0000 100%) !important;
            color: white !important; border: 1px solid #330000 !important;
            cursor: pointer; padding: 6px 12px; font-weight: bold; border-radius: 0;
        }
        .btn-blood-bright {
            background: #ff0000 !important; color: white !important;
            border: 1px solid #ffffff !important; cursor: pointer;
            padding: 4px 8px; font-weight: bold; border-radius: 3px;
            white-space: nowrap; font-size: 8pt;
        }
        .btn-blood:hover, .btn-blood-bright:hover {
            background: #660000 !important; box-shadow: 0 0 5px #ff0000;
        }
        .btn-active-blood {
            background: #1a0000 !important; color: #8a0303 !important;
            border: 1px solid #4a0000 !important;
        }
        .bazinga-final {
            color: #ccff00 !important;
            animation: bazinga-blink 0.4s infinite alternate;
            text-shadow: 0 0 10px #99ff00;
        }
        @keyframes bazinga-blink { from { color: #ccff00; } to { color: #ffff00; } }

        /* Quick offset buttons */
        .acs-quick-btn {
            background: #2b0000; color: #ff4d4d; border: 1px solid #4a0000;
            padding: 2px 6px; cursor: pointer; font-size: 8pt; border-radius: 2px;
            transition: background 0.15s, box-shadow 0.15s;
        }
        .acs-quick-btn:hover { background: #4a0000; box-shadow: 0 0 4px #ff0000; }

        /* Toggle switch */
        .acs-toggle-switch {
            position: relative; display: inline-block;
            width: 36px; height: 18px; cursor: pointer;
        }
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
            transform: translateX(18px); background: #ff4d4d;
        }

        /* Tooltip cursor hints */
        [title] { cursor: help; }
        button[title], .acs-quick-btn { cursor: pointer; }
        #ACSPoweredBy { cursor: help; }
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
