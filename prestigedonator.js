// ============================================================
//  PRESTIGE AUTO-DONATOR  —  divokekmeny.cz
//  Vložit do konzole na stránce: screen=ally&mode=level
// ============================================================

(function () {
  'use strict';

  // ── Zabraň dvojitému spuštění ──────────────────────────────
  if (window.__prestigeDonatorRunning) {
    console.warn('[PrestigeDonator] Skript již běží.');
    return;
  }
  window.__prestigeDonatorRunning = true;

  // ══════════════════════════════════════════════════════════
  //  POMOCNÉ FUNKCE
  // ══════════════════════════════════════════════════════════

  function getCurrentPrestige() {
    const el = document.querySelector('.tribe-currency-widget .balance');
    if (!el) return null;
    return parseInt(el.textContent.replace(/\s/g, ''), 10);
  }

  function log(msg, type = 'info') {
    const box = document.getElementById('pd-log');
    if (!box) return;
    const colors = { info: '#ccc', ok: '#44ff88', warn: '#ffcc44', err: '#ff4444' };
    const time = new Date().toLocaleTimeString('cs-CZ');
    box.innerHTML = `<div style="color:${colors[type]||'#ccc'};margin-bottom:3px;">[${time}] ${msg}</div>` + box.innerHTML;
  }

  function setStatus(text, color = '#aaa') {
    const el = document.getElementById('pd-status');
    if (el) { el.textContent = text; el.style.color = color; }
  }

  // ══════════════════════════════════════════════════════════
  //  JÁDRO — darování prestiže
  // ══════════════════════════════════════════════════════════

  async function donateCycle(keepAmount) {
    const current = getCurrentPrestige();
    if (current === null) {
      log('Nelze načíst prestiž – jsi na správné stránce?', 'err');
      return false;
    }

    const toGive = current - keepAmount;
    if (toGive <= 0) {
      log(`Prestiž ${current} ≤ záloha ${keepAmount}. Nic k darování.`, 'warn');
      setStatus(`Prestiž: ${current} — nic k darování`, '#ffcc44');
      return false;
    }

    log(`Prestiž: ${current} | Záloha: ${keepAmount} | Daruji: ${toGive}`, 'info');
    setStatus(`Daruji ${toGive} prestiže…`, '#88ccff');

    // 1) Klikni na tlačítko "Darovat" (otevře popup)
    const openBtn = document.querySelector('a.donate_button');
    if (!openBtn) { log('Tlačítko "Darovat" nenalezeno.', 'err'); return false; }
    openBtn.click();
    await sleep(700);

    // 2) Najdi popup a input
    const popup = document.querySelector('.popup_box_container[data-id="tribe-xp-purchase"] .popup_box.show');
    if (!popup) { log('Popup se neotevřel.', 'err'); return false; }

    const input = popup.querySelector('input.donate_amount');
    if (!input) { log('Input v popupu nenalezen.', 'err'); return false; }

    // 3) Vyplň hodnotu (React/Vue-friendly způsob)
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeInputValueSetter.call(input, toGive);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(300);

    // 4) Klikni na potvrzovací "Darovat" uvnitř popupu
    const confirmBtn = popup.querySelector('a.donate_button');
    if (!confirmBtn) { log('Potvrzovací tlačítko nenalezeno.', 'err'); return false; }
    confirmBtn.click();
    await sleep(1000);

    // 5) Ověř výsledek
    const newPrestige = getCurrentPrestige();
    if (newPrestige !== null && newPrestige <= keepAmount + 5) {
      log(`✓ Darováno! Nová prestiž: ${newPrestige}`, 'ok');
      setStatus(`Hotovo! Prestiž: ${newPrestige}`, '#44ff88');
      return true;
    } else {
      log(`Prestiž po darování: ${newPrestige} — zkontroluj ručně.`, 'warn');
      setStatus(`Prestiž: ${newPrestige}`, '#ffcc44');
      return false;
    }
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ══════════════════════════════════════════════════════════
  //  AUTO-MODE — opakované darování v intervalu
  // ══════════════════════════════════════════════════════════

  let autoTimer = null;

  function startAuto(keepAmount, intervalMin) {
    stopAuto();
    log(`Auto-mode spuštěn: záloha=${keepAmount}, interval=${intervalMin} min`, 'ok');
    const ms = intervalMin * 60 * 1000;

    const run = async () => {
      await donateCycle(keepAmount);
      autoTimer = setTimeout(run, ms);
      const next = new Date(Date.now() + ms).toLocaleTimeString('cs-CZ');
      setStatus(`Auto-mode | Další darování: ${next}`, '#88ccff');
    };
    run();
  }

  function stopAuto() {
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
  }

  // ══════════════════════════════════════════════════════════
  //  UI DASHBOARD
  // ══════════════════════════════════════════════════════════

  // Odstraň starou instanci
  const old = document.getElementById('pd-root');
  if (old) old.remove();

  const root = document.createElement('div');
  root.id = 'pd-root';
  root.innerHTML = `
    <style>
      #pd-root {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 99999;
        width: 300px;
        font-family: 'Segoe UI', sans-serif;
        font-size: 12px;
      }
      #pd-panel {
        background: linear-gradient(160deg, #1a0000 0%, #2d0606 40%, #1a0000 100%);
        border: 1px solid #7a1010;
        border-radius: 6px;
        box-shadow: 0 0 20px rgba(180,20,20,0.4), inset 0 1px 0 rgba(255,80,80,0.1);
        overflow: hidden;
      }
      #pd-header {
        background: linear-gradient(90deg, #3d0000, #6b1111, #3d0000);
        padding: 8px 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: move;
        border-bottom: 1px solid #7a1010;
      }
      #pd-header h3 {
        margin: 0;
        color: #ff4444;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 2px;
        text-transform: uppercase;
        text-shadow: 0 0 8px rgba(255,50,50,0.7);
      }
      #pd-toggle {
        color: #aaa;
        cursor: pointer;
        font-size: 14px;
        font-weight: bold;
        background: none;
        border: none;
        padding: 0;
      }
      #pd-body {
        padding: 12px;
      }
      .pd-row {
        margin-bottom: 10px;
      }
      .pd-label {
        color: #cc8888;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 4px;
      }
      .pd-input {
        width: 100%;
        box-sizing: border-box;
        background: rgba(0,0,0,0.5);
        border: 1px solid #7a1010;
        border-radius: 3px;
        color: #ffcccc;
        padding: 5px 8px;
        font-size: 12px;
        outline: none;
      }
      .pd-input:focus { border-color: #ff4444; box-shadow: 0 0 5px rgba(255,50,50,0.3); }
      .pd-btn {
        width: 100%;
        padding: 7px;
        border-radius: 4px;
        border: 1px solid;
        cursor: pointer;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        transition: all .15s;
      }
      #pd-btn-now {
        background: linear-gradient(135deg, #4d0000, #8b0000);
        border-color: #cc2222;
        color: #ffaaaa;
        margin-bottom: 6px;
      }
      #pd-btn-now:hover { background: linear-gradient(135deg, #6b0000, #aa0000); box-shadow: 0 0 8px rgba(255,0,0,0.4); }
      #pd-btn-auto {
        background: linear-gradient(135deg, #1a0a00, #4d2200);
        border-color: #884400;
        color: #ffcc88;
        margin-bottom: 6px;
      }
      #pd-btn-auto:hover { background: linear-gradient(135deg, #2a1200, #6b3300); }
      #pd-btn-stop {
        background: linear-gradient(135deg, #001a00, #003300);
        border-color: #006600;
        color: #88ff88;
      }
      #pd-btn-stop:hover { background: linear-gradient(135deg, #002200, #004400); }
      #pd-status {
        font-size: 10px;
        color: #aaa;
        text-align: center;
        margin: 8px 0 4px;
        min-height: 14px;
      }
      #pd-prestige-display {
        text-align: center;
        font-size: 11px;
        color: #ffcc44;
        margin-bottom: 8px;
      }
      #pd-log {
        background: rgba(0,0,0,0.6);
        border: 1px solid #3a0000;
        border-radius: 3px;
        padding: 6px;
        height: 100px;
        overflow-y: auto;
        font-size: 10px;
        line-height: 1.5;
        margin-top: 8px;
      }
      #pd-log::-webkit-scrollbar { width: 4px; }
      #pd-log::-webkit-scrollbar-track { background: #1a0000; }
      #pd-log::-webkit-scrollbar-thumb { background: #7a1010; border-radius: 2px; }
      .pd-divider { border: none; border-top: 1px solid #3a0000; margin: 10px 0; }
    </style>

    <div id="pd-panel">
      <div id="pd-header">
        <h3>⚔ Prestige Donator</h3>
        <button id="pd-toggle">[-]</button>
      </div>
      <div id="pd-body">
        <div id="pd-prestige-display">Prestiž: načítám…</div>

        <div class="pd-row">
          <div class="pd-label">Záloha prestiže (ponechat)</div>
          <input type="number" id="pd-keep" class="pd-input" value="0" min="0" placeholder="0">
        </div>

        <button id="pd-btn-now" class="pd-btn">⚔ Darovat nyní</button>

        <hr class="pd-divider">

        <div class="pd-row">
          <div class="pd-label">Auto-interval (minuty)</div>
          <input type="number" id="pd-interval" class="pd-input" value="60" min="1" placeholder="60">
        </div>

        <button id="pd-btn-auto" class="pd-btn">▶ Spustit auto-mode</button>
        <button id="pd-btn-stop" class="pd-btn">■ Zastavit auto-mode</button>

        <div id="pd-status">Čekám na instrukce…</div>
        <div id="pd-log"></div>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  // ── Zobraz aktuální prestiž ──────────────────────────────
  function refreshPrestigeDisplay() {
    const p = getCurrentPrestige();
    const el = document.getElementById('pd-prestige-display');
    if (el) el.textContent = p !== null ? `Aktuální prestiž: ${p}` : 'Prestiž: nenalezena';
  }
  refreshPrestigeDisplay();
  setInterval(refreshPrestigeDisplay, 5000);

  // ── Přetahování panelu ───────────────────────────────────
  (function makeDraggable() {
    const panel = document.getElementById('pd-root');
    const header = document.getElementById('pd-header');
    let ox = 0, oy = 0, dragging = false;
    header.addEventListener('mousedown', e => {
      dragging = true;
      ox = e.clientX - panel.getBoundingClientRect().left;
      oy = e.clientY - panel.getBoundingClientRect().top;
    });
    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      panel.style.left = (e.clientX - ox) + 'px';
      panel.style.top = (e.clientY - oy) + 'px';
    });
    document.addEventListener('mouseup', () => { dragging = false; });
  })();

  // ── Minimalizace ─────────────────────────────────────────
  document.getElementById('pd-toggle').addEventListener('click', function () {
    const body = document.getElementById('pd-body');
    const collapsed = body.style.display === 'none';
    body.style.display = collapsed ? 'block' : 'none';
    this.textContent = collapsed ? '[-]' : '[+]';
  });

  // ── Tlačítko: Darovat nyní ───────────────────────────────
  document.getElementById('pd-btn-now').addEventListener('click', async function () {
    const keep = parseInt(document.getElementById('pd-keep').value, 10) || 0;
    this.disabled = true;
    await donateCycle(keep);
    this.disabled = false;
  });

  // ── Tlačítko: Spustit auto-mode ──────────────────────────
  document.getElementById('pd-btn-auto').addEventListener('click', function () {
    const keep = parseInt(document.getElementById('pd-keep').value, 10) || 0;
    const interval = parseInt(document.getElementById('pd-interval').value, 10) || 60;
    startAuto(keep, interval);
  });

  // ── Tlačítko: Zastavit auto-mode ─────────────────────────
  document.getElementById('pd-btn-stop').addEventListener('click', function () {
    stopAuto();
    log('Auto-mode zastaven.', 'warn');
    setStatus('Auto-mode zastaven.', '#ffcc44');
  });

  log('Skript načten. Nastav zálohu a klikni na tlačítko.', 'ok');
  console.log('[PrestigeDonator] ✓ Dashboard spuštěn.');
})();
