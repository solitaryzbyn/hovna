// ============================================================
//  COIN MINTER BOT - divokekmeny.cz
//  Automaticky razí zlaté mince jakmile jsou suroviny
//  Vložit do konzole prohlížeče na stránce Panského dvora
//  URL: /game.php?village=XXXXX&screen=snob
// ============================================================

(function () {
  'use strict';

  // ── KONFIGURACE ────────────────────────────────────────────
  const CONFIG = {
    // Cena jedné zlaté mince (suroviny)
    COST_WOOD:  28000,
    COST_STONE: 30000,
    COST_IRON:  25000,

    // Jak často kontrolovat suroviny (ms) – default 60 sekund
    CHECK_INTERVAL_MS: 60_000,

    // Minimální rezerva surovin která NEBUDE použita na ražení
    // Nastav na 0 pokud chceš razit ze všeho
    RESERVE_WOOD:  0,
    RESERVE_STONE: 0,
    RESERVE_IRON:  0,

    // Pokud true, bot razí pouze na stránce snob (bezpečnostní pojistka)
    ONLY_ON_SNOB_SCREEN: true,
  };
  // ──────────────────────────────────────────────────────────

  // ── STAV BOTU ─────────────────────────────────────────────
  let intervalId   = null;
  let cycleCount   = 0;
  let mintedTotal  = 0;
  let running      = false;
  // ──────────────────────────────────────────────────────────

  // ── POMOCNÉ FUNKCE ─────────────────────────────────────────

  function log(msg, color = '#FFD700') {
    const time = new Date().toLocaleTimeString('cs-CZ');
    console.log(`%c[COIN MINTER ${time}] ${msg}`, `color:${color}; font-weight:bold`);
  }

  function parseRes(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    return parseInt(el.textContent.replace(/\D/g, ''), 10) || 0;
  }

  function getResources() {
    return {
      wood:  parseRes('wood'),
      stone: parseRes('stone'),
      iron:  parseRes('iron'),
    };
  }

  function calcMaxCoins(res) {
    if (res.wood === null || res.stone === null || res.iron === null) return 0;
    const availWood  = Math.max(0, res.wood  - CONFIG.RESERVE_WOOD);
    const availStone = Math.max(0, res.stone - CONFIG.RESERVE_STONE);
    const availIron  = Math.max(0, res.iron  - CONFIG.RESERVE_IRON);
    return Math.floor(Math.min(
      availWood  / CONFIG.COST_WOOD,
      availStone / CONFIG.COST_STONE,
      availIron  / CONFIG.COST_IRON,
    ));
  }

  // Přečte maximální počet mincí které hra sama nabízí (odkaz "(N)")
  function getGameMax() {
    const el = document.getElementById('coin_mint_fill_max');
    if (!el) return null;
    const m = el.textContent.match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  }

  // Zkontroluje zda jsme na správné stránce s formulářem
  function isOnMintPage() {
    return !!(
      document.getElementById('coin_mint_count') &&
      document.querySelector('input[value="Razit"]')
    );
  }

  // Přejde na stránku ražení mincí (mode=coin)
  function navigateToMintPage() {
    const villageId = new URLSearchParams(location.search).get('village');
    if (!villageId) { log('❌ Nepodařilo se zjistit ID vesnice!', 'red'); return; }
    log('🔄 Přecházím na stránku ražení mincí...', '#aaa');
    location.href = `/game.php?village=${villageId}&screen=snob&mode=coin`;
  }

  // ── HLAVNÍ LOGIKA ──────────────────────────────────────────

  function tryMint() {
    cycleCount++;
    log(`🔍 Kontrola č.${cycleCount} – zjišťuji suroviny...`);

    // Bezpečnostní pojistka – správná obrazovka
    if (CONFIG.ONLY_ON_SNOB_SCREEN && !location.href.includes('screen=snob')) {
      log('⚠️ Nejsem na obrazovce Panského dvora, přeskakuji.', 'orange');
      return;
    }

    const res = getResources();
    log(`🪵 Dřevo: ${res.wood?.toLocaleString('cs-CZ') ?? '?'}  🪨 Kámen: ${res.stone?.toLocaleString('cs-CZ') ?? '?'}  ⚙️ Železo: ${res.iron?.toLocaleString('cs-CZ') ?? '?'}`);

    const calcMax = calcMaxCoins(res);

    if (calcMax <= 0) {
      log(`😴 Nedostatek surovin pro ražení. Zkusím znovu za ${CONFIG.CHECK_INTERVAL_MS / 1000}s.`, '#aaa');
      return;
    }

    log(`✅ Lze razit až ${calcMax} mincí – jdu razit!`, '#00FF99');

    // Pokud formulář není přítomen, přejdi na správnou stránku
    if (!isOnMintPage()) {
      navigateToMintPage();
      return;
    }

    // Přečti limit z hry (může být nižší než calcMax kvůli limitu šlechty)
    const gameMax = getGameMax();
    const toMint  = gameMax !== null ? Math.min(calcMax, gameMax) : calcMax;

    if (toMint <= 0) {
      log('ℹ️ Hra hlásí 0 mincí k ražení (limit šlechty asi dosažen).', 'orange');
      return;
    }

    // Vyplň počet a odešli formulář
    const countInput = document.getElementById('coin_mint_count');
    const submitBtn  = document.querySelector('input[value="Razit"]');
    const form       = submitBtn?.closest('form');

    if (!countInput || !submitBtn || !form) {
      log('❌ Formulář nenalezen! Zkouším přejít na stránku ražení.', 'red');
      navigateToMintPage();
      return;
    }

    countInput.value = toMint;
    mintedTotal += toMint;
    log(`🪙 Razím ${toMint} mincí (celkem v této session: ${mintedTotal})`, '#FFD700');

    form.submit();
  }

  // ── OVLÁDÁNÍ BOTU ──────────────────────────────────────────

  function start() {
    if (running) { log('⚠️ Bot již běží!', 'orange'); return; }
    running = true;
    log('🚀 COIN MINTER BOT spuštěn!');
    log(`⚙️  Interval: ${CONFIG.CHECK_INTERVAL_MS / 1000}s | Rezerva: ${CONFIG.RESERVE_WOOD}/${CONFIG.RESERVE_STONE}/${CONFIG.RESERVE_IRON}`);

    tryMint(); // první kontrola ihned
    intervalId = setInterval(tryMint, CONFIG.CHECK_INTERVAL_MS);
  }

  function stop() {
    if (!running) { log('⚠️ Bot neběží.', 'orange'); return; }
    clearInterval(intervalId);
    intervalId = null;
    running    = false;
    log(`🛑 Bot zastaven. Celkem vyraženo v session: ${mintedTotal} mincí.`, '#FF6666');
  }

  function status() {
    const res = getResources();
    const max = calcMaxCoins(res);
    log(`📊 STATUS:`);
    console.table({
      'Běží':           running,
      'Cyklů':          cycleCount,
      'Vyraženo':       mintedTotal,
      'Interval (s)':   CONFIG.CHECK_INTERVAL_MS / 1000,
      'Dřevo':          res.wood,
      'Kámen':          res.stone,
      'Železo':         res.iron,
      'Lze razit':      max,
    });
  }

  // ── VEŘEJNÉ API ────────────────────────────────────────────
  window.CoinMinter = { start, stop, status, CONFIG };

  // ── SPUŠTĚNÍ & NÁPOVĚDA ────────────────────────────────────
  console.log('%c╔══════════════════════════════════════╗', 'color:#FFD700');
  console.log('%c║      COIN MINTER BOT načten!         ║', 'color:#FFD700; font-weight:bold');
  console.log('%c╚══════════════════════════════════════╝', 'color:#FFD700');
  console.log('%cPříkazy:', 'color:#aaa; font-weight:bold');
  console.log('%c  CoinMinter.start()   – spustit bota',  'color:#00FF99');
  console.log('%c  CoinMinter.stop()    – zastavit bota', 'color:#FF6666');
  console.log('%c  CoinMinter.status()  – zobrazit stav', 'color:#88AAFF');
  console.log('%c  CoinMinter.CONFIG    – upravit nastavení', 'color:#FFAA00');

})();
