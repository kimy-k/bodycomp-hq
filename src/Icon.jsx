/* ═══ ICON SET ═══
   Thin-line custom SVG icons, ~37 named cases. No emoji at structural level.
   Usage: <Icon n="macros" s={20} c="var(--accent)" sw={1.5} /> */

export const Icon = ({n, s = 20, c = "currentColor", sw = 1.5}) => {
  const p = {width:s,height:s,viewBox:"0 0 24 24",fill:"none",stroke:c,strokeWidth:sw,strokeLinecap:"round",strokeLinejoin:"round",style:{flexShrink:0}};
  switch(n){
    case "macros": return <svg {...p}><path d="M3 12h18M5 12a7 7 0 0 0 14 0M8 8V5M12 8V5M16 8V5"/></svg>;
    case "peps": return <svg {...p}><path d="M9 3h6M10 3v6.5L7 14a4 4 0 0 0 6.7 4M14 3v6.5l3 4.5M8 13h8"/></svg>;
    case "body": return <svg {...p}><circle cx="12" cy="5.5" r="2.3"/><path d="M12 8v4M8 12h8M9 12l-1 9M15 12l1 9M10 16h4"/></svg>;
    case "whoop": return <svg {...p}><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 6.5 12.6"/></svg>;
    case "more": return <svg {...p}><circle cx="5.5" cy="12" r="1.2" fill={c} stroke="none"/><circle cx="12" cy="12" r="1.2" fill={c} stroke="none"/><circle cx="18.5" cy="12" r="1.2" fill={c} stroke="none"/></svg>;
    case "fat": return <svg {...p}><path d="M12 3c1.5 3 5 5 5 9a5 5 0 0 1-10 0c0-4 3.5-6 5-9z"/></svg>;
    case "muscle": return <svg {...p}><path d="M4 9c0-2 2-3 4-3h4l4 4-2 3-4-2-2 2v6c0 1.5-1 2.5-2.5 2.5S3 20.5 3 19v-2"/></svg>;
    case "scale": return <svg {...p}><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 11h.01M16 11h.01M12 11v4"/></svg>;
    case "target": return <svg {...p}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill={c}/></svg>;
    case "flame": return <svg {...p}><path d="M12 2c1 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4-1 4 2 5 2 5"/></svg>;
    case "star": return <svg {...p}><path d="M12 3l2.7 5.5 6 .9-4.4 4.3 1 6L12 17l-5.4 2.8 1-6-4.3-4.3 6-.9L12 3z"/></svg>;
    case "starFilled": return <svg {...p} fill={c}><path d="M12 3l2.7 5.5 6 .9-4.4 4.3 1 6L12 17l-5.4 2.8 1-6-4.3-4.3 6-.9L12 3z"/></svg>;
    case "edit": return <svg {...p}><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>;
    case "x": return <svg {...p}><path d="M5 5l14 14M19 5L5 19"/></svg>;
    case "plus": return <svg {...p}><path d="M12 5v14M5 12h14"/></svg>;
    case "check": return <svg {...p}><path d="M4 12l5 5L20 6"/></svg>;
    case "warn": return <svg {...p}><path d="M12 3l10 17H2L12 3zM12 10v4M12 17v.5"/></svg>;
    case "moon": return <svg {...p}><path d="M21 13a8 8 0 0 1-10-10 8 8 0 1 0 10 10z"/></svg>;
    case "sun": return <svg {...p}><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></svg>;
    case "arrowUp": return <svg {...p}><path d="M12 19V5M5 12l7-7 7 7"/></svg>;
    case "arrowDown": return <svg {...p}><path d="M12 5v14M19 12l-7 7-7-7"/></svg>;
    case "back": return <svg {...p}><path d="M19 12H5M12 19l-7-7 7-7"/></svg>;
    case "chevDown": return <svg {...p}><path d="M6 9l6 6 6-6"/></svg>;
    case "chevUp": return <svg {...p}><path d="M18 15l-6-6-6 6"/></svg>;
    case "pause": return <svg {...p}><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>;
    case "calendar": return <svg {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>;
    case "heart": return <svg {...p}><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/></svg>;
    case "sleep": return <svg {...p}><path d="M14 4a8 8 0 1 0 6 14 8 8 0 0 1-6-14z"/><path d="M16 5h4l-4 4h4"/></svg>;
    case "strain": return <svg {...p}><path d="M3 12h3l3-7 4 14 3-9 2 5h3"/></svg>;
    case "gear": return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h0a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v0a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>;
    case "camera": return <svg {...p}><path d="M3 8h3l2-3h8l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="4"/></svg>;
    case "ruler": return <svg {...p}><path d="M3 17l4-4 14-14a1 1 0 0 1 1.4 0l1.5 1.5a1 1 0 0 1 0 1.4l-14 14-4 4z"/><path d="M11 5l2 2M8 8l2 2M5 11l2 2M14 8l2 2M17 5l2 2"/></svg>;
    case "image": return <svg {...p}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5L7 20"/></svg>;
    case "compare": return <svg {...p}><rect x="3" y="5" width="8" height="14" rx="1"/><rect x="13" y="5" width="8" height="14" rx="1"/><path d="M12 3v18"/></svg>;
    case "trash": return <svg {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6"/></svg>;
    case "vial": return <svg {...p}><path d="M8 2h8M10 2v8l-3 6a3 3 0 0 0 3 4h4a3 3 0 0 0 3-4l-3-6V2M7 14h10"/></svg>;
    case "users": return <svg {...p}><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c.5-3.5 3-5 6-5s5.5 1.5 6 5M16 14c2.5 0 4.5 1.2 5 4"/></svg>;
    default: return null;
  }
};
