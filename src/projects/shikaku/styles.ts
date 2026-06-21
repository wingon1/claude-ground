// All styles are scoped under .shikaku-root and keyed off theme CSS variables,
// so equipping a theme restyles everything. Injected once by index.tsx.

export const STYLE_ID = 'shikaku-styles'

export const CSS = `
.shikaku-root {
  --radius: 16px;
  --gap: clamp(4px, 1.4vw, 7px);
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: center;
  background: var(--bg);
  color: var(--text);
  font-family: 'Inter', 'Varela Round', 'Pretendard', system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
  transition: background 0.45s ease, color 0.45s ease;
  user-select: none;
  -webkit-user-select: none;
  touch-action: manipulation;
}
.shikaku-root * { box-sizing: border-box; }

.sk-app {
  width: 100%;
  max-width: 480px;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0 16px;
  overflow-y: auto;
  overflow-x: hidden;
}

/* ---------- Header ---------- */
.sk-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 0 6px;
  flex-shrink: 0;
}
.sk-title {
  flex: 1;
  text-align: center;
  font-weight: 800;
  font-size: 18px;
  letter-spacing: 0.2px;
}
.sk-coin {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 800;
  font-size: 15px;
  background: var(--surface);
  padding: 7px 12px;
  border-radius: 999px;
  box-shadow: 0 2px 8px var(--shadow);
}
.sk-iconbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 14px;
  border: none;
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 2px 8px var(--shadow);
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.2s ease;
  flex-shrink: 0;
}
.sk-iconbtn:active { transform: scale(0.92); }

.sk-subheader {
  display: flex;
  justify-content: flex-end;
  padding: 4px 0 6px;
  flex-shrink: 0;
}
.sk-skip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  color: var(--text-soft);
  font-weight: 700;
  font-size: 13px;
  padding: 6px 10px;
  border-radius: 10px;
  cursor: pointer;
}
.sk-skip:active { transform: scale(0.95); }

/* ---------- Board ---------- */
.sk-board-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  min-height: 0;
  padding: 8px 0;
}
.sk-progresshint {
  font-weight: 700;
  font-size: 13px;
  color: var(--text-soft);
}
.sk-board {
  position: relative;
  width: min(90vw, 420px, 62vh);
  display: grid;
  gap: var(--gap);
  touch-action: none;
}
.sk-cell {
  position: relative;
  aspect-ratio: 1 / 1;
  background: var(--cell);
  border-radius: 12px;
  box-shadow: 0 2px 5px var(--shadow);
  display: flex;
  align-items: center;
  justify-content: center;
}
.shikaku-root.theme-mono .sk-cell {
  box-shadow: none;
  border: 1.5px solid var(--cell-line);
  border-radius: 4px;
}
.sk-clue {
  font-weight: 800;
  font-size: clamp(13px, 4.4vw, 22px);
  color: var(--text);
  z-index: 4;
  pointer-events: none;
}
.sk-block-clue { color: var(--block-text); }

/* Overlay blocks + preview share the board grid coordinates. */
.sk-overlay {
  border-radius: 12px;
  pointer-events: none;
}
.shikaku-root.theme-mono .sk-overlay { border-radius: 4px; }

.sk-block {
  z-index: 2;
  animation: sk-pop 0.22s cubic-bezier(.2,1.3,.5,1);
  box-shadow: inset 0 0 0 2px rgba(255,255,255,0.18), 0 3px 8px var(--shadow-strong);
  pointer-events: auto;
  cursor: default;
}
.shikaku-root.theme-mono .sk-block {
  box-shadow: inset 0 0 0 2px var(--text);
}
.sk-block.erasable { cursor: pointer; }

.sk-preview {
  z-index: 3;
  opacity: 0.55;
  box-shadow: inset 0 0 0 2px rgba(255,255,255,0.4);
}
.sk-preview.invalid {
  background: #E5484D !important;
  opacity: 0.4;
  animation: sk-shake 0.3s ease;
}

.sk-hint {
  z-index: 5;
  background: transparent !important;
  border: 3px dashed var(--accent);
  border-radius: 12px;
  animation: sk-pulse 1s ease infinite;
  pointer-events: none;
}
.shikaku-root.theme-mono .sk-hint { border-radius: 4px; }

@keyframes sk-pop { 0% { transform: scale(0.6); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
@keyframes sk-shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-4px); } 40% { transform: translateX(4px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(3px); } }
@keyframes sk-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
@keyframes sk-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes sk-rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }

/* ---------- Toolbar ---------- */
.sk-toolbar {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding: 14px 0 22px;
  flex-shrink: 0;
}
.sk-tool {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  width: 64px;
  height: 60px;
  border: none;
  border-radius: 16px;
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 3px 10px var(--shadow);
  cursor: pointer;
  transition: transform 0.12s ease, background 0.2s ease;
}
.sk-tool:active { transform: translateY(2px) scale(0.96); }
.sk-tool.active { background: var(--accent); color: var(--on-accent); }
.sk-tool:disabled { opacity: 0.4; cursor: default; }
.sk-tool-label { font-size: 10px; font-weight: 700; }
.sk-tool-cost {
  position: absolute;
  top: -6px;
  right: -4px;
  font-size: 10px;
  font-weight: 800;
  background: var(--accent);
  color: var(--on-accent);
  padding: 2px 6px;
  border-radius: 999px;
}

/* ---------- Level select ---------- */
.sk-tier-tabs {
  display: flex;
  gap: 8px;
  padding: 6px 0 14px;
  flex-shrink: 0;
}
.sk-tier-tab {
  flex: 1;
  border: none;
  border-radius: 14px;
  background: var(--surface);
  color: var(--text-soft);
  font-weight: 800;
  font-size: 14px;
  padding: 12px 0 10px;
  cursor: pointer;
  box-shadow: 0 2px 8px var(--shadow);
  transition: transform 0.12s ease;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sk-tier-tab small { font-size: 11px; font-weight: 700; opacity: 0.8; }
.sk-tier-tab.active { background: var(--accent); color: var(--on-accent); }
.sk-tier-tab:active { transform: scale(0.97); }

.sk-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
  padding: 4px 2px 28px;
}
.sk-tile {
  position: relative;
  aspect-ratio: 1 / 1;
  border: none;
  border-radius: 16px;
  background: var(--surface);
  color: var(--text);
  font-weight: 800;
  font-size: 17px;
  box-shadow: 0 3px 9px var(--shadow);
  cursor: pointer;
  transition: transform 0.12s ease;
}
.sk-tile:active { transform: scale(0.93); }
.sk-tile.cleared { background: var(--accent); color: var(--on-accent); }
.sk-tile-check {
  position: absolute;
  top: 5px;
  right: 5px;
}
.sk-hero {
  text-align: center;
  padding: 22px 0 6px;
}
.sk-hero h1 { font-size: 30px; font-weight: 800; margin: 0; letter-spacing: -0.5px; }
.sk-hero p { margin: 6px 0 0; color: var(--text-soft); font-weight: 600; font-size: 14px; }

/* ---------- Modal / Store / Win ---------- */
.sk-modal-back {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 50;
  animation: sk-fade 0.25s ease;
}
.sk-modal {
  width: 100%;
  max-width: 420px;
  max-height: 86%;
  overflow-y: auto;
  background: var(--bg);
  border-radius: 24px;
  padding: 20px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  animation: sk-rise 0.3s cubic-bezier(.2,1,.4,1);
}
.sk-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.sk-modal-head h2 { margin: 0; font-size: 20px; font-weight: 800; }

.sk-theme-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  border-radius: 18px;
  background: var(--surface);
  box-shadow: 0 2px 8px var(--shadow);
  margin-bottom: 12px;
}
.sk-swatches { display: flex; gap: 4px; }
.sk-swatch { width: 18px; height: 30px; border-radius: 6px; }
.sk-theme-info { flex: 1; }
.sk-theme-info strong { display: block; font-size: 15px; }
.sk-theme-info span { font-size: 12px; color: var(--text-soft); font-weight: 600; }
.sk-btn {
  border: none;
  border-radius: 12px;
  padding: 9px 16px;
  font-weight: 800;
  font-size: 13px;
  cursor: pointer;
  background: var(--accent);
  color: var(--on-accent);
  transition: transform 0.12s ease, opacity 0.2s ease;
  white-space: nowrap;
}
.sk-btn:active { transform: scale(0.95); }
.sk-btn.ghost { background: var(--surface); color: var(--text); box-shadow: inset 0 0 0 2px var(--cell-line); }
.sk-btn:disabled { opacity: 0.45; cursor: default; }
.sk-btn.equipped { background: transparent; color: var(--text-soft); box-shadow: inset 0 0 0 2px var(--cell-line); }

.sk-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px;
  border-radius: 18px;
  background: var(--surface);
  box-shadow: 0 2px 8px var(--shadow);
  font-weight: 700;
}

.sk-win {
  text-align: center;
  padding: 14px 6px 6px;
}
.sk-win .sk-burst { font-size: 54px; animation: sk-pop 0.4s cubic-bezier(.2,1.4,.5,1); }
.sk-win h2 { margin: 8px 0 2px; font-size: 26px; font-weight: 800; }
.sk-win .sk-reward {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 20px;
  font-weight: 800;
  margin: 14px 0 18px;
  padding: 8px 18px;
  border-radius: 999px;
  background: var(--surface);
  box-shadow: 0 2px 8px var(--shadow);
}
.sk-win-actions { display: flex; gap: 10px; }
.sk-win-actions .sk-btn { flex: 1; padding: 13px 0; font-size: 14px; }

.sk-tut-step {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 14px;
  border-radius: 16px;
  background: var(--surface);
  box-shadow: 0 2px 8px var(--shadow);
  margin-bottom: 10px;
  font-weight: 700;
  font-size: 14px;
  line-height: 1.35;
}
.sk-tut-icon { font-size: 24px; flex-shrink: 0; }

.sk-toast {
  position: absolute;
  bottom: 26px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--text);
  color: var(--bg);
  padding: 10px 18px;
  border-radius: 999px;
  font-weight: 700;
  font-size: 13px;
  z-index: 80;
  animation: sk-rise 0.25s ease;
  box-shadow: 0 6px 20px rgba(0,0,0,0.25);
}
`
