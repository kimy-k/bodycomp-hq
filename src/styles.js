/* ═══ TYPOGRAPHY + DESIGN TOKENS + ANIMATIONS ═══
   Single CSS template literal injected via <style>{STYLE}</style> at app root.
   All design system values live here: OKLCH palette, type scale, motion tokens. */

export const FONT_URL="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap";
export const STYLE=`@import url('${FONT_URL}');
:root{
  --bg: oklch(0.16 0.014 285);
  --bg-rad-1: oklch(0.22 0.06 295);
  --bg-rad-2: oklch(0.20 0.05 30);
  --elev-1: oklch(0.21 0.018 285);
  --elev-2: oklch(0.25 0.020 285);
  --elev-3: oklch(0.29 0.022 285);
  --line: oklch(0.30 0.020 285 / 0.55);
  --line-soft: oklch(0.30 0.020 285 / 0.30);
  --t-1: oklch(0.97 0.008 80);
  --t-2: oklch(0.72 0.018 80);
  --t-3: oklch(0.55 0.022 285);
  --t-4: oklch(0.42 0.020 285);
  --t-5: oklch(0.34 0.018 285);
  --accent: oklch(0.78 0.17 158);
  --accent-soft: oklch(0.78 0.17 158 / 0.14);
  --accent-line: oklch(0.78 0.17 158 / 0.30);
  --c-protein: oklch(0.74 0.17 25);
  --c-fat: oklch(0.83 0.14 80);
  --c-carbs: oklch(0.77 0.14 215);
  --c-cal: oklch(0.78 0.16 295);
  --c-muscle: oklch(0.78 0.17 150);
  --c-bodyfat: oklch(0.72 0.18 10);
  --c-weight: oklch(0.76 0.16 295);
  --c-warn: oklch(0.80 0.16 75);
  --c-danger: oklch(0.68 0.20 25);
  --c-success: oklch(0.76 0.18 158);
  --c-streak: oklch(0.78 0.18 55);
  --nav-bg: oklch(0.16 0.014 285 / 0.78);
  --tip-bg: oklch(0.18 0.018 285 / 0.96);
  --r-xs: 8px; --r-sm: 12px; --r-md: 16px; --r-lg: 20px; --r-xl: 28px;
  --shadow-1: 0 1px 0 oklch(1 0 0 / 0.04) inset, 0 8px 24px oklch(0.05 0.01 285 / 0.40);
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
.rise{animation:riseIn 0.55s var(--ease-out) both}
.r1{animation-delay:.04s}.r2{animation-delay:.10s}.r3{animation-delay:.16s}.r4{animation-delay:.22s}.r5{animation-delay:.28s}.r6{animation-delay:.34s}
.fade{animation:fadeIn 0.5s var(--ease-out) both}
.sheet{animation:sheetUp 0.45s var(--ease-ios) both}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;padding:0;background:var(--bg);color:var(--t-1)}
body{font-family:"Geist",-apple-system,BlinkMacSystemFont,sans-serif;font-feature-settings:"ss01","cv11";-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
input,button,select,textarea{font-family:inherit;font-feature-settings:inherit}
input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
input[type=number]{-moz-appearance:textfield}
.serif{font-family:"Instrument Serif",serif;font-weight:400;letter-spacing:-0.02em}
.mono{font-family:"Geist Mono",ui-monospace,monospace;font-feature-settings:"tnum"}
.tabular{font-variant-numeric:tabular-nums}
::selection{background:var(--accent-soft);color:var(--t-1)}
.bcq-app{min-height:100vh;background:radial-gradient(120% 60% at 50% -10%,var(--bg-rad-1) 0%,transparent 55%),radial-gradient(80% 40% at 80% 0%,var(--bg-rad-2) 0%,transparent 60%),var(--bg);padding:18px 16px calc(96px + env(safe-area-inset-bottom,0px));max-width:520px;margin:0 auto;font-family:"Geist",sans-serif}
.bcq-nav{position:fixed;bottom:0;left:0;right:0;z-index:99;background:var(--nav-bg);backdrop-filter:blur(28px) saturate(180%);-webkit-backdrop-filter:blur(28px) saturate(180%);border-top:1px solid var(--line);padding:8px 0 calc(8px + env(safe-area-inset-bottom,0px));max-width:520px;margin:0 auto}
.bcq-input{width:100%;padding:12px 14px;border-radius:var(--r-sm);border:1px solid var(--line);background:var(--elev-2);color:var(--t-1);font-size:15px;font-family:"Geist",sans-serif;outline:none;transition:border-color .2s var(--ease-out),background .2s var(--ease-out)}
.bcq-input:focus{border-color:var(--accent-line);background:var(--elev-3)}
.bcq-input::placeholder{color:var(--t-4)}
.touch{min-height:44px;min-width:44px;display:flex;align-items:center;justify-content:center}
button{font-family:inherit;color:inherit}
.ring-pulse{animation:pulseRing 2.5s var(--ease-out) infinite}
.hbar{height:6px;border-radius:3px;background:var(--elev-2);overflow:hidden;position:relative}
.hbar > i{display:block;height:100%;border-radius:3px;transition:width 0.8s var(--ease-out)}
`;
