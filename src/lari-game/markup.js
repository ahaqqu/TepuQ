// TepuQ Lari stage markup (injected into #lariStage).
export const LARI_MARKUP = `<div id="game-wrap">
    <div id="loading">Memuat dunia 3D…</div>
    <canvas id="game-canvas"></canvas>
    <div id="hit-flash"></div>
    <div id="hit-popup"></div>
    <div id="learn-popup"><div class="word"></div><span class="spell"></span></div>
    <div id="cheer-popup"><div class="cheer-word"></div><span class="cheer-sub"></span></div>

    <div id="hud">
      <div class="hud-pill"><span class="label">Score</span><span id="score-value">0</span></div>
      <div class="hud-pill stars"><span class="label">Items</span><span id="stars-value">0</span></div>
      <div class="hud-pill hearts"><span class="label">Hearts</span><span id="hearts-value">3</span></div>
      <div class="hud-pill speed"><span class="label">Speed</span><span id="speed-value">1×</span></div>
    </div>

    <button id="pause-btn" type="button" aria-label="Pause">
      <div class="bars"><div class="bar"></div><div class="bar"></div></div>
    </button>

    <div id="touch-pad" aria-label="Touch controls">
      <button type="button" class="pad-btn left" data-act="left" aria-label="Move left">⬅️</button>
      <button type="button" class="pad-btn jump" data-act="jump" aria-label="Lompat">⬆️</button>
      <button type="button" class="pad-btn slide" data-act="slide" aria-label="Geser">⬇️</button>
      <button type="button" class="pad-btn right" data-act="right" aria-label="Move right">➡️</button>
    </div>

    <div id="start-overlay" class="overlay">
      <div class="title-art">TepuQ Lari<span>Lari &amp; Kumpulkan!</span></div>
      <p class="subtitle">Lari, dengar nama benda, &amp; kumpulkan bintang!<br />Kucing, anjing, susu, pisang &amp; lainnya.</p>
      <div class="mode-row" role="group" aria-label="Game mode">
        <button type="button" class="mode-btn active" id="mode-forever">
          🌈 Main Terus
          <span class="tiny">Tanpa game over · untuk anak kecil</span>
        </button>
        <button type="button" class="mode-btn" id="mode-hearts">
          💖 3 Hati
          <span class="tiny">Sedikit tantangan</span>
        </button>
      </div>
      <button id="start-btn" class="big-btn" type="button">MULAI!</button>
      <button type="button" class="big-btn secondary" data-lari-menu>‹ Pilih Game</button>
      <div class="control-hints">
        <div class="hint-chip">⬅️➡️ Ganti jalur</div>
        <div class="hint-chip">⬆️ Lompat</div>
        <div class="hint-chip">⬇️ Geser</div>
        <div class="hint-chip">👆 Geser / tekan tombol</div>
        <div class="hint-chip">🔊 Dengar kata</div>
      </div>
    </div>

    <div id="pause-overlay" class="overlay hidden">
      <div class="title-art">Jeda</div>
      <button id="resume-btn" class="big-btn" type="button">LANJUT</button>
      <button id="quit-btn" class="big-btn secondary" type="button">‹ Pilih Game</button>
    </div>

    <div id="gameover-overlay" class="overlay hidden">
      <div class="title-art">Hore!</div>
      <div class="score-display"><span id="final-score">0</span><span class="sub">poin</span></div>
      <p class="celebrate" id="celebrate-text">Hebat, Kelinci!</p>
      <button id="retry-btn" class="big-btn" type="button">MAIN LAGI!</button>
      <button id="home-btn" class="big-btn secondary" type="button">‹ Pilih Game</button>
    </div>
  </div>`;
