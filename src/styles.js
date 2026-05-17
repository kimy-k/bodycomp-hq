/* ═══ TYPOGRAPHY + DESIGN TOKENS + ANIMATIONS ═══
   Single CSS template literal injected via <style>{STYLE}</style> at app root.
   All design system values live here: OKLCH palette, type scale, motion tokens. */

export const FONT_URL="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap";
export const STYLE=`@import url('${FONT_URL}');
:root{
  /* ═══ PHASE 1 — WHOOP-STYLE PALETTE ═══
     Background: pure black + near-black elevations.
     Accent: cyan #00E5FF. Telemetry secondary: red for strain/danger.
     Old sage tokens still exist via --legacy-sage if any leftover code wants it. */
  --bg: #000000;
  --bg-rad-1: rgba(0, 229, 255, 0.05);
  --bg-rad-2: rgba(0, 229, 255, 0.02);
  --elev-1: #0a0a0a;
  --elev-2: #141414;
  --elev-3: #1c1c1c;
  --line: rgba(255, 255, 255, 0.10);
  --line-soft: rgba(255, 255, 255, 0.06);
  --t-1: #ffffff;
  --t-2: rgba(255, 255, 255, 0.72);
  --t-3: rgba(255, 255, 255, 0.50);
  --t-4: rgba(255, 255, 255, 0.32);
  --t-5: rgba(255, 255, 255, 0.18);
  --accent: #00E5FF;
  --accent-soft: rgba(0, 229, 255, 0.10);
  --accent-line: rgba(0, 229, 255, 0.30);
  --legacy-sage: oklch(0.78 0.17 158);
  --c-protein: oklch(0.74 0.17 25);
  --c-fat: oklch(0.83 0.14 80);
  --c-carbs: oklch(0.77 0.14 215);
  --c-cal: oklch(0.78 0.16 295);
  --c-muscle: oklch(0.78 0.17 150);
  --c-bodyfat: #00E5FF;
  --c-weight: oklch(0.76 0.16 295);
  --c-warn: oklch(0.80 0.16 75);
  --c-danger: #FF3D3D;
  --c-success: #00E5FF;
  --c-streak: #00E5FF;
  --nav-bg: rgba(10, 10, 10, 0.92);
  --tip-bg: rgba(10, 10, 10, 0.96);
  --r-xs: 6px; --r-sm: 10px; --r-md: 14px; --r-lg: 18px; --r-xl: 24px;
  --shadow-1: 0 1px 0 rgba(255, 255, 255, 0.02) inset, 0 8px 24px rgba(0, 0, 0, 0.6);
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-quart: cubic-bezier(0.25, 1, 0.5, 1);
  --ease-ios: cubic-bezier(0.32, 0.72, 0, 1);
}
:root[data-theme="light"]{
  --bg: oklch(0.97 0.004 285);
  --bg-rad-1: oklch(0.95 0.03 295);
  --bg-rad-2: oklch(0.96 0.025 30);
  --elev-1: oklch(0.995 0.002 285);
  --elev-2: oklch(0.94 0.006 285);
  --elev-3: oklch(0.90 0.008 285);
  --line: oklch(0.55 0.012 285 / 0.22);
  --line-soft: oklch(0.55 0.012 285 / 0.10);
  --t-1: oklch(0.18 0.014 285);
  --t-2: oklch(0.34 0.016 285);
  --t-3: oklch(0.48 0.018 285);
  --t-4: oklch(0.62 0.016 285);
  --t-5: oklch(0.75 0.012 285);
  --accent: oklch(0.52 0.16 158);
  --accent-soft: oklch(0.52 0.16 158 / 0.10);
  --accent-line: oklch(0.52 0.16 158 / 0.32);
  --c-protein: oklch(0.55 0.20 25);
  --c-fat: oklch(0.62 0.16 80);
  --c-carbs: oklch(0.52 0.16 215);
  --c-cal: oklch(0.52 0.19 295);
  --c-muscle: oklch(0.52 0.18 150);
  --c-bodyfat: oklch(0.54 0.20 10);
  --c-weight: oklch(0.52 0.18 295);
  --c-warn: oklch(0.55 0.16 65);
  --c-danger: oklch(0.55 0.22 25);
  --c-success: oklch(0.52 0.18 158);
  --c-streak: oklch(0.58 0.19 55);
  --nav-bg: oklch(0.995 0.002 285 / 0.82);
  --tip-bg: oklch(0.995 0.002 285 / 0.96);
  --shadow-1: 0 1px 2px oklch(0.20 0 0 / 0.06), 0 8px 24px oklch(0.20 0 0 / 0.08);
}
@keyframes riseIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes sheetUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes pulseRing{0%,100%{box-shadow:0 0 0 0 var(--accent-soft)}50%{box-shadow:0 0 0 6px transparent}}
@keyframes ring-pulse{0%,100%{filter:drop-shadow(0 0 14px rgba(0,229,255,0.35))}50%{filter:drop-shadow(0 0 24px rgba(0,229,255,0.55))}}
@keyframes status-dot-pulse{0%,100%{box-shadow:0 0 5px rgba(0,229,255,0.6)}50%{box-shadow:0 0 11px rgba(0,229,255,0.9)}}
.rise{animation:riseIn 0.55s var(--ease-out) both}
.r1{animation-delay:.04s}.r2{animation-delay:.10s}.r3{animation-delay:.16s}.r4{animation-delay:.22s}.r5{animation-delay:.28s}.r6{animation-delay:.34s}
.fade{animation:fadeIn 0.5s var(--ease-out) both}
.sheet{animation:sheetUp 0.45s var(--ease-ios) both}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;padding:0;background:var(--bg);color:var(--t-1)}
body{font-family:"Inter",-apple-system,BlinkMacSystemFont,sans-serif;font-feature-settings:"ss01","ss03";-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
input,button,select,textarea{font-family:inherit;font-feature-settings:inherit}
input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
input[type=number]{-moz-appearance:textfield}
/* Phase 1: `.serif` is no longer serif — redirected to Inter bold to match Concept C.
   `!important` on font-family, weight, and font-style overrides all legacy inline italic + 400 weight
   so every Card, big display number, and h2/h3 across the app picks up the Whoop typography. */
.serif{font-family:"Inter",ui-sans-serif,system-ui,sans-serif !important;font-weight:700 !important;font-style:normal !important;letter-spacing:-0.025em}
.serif.tabular,.tabular{font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1}
.mono{font-family:"Geist Mono",ui-monospace,monospace;font-feature-settings:"tnum"}
.tabular{font-variant-numeric:tabular-nums}
::selection{background:var(--accent-soft);color:var(--t-1)}
.bcq-app{min-height:100vh;background:radial-gradient(120% 60% at 50% -10%,var(--bg-rad-1) 0%,transparent 55%),radial-gradient(80% 40% at 80% 0%,var(--bg-rad-2) 0%,transparent 60%),var(--bg);padding:18px 16px calc(96px + env(safe-area-inset-bottom,0px));max-width:520px;margin:0 auto;font-family:"Inter",sans-serif}
.bcq-nav{position:fixed;bottom:0;left:0;right:0;z-index:99;background:var(--nav-bg);backdrop-filter:blur(28px) saturate(180%);-webkit-backdrop-filter:blur(28px) saturate(180%);border-top:1px solid var(--line);padding:8px 0 calc(8px + env(safe-area-inset-bottom,0px));max-width:520px;margin:0 auto}
.bcq-input{width:100%;padding:12px 14px;border-radius:var(--r-sm);border:1px solid var(--line);background:var(--elev-2);color:var(--t-1);font-size:15px;font-family:"Inter",sans-serif;outline:none;transition:border-color .2s var(--ease-out),background .2s var(--ease-out)}
.bcq-input:focus{border-color:var(--accent-line);background:var(--elev-3)}
.bcq-input::placeholder{color:var(--t-4)}
.touch{min-height:44px;min-width:44px;display:flex;align-items:center;justify-content:center}
button{font-family:inherit;color:inherit}
.ring-pulse{animation:pulseRing 2.5s var(--ease-out) infinite}
.hbar{height:6px;border-radius:3px;background:var(--elev-2);overflow:hidden;position:relative}
.hbar > i{display:block;height:100%;border-radius:3px;transition:width 0.8s var(--ease-out)}

/* ═══════════════════════════════════════════════════════════════════════════
   V2 SCOPE — Phase 1 "premium Whoop" aesthetic.
   Applied via class="v2-scope" on the Overview tab wrapper.
   Tokens here override the OKLCH sage tokens for descendant elements ONLY.
   Other tabs (Macros, Peps, Whoop, More) continue to use the root tokens. */
.v2-scope{
  --v2-bg: #000000;
  --v2-elev-0: #050505;
  --v2-elev-1: #0a0a0a;
  --v2-elev-2: #141414;
  --v2-line: rgba(255,255,255,0.08);
  --v2-line-mid: rgba(255,255,255,0.14);
  --v2-t-1: #ffffff;
  --v2-t-2: rgba(255,255,255,0.72);
  --v2-t-3: rgba(255,255,255,0.50);
  --v2-t-4: rgba(255,255,255,0.32);
  --v2-cyan: #00E5FF;
  --v2-cyan-soft: rgba(0,229,255,0.10);
  --v2-cyan-line: rgba(0,229,255,0.30);
  --v2-red: #FF3D3D;
  --v2-amber: #FFB020;
  --v2-r-sm: 8px;
  --v2-r-md: 12px;
  --v2-r-lg: 18px;
  color: var(--v2-t-1);
  font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
  letter-spacing: -0.005em;
}
.v2-scope .v2-mono{font-family:'JetBrains Mono',ui-monospace,monospace;letter-spacing:0}
.v2-scope .v2-cap{text-transform:uppercase;letter-spacing:0.14em;font-weight:600}
@keyframes v2-pulse-ring{
  0%,100%{filter:drop-shadow(0 0 16px rgba(0,229,255,0.40))}
  50%   {filter:drop-shadow(0 0 28px rgba(0,229,255,0.65))}
}
@keyframes v2-pulse-dot{
  0%,100%{box-shadow:0 0 6px var(--v2-cyan)}
  50%   {box-shadow:0 0 12px var(--v2-cyan)}
}
@keyframes v2-ambient-glow{
  0%,100%{box-shadow:inset 0 0 0 1px var(--v2-line), 0 0 0 0 rgba(0,229,255,0.0)}
  50%   {box-shadow:inset 0 0 0 1px var(--v2-cyan-line), 0 0 32px -12px rgba(0,229,255,0.45)}
}
.v2-pulse-ring{animation:v2-pulse-ring 3.2s ease-in-out infinite}
.v2-pulse-dot{animation:v2-pulse-dot 2.4s ease-in-out infinite}
.v2-ambient-glow{animation:v2-ambient-glow 5s ease-in-out infinite}
`;
