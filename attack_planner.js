(async (ModuleLoader) => {
    'use strict';

    //****************************** Configuration ******************************//
    const defaultInternetDelay = 30;
    const worldBackwardDelay = 50;
    const loopStartTime = 1500;
    // --- NOVÉ STEALTH PRVKY ---
    const jitterRange = 15; // Náhodná odchylka +/- 15ms
    //*************************** End Configuration ***************************//

    await ModuleLoader.loadModule('utils/notify-utils');

    TwFramework.setIdleTitlePreffix('SENDING_COMMAND', document.title);

    const CommandSender = {
        confirmButton: null,
        duration: null,
        dateNow: null,
        internetDelay: null,
        sent: false,
        init: function () {
            $($('#command-data-form').find('tbody')[0]).append(
                `<tr>
                    <td>Chegada:</td><td><input type="datetime-local" id="ACStime" step=".001"></td>
                 </tr>
                 <tr>
                    <td>Delay da internet:</td>
                    <td><input type="number" id="ACSInternetDelay"><button type="button" id="ACSbutton" class="btn">Confirm (Stealth)</button></td>
                 </tr>`
            );
            this.confirmButton = $('#troop_confirm_submit');
            this.duration = $('#command-data-form').find('td:contains("Duração:")').next().text().split(':').map(Number);
            this.internetDelay = localStorage.getItem('ACS.internetDelay') || defaultInternetDelay;
            this.dateNow = this.convertToInput((() => {
                var d = new Date();
                d.setSeconds(d.getSeconds() + 10);
                d.setMilliseconds(501);
                return d;
            })());
            $('#ACSInternetDelay').val(this.internetDelay);
            $('#ACStime').val(this.dateNow);
            
            $('#ACSbutton').click(function () {
                const attackTime = CommandSender.getAttackTime();
                CommandSender.internetDelay = parseInt($('#ACSInternetDelay').val());
                localStorage.setItem('ACS.internetDelay', CommandSender.internetDelay);
                
                // Přidání drobné náhodnosti k delayi pro toto konkrétní odeslání
                const dynamicJitter = Math.floor(Math.random() * (jitterRange * 2 + 1)) - jitterRange;
                const finalInternetDelay = CommandSender.internetDelay + dynamicJitter;
                
                CommandSender.confirmButton.addClass('btn-disabled');
                
                setTimeout(function () {
                    console.log('Stealth loop starting. Jitter applied: ' + dynamicJitter + 'ms');
                    
                    ((day, hour, minute, second, millisecond) => {
                        var _nextFn = () => {
                            const realOffset = parseInt(finalInternetDelay) - worldBackwardDelay;
                            const serverDate = CommandSender.createServerDate(realOffset);
                            
                            if (serverDate.getSeconds() >= second || serverDate.getMinutes() > minute) {
                                if (serverDate.getMilliseconds() >= millisecond) {
                                    if (CommandSender.sent === true) return true;
                                    CommandSender.sent = true;
                                    
                                    // Simulace lidského kliknutí
                                    CommandSender.confirmButton.focus();
                                    CommandSender.confirmButton.click();
                                    
                                    console.log('Command SENT with stealth jitter at ', serverDate.toISOString());
                                    return true;
                                }
                            }
                            return false;
                        };

                        (() => {
                            const blob = new Blob([`setInterval(() => postMessage(''))`]);
                            const worker = new Worker(window.URL.createObjectURL(blob));
                            let _is_Done = false;
                            worker.onmessage = function () {
                                if (_is_Done) {
                                    UI.Notification.show("https://dsbr.innogamescdn.com/asset/c092731a/graphic/unit/recruit/axe.png", 'Odesláno!', 'Útok byl odeslán s náhodnou odchylkou.');
                                    return worker.terminate();
                                }
                                _is_Done = _nextFn();
                            }
                        })();
                    })(
                        attackTime.getDay(),
                        attackTime.getHours(),
                        attackTime.getMinutes(),
                        attackTime.getSeconds(),
                        attackTime.getMilliseconds()
                    );
                }, (attackTime - Timing.getCurrentServerTime()) - loopStartTime);
                this.disabled = true;
            });
        },
        getAttackTime: function () {
            var d = new Date($('#ACStime').val().replace('T', ' '));
            d.setHours(d.getHours() - this.duration[0]);
            d.setMinutes(d.getMinutes() - this.duration[1]);
            d.setSeconds(d.getSeconds() - this.duration[2]);
            return d;
        },
        createServerDate: function (delay) {
            return new Date(Timing.getCurrentServerTime() + (delay || 0));
        },
        convertToInput: function (t) {
            t.setHours(t.getHours() + this.duration[0]);
            t.setMinutes(t.getMinutes() + this.duration[1]);
            t.setSeconds(t.getSeconds() + this.duration[2]);
            const a = {
                y: t.getFullYear(),
                m: t.getMonth() + 1,
                d: t.getDate(),
                time: t.toTimeString().split(' ')[0],
                ms: t.getMilliseconds()
            };
            if (a.m < 10) a.m = '0' + a.m;
            if (a.d < 10) a.d = '0' + a.d;
            if (a.ms < 100) {
                a.ms = '0' + a.ms;
                if (a.ms < 10) a.ms = '0' + a.ms;
            }
            return a.y + '-' + a.m + '-' + a.d + 'T' + a.time + '.' + a.ms;
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

    CommandSender.addGlobalStyle('#ACStime, #ACSInternetDelay {font-size: 9pt;font-family: Verdana,Arial;}#ACSbutton {float:right;}');
    
    const _temporaryLoop = setInterval(function () {
        if (document.getElementById('command-data-form') && jQuery) {
            CommandSender.init();
            clearInterval(_temporaryLoop);
        }
    }, 1);

})({
    loadModule: moduleName => {
        return new Promise((resolve, reject) => {
            const modulePath = moduleName.replace('.', '/');
            const moduleUrl = `https://raw.githubusercontent.com/joaovperin/TribalWars/master/Modules/${modulePath}.js`;
            return $.ajax({
                    method: "GET",
                    url: moduleUrl,
                    dataType: "text"
                }).done(res => resolve(eval(res)))
                .fail(req => reject(console.error("[TwScripts] Fail loading module '", moduleName, "'.")));
        })
    }
});
