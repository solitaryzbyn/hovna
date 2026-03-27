// ==UserScript==
// @name                 PH4NT0M – Attack Identifier + Discord Notify
// @version              2.1.0
// @description          Detekuje noble vlaky a ram vlaky (3+ berani do 3s) a odesílá na Discord
// @author               TheBrain
// @icon                 https://i.imgur.com/7WgHTT8.gif
// @match                https://*.divokekmeny.cz/game.php?*
// @match                https://*.tribalwars.net/game.php?*
// @grant                none
// ==/UserScript==

(function () {
    'use strict';

    // ============================================================
    //  KONFIGURACE – VYPLŇ PŘED POUŽITÍM
    // ============================================================
    const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1487063530086727711/sLYm1-Fh-jwj0FQmGSb6UogHwb3ktLvidH3BLwN37oC3QDQCH5bTUMtBj84zM-AHcDOx';

    const RAM_TRAIN_MIN_ATTACKS   = 3;   // minimálně kolik útoků tvoří ram vlak
    const RAM_TRAIN_TIME_WINDOW_S = 3;   // v rozmezí kolika sekund
    // ============================================================

    const slowMin  =  3 * 60 * 1000;
    const slowMax  = 22 * 60 * 1000;
    const nightMin = 52 * 60 * 1000;
    const nightMax = 78 * 60 * 1000;

    const now         = new Date();
    const hours       = now.getHours();
    const isNightMode = hours >= 1 && hours < 7;

    const urlParams = window.location.search;
    const isPrichod = urlParams.includes('screen=overview_villages') && urlParams.includes('mode=incomings');
    const isUtoky   = urlParams.includes('mode=incomings') && urlParams.includes('subtype=attacks');

    if (!(isPrichod || isUtoky) || urlParams.includes('screen=place')) return;

    // ============================================================
    //  HUD PANEL
    // ============================================================
    const logContainer = document.createElement('div');
    logContainer.id = 'brain-log-container';
    logContainer.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; width: 330px; max-height: 300px;
        background: rgba(10,10,20,0.95); color: #c8d8ff;
        border: 1px solid #2a3a6a; border-top: 3px solid #4466ff;
        padding: 12px; font-family: 'Courier New', monospace; font-size: 11px;
        z-index: 999999; overflow-y: auto; border-radius: 6px;
        box-shadow: 0 0 20px rgba(40,80,255,0.2);
    `;

    const modeText = isNightMode
        ? '<span style="color:#ffa500;">⏾ NOČNÍ POMALÝ REŽIM</span>'
        : '<span style="color:#44ff88;">☀ DENNÍ REŽIM</span>';

    logContainer.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <strong style="color:#7799ff;">⚔ PH4NT0M Identifier</strong>
            <small style="color:#556688;">v2.1</small>
        </div>
        <div>Režim: ${modeText}</div>
        <div id="brain-countdown" style="color:#44ff88;font-weight:bold;margin:3px 0;">Další cyklus: --:--</div>
        <div id="brain-discord-status" style="margin-bottom:4px;"></div>
        <hr style="border:0;border-top:1px solid #1a2a4a;margin:5px 0;">
        <div id="brain-log-content"></div>
    `;
    document.body.appendChild(logContainer);

    function addLog(message, color = '#c8d8ff') {
        const time  = new Date().toLocaleTimeString('cs-CZ');
        const entry = document.createElement('div');
        entry.style.cssText = 'margin-bottom:3px;line-height:1.4;';
        entry.innerHTML = `<span style="color:#4466aa;">[${time}]</span> <span style="color:${color};">${message}</span>`;
        document.getElementById('brain-log-content').prepend(entry);
    }

    function setDiscordStatus(ok, msg) {
        document.getElementById('brain-discord-status').innerHTML = ok
            ? `<span style="color:#44ff88;">✔ ${msg}</span>`
            : `<span style="color:#ff4444;">✘ ${msg}</span>`;
    }

    function sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    // ============================================================
    //  PARSOVÁNÍ ČASU PŘÍJEZDU
    //  Podporuje formáty: HH:MM:SS:mmm  nebo  HH:MM:SS
    //  Ignoruje textové prefixy jako "zítra v", "dnes v" atd.
    // ============================================================
    function parseArrivalMs(timeStr) {
        if (!timeStr) return null;

        // Extrahuj pouze číslice a dvojtečky
        const match = timeStr.match(/(\d{1,2}):(\d{2}):(\d{2})(?::(\d{1,3}))?/);
        if (!match) return null;

        const h  = parseInt(match[1]);
        const m  = parseInt(match[2]);
        const s  = parseInt(match[3]);
        const ms = match[4] ? parseInt(match[4].padEnd(3, '0')) : 0;

        return ((h * 3600) + (m * 60) + s) * 1000 + ms;
    }

    // ============================================================
    //  PARSOVÁNÍ PŘÍCHOZÍCH ÚTOKŮ Z TABULKY
    // ============================================================
    function parseAttackRows() {
        const rows   = document.querySelectorAll('#incomings_table tr.nowrap');
        const result = [];

        rows.forEach(row => {
            const text     = row.innerText || '';
            const isAttack = text.includes('Útok') || text.includes('Attack');
            if (!isAttack) return;

            // Noble detekce
            const isNoble = !!(
                row.querySelector('img[src*="snob"]') ||
                row.querySelector('img[src*="noble"]') ||
                text.includes('Šlechtic') ||
                text.includes('Noble')
            );

            // Útočník
            const attackerCell = row.querySelector('td:nth-child(2) a');
            const attacker     = attackerCell ? attackerCell.innerText.trim() : 'Neznámý';

            // Zdrojová vesnice
            const sourceCell = row.querySelector('td:nth-child(3) a, td:nth-child(3) span');
            const source     = sourceCell ? sourceCell.innerText.trim() : 'Neznámá';

            // Cílová vesnice
            const targetCell = row.querySelector('td:nth-child(4) a, td:nth-child(5) a');
            const target     = targetCell ? targetCell.innerText.trim() : 'Neznámá';

            // ID cílové vesnice
            const targetLink     = row.querySelector('td a[href*="info_village"]');
            const villageIdMatch = targetLink ? targetLink.href.match(/id=(\d+)/) : null;
            const villageId      = villageIdMatch ? villageIdMatch[1] : null;

            // Čas příjezdu
            const timeCell   = row.querySelector('.time_cell') || row.querySelector('td:last-child');
            const arrivalRaw = timeCell ? timeCell.innerText.trim() : '';
            const arrivalMs  = parseArrivalMs(arrivalRaw);

            result.push({ attacker, source, target, villageId, arrivalRaw, arrivalMs, isNoble });
        });

        return result;
    }

    // ============================================================
    //  DETEKCE RAM VLAKŮ
    //
    //  Logika:
    //  - Vezme pouze NON-noble útoky s validním časem
    //  - Seřadí chronologicky
    //  - Seskupí útoky kde VŠECHNY přijdou do TIME_WINDOW_S od prvního
    //  - Skupina se počítá jako ram vlak pokud má >= MIN_ATTACKS útoků
    //  - Ostatní (ojedinělé) útoky budou jen označeny, Discord ne
    // ============================================================
    function detectRamTrains(attacks) {
        const candidates = attacks
            .filter(a => !a.isNoble && a.arrivalMs !== null)
            .sort((a, b) => a.arrivalMs - b.arrivalMs);

        const trains = [];
        const used   = new Set();
        const windowMs = RAM_TRAIN_TIME_WINDOW_S * 1000;

        for (let i = 0; i < candidates.length; i++) {
            if (used.has(i)) continue;

            const group = [candidates[i]];

            for (let j = i + 1; j < candidates.length; j++) {
                if (used.has(j)) continue;
                // Porovnáváme vždy oproti PRVNÍMU útoku skupiny
                if (candidates[j].arrivalMs - candidates[i].arrivalMs <= windowMs) {
                    group.push(candidates[j]);
                    used.add(j);
                }
            }

            if (group.length >= RAM_TRAIN_MIN_ATTACKS) {
                used.add(i);
                trains.push(group);
                addLog(
                    `🐏 Ram vlak: ${group.length} útoků na ${group[0].target} ` +
                    `(${((group[group.length-1].arrivalMs - group[0].arrivalMs)/1000).toFixed(3)}s rozptyl)`,
                    '#ffa040'
                );
            }
        }

        return trains;
    }

    // ============================================================
    //  FETCH: DATA VESNICE
    // ============================================================
    async function fetchVillageData(villageId) {
        if (!villageId) return {};
        try {
            // Příchozí podpora
            const supportRes  = await fetch(`/game.php?village=${villageId}&screen=place&mode=call&target=${villageId}`);
            const supportHtml = await supportRes.text();
            const supportDoc  = new DOMParser().parseFromString(supportHtml, 'text/html');
            const supportParts = [];
            supportDoc.querySelectorAll('#support_sum tbody tr').forEach(tr => {
                tr.querySelectorAll('td[data-unit]').forEach(td => {
                    const unit   = td.getAttribute('data-unit');
                    const amount = parseInt(td.innerText.trim());
                    if (amount > 0) supportParts.push(`${amount}× ${unit}`);
                });
            });
            const incomingSupport = supportParts.length ? supportParts.join(', ') : 'žádná';

            // Overview
            const overviewRes  = await fetch(`/game.php?village=${villageId}&screen=overview`);
            const overviewHtml = await overviewRes.text();
            const overviewDoc  = new DOMParser().parseFromString(overviewHtml, 'text/html');

            let wallLevel = 'N/A';
            const wallEl  = overviewDoc.querySelector('img[src*="wall"], a[href*="screen=wall"]');
            if (wallEl) {
                const m = (wallEl.closest('td, div')?.innerText || '').match(/\d+/);
                if (m) wallLevel = m[0];
            }

            let loyalty   = 'N/A';
            const loyalEl = overviewDoc.querySelector('#loyalty_value, .loyalty_value, [id*="loyalty"]');
            if (loyalEl) loyalty = loyalEl.innerText.trim();

            let sigil = 'N/A';
            let flag  = 'N/A';
            overviewDoc.querySelectorAll('#show_effects .village_overview_effect').forEach(el => {
                const title = el.getAttribute('title') || '';
                const txt   = el.innerText?.trim() || '';
                if (txt.includes('Sigil') || txt.includes('Signal')) {
                    const m = title.match(/(\d+)/);
                    if (m) sigil = m[1] + '%';
                } else if (!el.getAttribute('title')) {
                    flag = txt || 'N/A';
                }
            });

            const defParts = [];
            overviewDoc.querySelectorAll('#troops_home tbody tr, .units-row').forEach(tr => {
                tr.querySelectorAll('td[data-unit]').forEach(td => {
                    const unit   = td.getAttribute('data-unit');
                    const amount = parseInt(td.innerText.trim());
                    if (amount > 0) defParts.push(`${amount}× ${unit}`);
                });
            });
            const defenders = defParts.length ? defParts.join(', ') : 'N/A';

            return { wallLevel, loyalty, sigil, flag, defenders, incomingSupport };

        } catch (err) {
            console.error('fetchVillageData error:', err);
            return {};
        }
    }

    // ============================================================
    //  DISCORD – NOBLE VLAK
    // ============================================================
    async function sendNobleTrainToDiscord(attack, villageData) {
        const { attacker, source, target, arrivalRaw } = attack;
        const {
            wallLevel = 'N/A', loyalty = 'N/A', sigil = 'N/A',
            flag = 'N/A', defenders = 'N/A', incomingSupport = 'N/A',
        } = villageData;

        const world      = window.location.hostname.split('.')[0].toUpperCase();
        const playerName = typeof game_data !== 'undefined' ? game_data.player.name : 'Bot';

        await postToDiscord({
            username:   'PH4NT0M Attack Identifier',
            avatar_url: 'https://i.imgur.com/7WgHTT8.gif',
            embeds: [{
                color:       15844367,
                timestamp:   new Date().toISOString(),
                title:       `👑 [${world}] NOBLE VLAK DETEKOVÁN`,
                description: `**Cílová vesnice:** ${target}\n**Útočník:** ${attacker} z ${source}\n**Příjezd noble:** \`${arrivalRaw}\``,
                fields: [
                    { name: '🧱 Zeď',             value: String(wallLevel),       inline: true  },
                    { name: '💛 Loajalita',         value: String(loyalty),         inline: true  },
                    { name: '🔱 Sigil',            value: String(sigil),           inline: true  },
                    { name: '🚩 Vlajka',           value: String(flag),            inline: true  },
                    { name: '🛡 Obránci',          value: String(defenders),       inline: false },
                    { name: '📥 Příchozí podpora', value: String(incomingSupport), inline: false },
                ],
                footer: { text: `PH4NT0M v2.1 | ${playerName} | ${window.location.hostname}` },
            }],
        }, `Noble → ${target}`);
    }

    // ============================================================
    //  DISCORD – RAM VLAK
    // ============================================================
    async function sendRamTrainToDiscord(trainGroup, villageData) {
        const target = trainGroup[0].target;
        const {
            wallLevel = 'N/A', loyalty = 'N/A', sigil = 'N/A',
            flag = 'N/A', defenders = 'N/A', incomingSupport = 'N/A',
        } = villageData;

        const world      = window.location.hostname.split('.')[0].toUpperCase();
        const playerName = typeof game_data !== 'undefined' ? game_data.player.name : 'Bot';

        const spanMs  = trainGroup[trainGroup.length - 1].arrivalMs - trainGroup[0].arrivalMs;
        const spanStr = (spanMs / 1000).toFixed(3) + 's';

        const attackLines = trainGroup.map((a, i) =>
            `\`${String(i + 1).padStart(2, '0')}.\` **${a.attacker}** (${a.source}) — \`${a.arrivalRaw}\``
        ).join('\n');

        await postToDiscord({
            username:   'PH4NT0M Attack Identifier',
            avatar_url: 'https://i.imgur.com/7WgHTT8.gif',
            embeds: [{
                color:       16729344,
                timestamp:   new Date().toISOString(),
                title:       `🐏 [${world}] RAM VLAK — ${trainGroup.length} útoků / rozptyl ${spanStr}`,
                description: [
                    `**Cílová vesnice:** ${target}`,
                    `**Časový rozptyl:** \`${spanStr}\``,
                    '',
                    '**Útoky ve vlaku:**',
                    attackLines,
                ].join('\n').substring(0, 4096),
                fields: [
                    { name: '🧱 Zeď',             value: String(wallLevel),       inline: true  },
                    { name: '💛 Loajalita',         value: String(loyalty),         inline: true  },
                    { name: '🔱 Sigil',            value: String(sigil),           inline: true  },
                    { name: '🚩 Vlajka',           value: String(flag),            inline: true  },
                    { name: '🛡 Obránci',          value: String(defenders),       inline: false },
                    { name: '📥 Příchozí podpora', value: String(incomingSupport), inline: false },
                ],
                footer: { text: `PH4NT0M v2.1 | ${playerName} | ${window.location.hostname}` },
            }],
        }, `Ram vlak → ${target} (${trainGroup.length}×)`);
    }

    // ============================================================
    //  SPOLEČNÝ POST NA WEBHOOK
    // ============================================================
    async function postToDiscord(body, label) {
        if (!DISCORD_WEBHOOK_URL.includes('discord.com')) {
            setDiscordStatus(false, 'Webhook není nastaven!');
            return;
        }
        try {
            const res = await fetch(DISCORD_WEBHOOK_URL, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(body),
            });
            if (res.ok) {
                addLog(`✔ Discord: ${label}`, '#44ff88');
                setDiscordStatus(true, `Odesláno (${new Date().toLocaleTimeString('cs-CZ')})`);
            } else {
                addLog(`✘ Discord HTTP ${res.status}`, '#ff4444');
                setDiscordStatus(false, `HTTP ${res.status}`);
            }
        } catch (err) {
            addLog(`✘ Fetch: ${err.message}`, '#ff4444');
            setDiscordStatus(false, err.message);
        }
    }

    // ============================================================
    //  OZNAČENÍ ÚTOKŮ V UI
    // ============================================================
    async function labelAttacksInUI() {
        const selectAll = document.getElementById('select_all') || document.querySelector('input[name="all"]');
        const labelBtn  = document.querySelector('input[name="label"]') || document.querySelector('input.btn[value="Označit"]');

        if (selectAll && labelBtn) {
            await sleep(Math.floor(Math.random() * 1700) + 800);
            selectAll.click();
            addLog('Vybírám útoky...');
            await sleep(Math.floor(Math.random() * 2500) + 1500);
            labelBtn.click();
            addLog('✔ Označeno.', '#44ff88');
        }
    }

    // ============================================================
    //  HLAVNÍ LOGIKA
    // ============================================================
    async function run() {
        const attacks = parseAttackRows();

        if (attacks.length === 0) {
            addLog('✔ Vše čisté.', '#44ff88');
            return;
        }

        addLog(`Nalezeno ${attacks.length} útok(ů), analyzuji...`);

        // --- 1. Noble vlaky ---
        const nobleAttacks = attacks.filter(a => a.isNoble);
        for (const attack of nobleAttacks) {
            addLog(`👑 Noble → ${attack.target}`);
            const data = attack.villageId ? await fetchVillageData(attack.villageId) : {};
            await sendNobleTrainToDiscord(attack, data);
            await sleep(Math.floor(Math.random() * 500) + 300);
        }

        // --- 2. Ram vlaky (skupiny non-noble útoků do 3s) ---
        const ramTrains = detectRamTrains(attacks);

        if (ramTrains.length > 0) {
            for (const group of ramTrains) {
                const data = group[0].villageId ? await fetchVillageData(group[0].villageId) : {};
                await sendRamTrainToDiscord(group, data);
                await sleep(Math.floor(Math.random() * 500) + 300);
            }
        } else if (nobleAttacks.length === 0) {
            addLog('Žádný vlak (útoky jsou roztříštěné), jen označuji.', '#aabbff');
        }

        // --- 3. Označení vždy všech útoků ---
        await labelAttacksInUI();
    }

    // ============================================================
    //  SPUŠTĚNÍ + ODPOČET
    // ============================================================
    let nextRun;
    if (isNightMode) {
        nextRun = Math.floor(Math.random() * (nightMax - nightMin + 1) + nightMin);
        addLog('Aktivován noční útlum (52–78 min).', '#ffa500');
    } else {
        nextRun = Math.floor(Math.random() * (slowMax - slowMin + 1) + slowMin);
        addLog('Denní režim aktivní (3–22 min).');
    }

    run();

    let totalSeconds  = Math.floor(nextRun / 1000);
    const countdownEl = document.getElementById('brain-countdown');
    setInterval(() => {
        if (totalSeconds > 0) {
            const m = Math.floor(totalSeconds / 60);
            const s = totalSeconds % 60;
            countdownEl.innerText = `Další cyklus: ${m}:${s < 10 ? '0' : ''}${s}`;
            totalSeconds--;
        }
    }, 1000);

    setTimeout(() => { window.location.reload(); }, nextRun);

})();
