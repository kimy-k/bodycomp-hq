/* ═══ BCQ DATA ═══
   All shared constants + pure config-derivation helpers.
   No React, no DOM, no fetch. Importable from anywhere. */

export const PROFILES ={
  kim:{name:"Kim",emoji:"👑",targets:{cal:1440,protein:150,fat:45,carbs:109},showPeptides:true,showScans:true},
  bernadette:{name:"Bernadette",emoji:"💜",targets:{cal:1600,protein:120,fat:50,carbs:150},showPeptides:true,showScans:false},
};

/* ═══ SCAN DATA ═══ */
export const SCANS = [
  {date:"2023-05-06",weight:56.4,muscle:16.2,fatPct:45.3,height:152},
  {date:"2025-03-09",weight:57.6,muscle:18.9,fatPct:38.5,height:155},
  {date:"2025-03-23",weight:56.8,muscle:17.9,fatPct:40.8,height:155},
  {date:"2025-04-04",weight:56.7,muscle:18.3,fatPct:39.7,height:155},
  {date:"2025-04-13",weight:57.5,muscle:18.7,fatPct:39.1,height:155},
  {date:"2025-04-25",weight:57.8,muscle:18.4,fatPct:40.2,height:155},
  {date:"2025-05-22",weight:57.1,muscle:17.4,fatPct:42.9,height:155},
  {date:"2026-02-07",weight:56.9,muscle:18.5,fatPct:39.5,height:155},
  {date:"2026-02-14",weight:57.5,muscle:18.5,fatPct:40.2,height:155},
  {date:"2026-02-21",weight:56.2,muscle:18.5,fatPct:38.4,height:155},
  {date:"2026-02-28",weight:55.7,muscle:18.4,fatPct:38.2,height:155},
  {date:"2026-03-07",weight:56.7,muscle:19.0,fatPct:37.7,height:155},
  {date:"2026-03-14",weight:56.3,muscle:18.6,fatPct:38.3,height:155},
  {date:"2026-04-18",weight:55.4,muscle:19.0,fatPct:36.1,height:155},
  {date:"2026-05-16",weight:54.1,muscle:18.0,fatPct:37.6,height:155},
];
export const WHEY = {name:"Whey Isolate x2",protein:50,fat:1,carbs:4};
export const COL = {cal:"var(--c-cal)",protein:"var(--c-protein)",fat:"var(--c-fat)",carbs:"var(--c-carbs)"};
export const calcCal = (p,f,c) => Math.round((p||0)*4+(f||0)*9+(c||0)*4);

/* ═══ PEPTIDE CONFIG ═══ */
/* ═══ PEPTIDE CATALOG ═══
   Pure reference data: what peptides exist, what they do, how they look.
   No per-user state. Add a new peptide here and it appears in Settings' stack
   manager as available to add to either user's stack.
   The id is the stable key — never rename existing ones. */
export const PEPTIDES = [
  {id:"reta",  name:"Retatrutide",      sub:"Triple agonist",         color:"oklch(0.70 0.18 25)",  purpose:"Triple agonist (GLP-1/GIP/Glucagon). Suppresses appetite, accelerates fat loss, improves insulin sensitivity. Your primary weight-loss peptide."},
  {id:"klow",  name:"Klow",              sub:"BPC + TB + GHK + KPV", components:["bpc157","tb500","ghkcu","kpv"], color:"oklch(0.76 0.17 160)", purpose:"4-in-1 blend: BPC-157 (gut healing) + TB-500 (tissue repair) + GHK-Cu (skin/collagen) + KPV (anti-inflammatory). Recovery, healing, skin quality."},
  {id:"nad",   name:"NAD+",              sub:"Cellular energy",        color:"oklch(0.74 0.14 240)", purpose:"Cellular energy currency. Activates sirtuins (longevity genes), supports DNA repair, boosts mitochondrial function. Anti-aging and metabolic support."},
  {id:"ta1",   name:"Thymosin Alpha-1",  sub:"Immune modulator",       color:"oklch(0.74 0.16 305)", purpose:"Immune modulator from the thymus. Boosts T-cell function, enhances immune surveillance, anti-viral/anti-tumor activity. Strengthens immune system."},
  {id:"amino", name:"5-Amino-1MQ",       sub:"NNMT inhibitor",         color:"oklch(0.78 0.16 50)",  purpose:"NNMT enzyme inhibitor. Blocks fat storage pathway, increases metabolic rate, promotes fat cell energy expenditure. Direct fat-loss mechanism separate from Reta."},
  {id:"snap8", name:"Snap-8",            sub:"Topical · anti-aging",   color:"oklch(0.76 0.18 335)", purpose:"Acetyl octapeptide-3 (topical). Relaxes facial muscles like mild Botox — reduces fine lines and wrinkles. Applied to skin, not injected."},
  {id:"cjcipa",name:"CJC+Ipamorelin",    sub:"GH secretagogue", components:["cjc1295","ipamorelin"],        color:"oklch(0.78 0.14 180)", purpose:"Dual GH secretagogue. CJC amplifies natural growth hormone pulses, Ipamorelin triggers them. Together: deeper sleep, fat loss, recovery, skin, anti-aging."},
  {id:"tesa",  name:"Tesamorelin",       sub:"GHRH analog · visceral fat", color:"oklch(0.72 0.15 280)", purpose:"GHRH analog. Targets visceral abdominal fat, lifts IGF-1, supports lean mass preservation. FDA-approved for HIV lipodystrophy; used off-label for body comp."},
  {id:"semax", name:"Semax+Selank",      sub:"Nootropic sprays", components:["semax","selank"],       color:"oklch(0.84 0.14 90)",  purpose:"Nootropic nasal sprays. Semax: boosts BDNF, sharpens focus and memory. Selank: anxiolytic, calms without sedation. Together: calm clarity for demanding work."},
  {id:"motsc", name:"MOTS-c",            sub:"Mitochondrial",          color:"oklch(0.66 0.02 285)", purpose:"Mitochondrial peptide. Enhances exercise capacity, improves insulin sensitivity, activates AMPK (the exercise-mimetic pathway). Makes workouts more effective."},
  {id:"glow",  name:"Glow",              sub:"BPC + TB + GHK", components:["bpc157","tb500","ghkcu"],         color:"oklch(0.66 0.02 285)", purpose:"3-in-1 blend: BPC-157 + TB-500 + GHK-Cu. Same as Klow minus KPV. Healing, recovery, skin/collagen. Original version before switching to Klow."},
];

/* Display labels for blend component peptides (used by the overlap-aware
   break flag — see sharedActiveComponents in bcq-math). */
export const COMPONENT_LABELS = {
  bpc157:"BPC-157", tb500:"TB-500", ghkcu:"GHK-Cu", kpv:"KPV",
  cjc1295:"CJC-1295", ipamorelin:"Ipamorelin", semax:"Semax", selank:"Selank",
};

/* ═══ DEFAULT_STACK ═══
   First-boot seed for the per-user peptide_stack table. The app inserts these
   rows once per user when their stack is empty, then reads from the DB forever
   after. Editing these defaults DOES NOT affect existing users — they have to
   change their stack via Settings or re-seed by clearing peptide_stack rows.

   Each key = peptide id from PEPTIDES catalog.
   - users:    which users get this seeded (kim / bernadette / both)
   - dose, schedule, time, status, start_date, total_weeks, cycle_end, note:
     initial values for the user's stack entry. Schedule is Sun=0..Sat=6.
     status: "active" | "starting" | "break" | "prn" */
export const DEFAULT_STACK = {
  reta:   {users:["kim"],                dose:"4.5mg weekly",    schedule:[2],             time:"AM",       status:"active",   start_date:"2026-03-10", total_weeks:0,  cycle_end:null,         note:"Titrating per TRIUMPH · next bump 6mg ~Jul 8"},
  klow:   {users:["kim","bernadette"],   dose:"40u (10.7mg)",    schedule:[],              time:"—",        status:"break",    start_date:"2026-05-01", total_weeks:4,  cycle_end:"2026-05-25", note:"Stopped May 25 · 5 GB vials in supply · resume when ready"},
  nad:    {users:["kim","bernadette"],   dose:"50mg (30u)",      schedule:[1,3],           time:"AM",       status:"active",   start_date:"2026-04-06", total_weeks:12, cycle_end:"2026-06-29", note:"Mon/Wed"},
  ta1:    {users:["kim","bernadette"],   dose:"1.5mg (15u)",     schedule:[1,4],           time:"AM",       status:"active",   start_date:"2026-05-16", total_weeks:8,  cycle_end:"2026-07-11", note:"Mon/Thu · Just started"},
  amino:  {users:["kim","bernadette"],   dose:"2.5mg (25u) QD",  schedule:[0,1,2,3,4,5,6], time:"Bedtime",  status:"active",   start_date:"2026-05-16", total_weeks:8,  cycle_end:"2026-07-11", note:"Daily QD before bed"},
  snap8:  {users:["kim","bernadette"],   dose:"Topical AM+PM",   schedule:[0,1,2,3,4,5,6], time:"AM+PM",    status:"active",   start_date:"2026-05-16", total_weeks:12, cycle_end:"2026-08-08", note:"Topical"},
  cjcipa: {users:["kim","bernadette"],   dose:"15u (0.15mL · 500mcg)", schedule:[1,2,3,4,5],     time:"Bedtime",  status:"active",   start_date:"2026-05-17", total_weeks:12, cycle_end:"2026-08-09", note:"Increased to 15u Jun 9 · 5on/2off"},
  tesa:   {users:["kim","bernadette"],   dose:"2mg (20u)",       schedule:[1,3,5],         time:"AM",       status:"active",   start_date:"2026-04-01", total_weeks:8,  cycle_end:"2026-05-27", note:"8-week cycle · GHRH analog · break recommended"},
  semax:  {users:["kim","bernadette"],   dose:"200mcg x2 daily", schedule:[1,2,3,4,5],     time:"AM+Lunch", status:"prn",      start_date:"2026-04-20", total_weeks:0,  cycle_end:null,         note:"PRN for focus"},
  motsc:  {users:["kim","bernadette"],   dose:"1.5mg (30u)",     schedule:[1,3,5],         time:"AM",       status:"active",   start_date:"2026-06-10", total_weeks:5,  cycle_end:"2026-07-15", note:"Cycle 2 · Mon/Wed/Fri"},
  glow:   {users:["kim","bernadette"],   dose:"30u (7mg)",       schedule:[],              time:"—",        status:"completed",start_date:"2026-03-12", total_weeks:8,  cycle_end:"2026-05-07", note:"Cycle 1 complete · resume when ready"},
};

/* Auto-derived from PEPTIDES so the Settings toggle list, Onboarding selector,
   Stack tab, and Today checklist always stay in sync. Add a new peptide once
   to PEPTIDES and it flows everywhere. */
export const AVAILABLE_PEPS = PEPTIDES.map(p=>({id:p.id,name:p.name,sub:p.sub,color:p.color}));

/* ═══ PEPTIDE SUPPLIERS — PH reseller catalog ═══
   Contact info verified against PeptideGuidesPH directory (https://yellow-fire-83c6.peptideguidesph.workers.dev/).
   Sellers with verified:true appear on the PG vetted list.
   Edit prices & links below as you re-survey the market. Prices in PHP per single vial/unit. */
export const SELLERS = {
  studiowellness: {name:"Studio Wellness PH",shopee:null,                                          instagram:null,                                                  whatsapp:null,                website:"https://studiowellnesshq.com",                          notes:"Cheapest GLP-1 starting on the PG directory · ₱1,700+",verified:true},
  thepepstory:    {name:"The Peptide Story",  shopee:null,                                          instagram:"https://instagram.com/thepepstory.main",             whatsapp:null,                website:null,                                                    notes:"GLP-1 from ₱1,900",                                    verified:true},
  avo:            {name:"AVO Supply",         shopee:"https://shopee.ph/avosupplyph",              instagram:"https://instagram.com/avo.supply",                   whatsapp:"+639691671360",     website:null,                                                    notes:"Bac water + 8 swabs + recon syringe + 6 insulin syringes", verified:true},
  chemwatch:      {name:"ChemWatchPH",        shopee:null,                                          instagram:"https://instagram.com/chemwatchph",                  whatsapp:null,                website:null,                                                    notes:"GLP-1 from ₱2,299",                                    verified:true},
  synthe:         {name:"Synthe PH",          shopee:null,                                          instagram:"https://instagram.com/synthe.ph",                    whatsapp:"+639171145168",     website:null,                                                    notes:"GLP-1 from ₱2,499",                                    verified:true},
  slimease:       {name:"SlimEase",           shopee:null,                                          instagram:null,                                                  whatsapp:null,                website:"https://www.facebook.com/people/SlimEase/61580302303569/", notes:"GLP-1 from ₱2,500 · FB shop",                          verified:true},
  trive:          {name:"Trive",              shopee:null,                                          instagram:null,                                                  whatsapp:null,                website:"https://www.facebook.com/your.trive",                   notes:"GLP-1 from ₱3,000 · FB shop",                          verified:true},
  pepticore:      {name:"PeptiCorePH",        shopee:"https://shopee.ph/pepticoreph",              instagram:"https://instagram.com/pepticoreph",                  whatsapp:null,                website:null,                                                    notes:"Bac water + 7 syringes + 7 swabs + cap · KLOW exclusive", verified:false},
  pepside:        {name:"Pepside PH",         shopee:null,                                          instagram:"https://www.tiktok.com/@pepsideph",                  whatsapp:null,                website:null,                                                    notes:"GLP-1 from ₱3,500 · TikTok shop",                      verified:true},
  fitpeptide:     {name:"Fit Peptide",        shopee:null,                                          instagram:null,                                                  whatsapp:null,                website:"https://www.facebook.com/share/1BB7sMq77K/?mibextid=wwXIfr", notes:"GLP-1 from ₱3,500 · FB shop",                        verified:true},
  elevate:        {name:"Elevate Therapeutics",shopee:null,                                         instagram:null,                                                  whatsapp:"+639159398073",     website:null,                                                    notes:"GLP-1 from ₱3,500 · Telegram-first",                   verified:true},
  pepmuse:        {name:"Pepmuse",            shopee:"https://shopee.ph/pepmuse",                  instagram:"https://instagram.com/pepmuse",                      whatsapp:null,                website:null,                                                    notes:"Anti-aging specialist · MOTS-c winner",                verified:false},
  pepmuse_gb:     {name:"Pepmuse Group Buy",  shopee:"https://shopee.ph/pepmuse",                  instagram:"https://instagram.com/pepmuse",                      whatsapp:null,                website:null,                                                    notes:"Half-box (5 vials) group buy pricing · June 2026",      verified:false},
  peptora:        {name:"Peptora",            shopee:null,                                          instagram:"https://instagram.com/peptaura",                     whatsapp:null,                website:null,                                                    notes:"Branded packaging · 5pc bundle pricing · GLP-1 ₱3,999", verified:true},
  peptide30:      {name:"Peptide30",          shopee:null,                                          instagram:null,                                                  whatsapp:null,                website:"https://www.lazada.com.ph/shop/peptide30-glp1-hub",      notes:"GLP-1 from ₱4,000 · Lazada",                           verified:true},
  noxa:           {name:"Noxa",               shopee:null,                                          instagram:null,                                                  whatsapp:null,                website:"https://noxa.is/",                                      notes:"GLP-1 from ₱4,800",                                    verified:true},
  purepept:       {name:"PurePept",           shopee:"https://shopee.ph/purepept",                 instagram:null,                                                  whatsapp:null,                website:null,                                                    notes:"Competitive pricing",                                  verified:false},
  rowan:          {name:"Rowan/LUMI+",        shopee:"https://shopee.ph/rowan.dermaceuticals",     instagram:"https://instagram.com/lumiplus.peptides",            whatsapp:null,                website:null,                                                    notes:"Aggressive Shopee discounts · LUMI+ branding",         verified:false},
};

/* Map peptide IDs → product key in PRICES. Adjust if you reorder different sizes. */
export const PRODUCT_FOR_PEPTIDE = {
  reta:   "reta30",        // 30mg vial = best $/mg
  klow:   "klow",
  nad:    "nad500",
  ta1:    "ta1_10mg",
  amino:  "amino_1mq_10",  // 10mg vial; switch to "amino_1mq_5" if you reorder smaller
  snap8:  "snap8_10mg",
  cjcipa: "cjcipa",        // no community price data yet — browse stores directly
  tesa:   "tesa10",        // 10mg vial, 3 sellers
  semax:  "semax_selank",
  motsc:  "motsc10",
  glow:   "glow",
};

/* PHP per vial/unit. Sourced from your May 2026 peptide reseller comparison dashboard.
   Verify before paying — community prices shift weekly. */
export const PRICES = {
  // ─── Kim's active stack ───
  reta30:        {label:"Retatrutide 30mg",         avo:4500, pepticore:3000, synthe:6499,                  peptora:5899},
  reta15:        {label:"Retatrutide 15mg",                   pepticore:2000, synthe:4199,                  peptora:4899},
  reta10:        {label:"Retatrutide 10mg",         avo:2500,                 synthe:3499, pepmuse_gb:1064.70},
  klow:          {label:"KLOW Blend",                         pepticore:2500, synthe:4000,                  peptora:4599, pepmuse_gb:2316.60},
  glow:          {label:"GLOW Blend",                avo:2600, pepticore:1800,                              peptora:4299, pepmuse_gb:2047.50},
  nad500:        {label:"NAD+ 500mg",                avo:2000, pepticore:2000, synthe:2499,   pepmuse:1500, peptora:3899, purepept:1700, pepmuse_gb:772.20},
  motsc10:       {label:"MOTS-c 10mg",                         pepticore:1500, synthe:1500,   pepmuse:1300, pepmuse_gb:702},
  ta1_10mg:      {label:"Thymosin Alpha-1 10mg",     avo:2400,                 synthe:2100, pepmuse_gb:1673.10},
  amino_1mq_10:  {label:"5-Amino-1MQ 10mg",          avo:1400, pepmuse_gb:760.50},
  amino_1mq_5:   {label:"5-Amino-1MQ 5mg",                                                                                purepept:1500},
  snap8_10mg:    {label:"Snap-8 10mg (topical base)", avo:1100,                synthe:1700, pepmuse_gb:468},
  cjcipa:        {label:"CJC-1295 + Ipamorelin Blend", pepmuse_gb:1123.20, notes:"No community price data captured yet — browse stores directly. Common pricing: ₱2,000–₱3,500 per 10mg blend (5mg each component)."},
  semax_selank:  {label:"Semax 10mg (Selank 10mg sold separately)", avo:1400,  synthe:3000,  pepmuse_gb:514.80,                              notes:"Selank 10mg: AVO ₱1,200 · Synthe ₱3,000. Buy together when reordering."},
  // ─── Reference products (not in Kim's active stack but available) ───
  tirz15:        {label:"Tirzepatide 15mg",          avo:1800, pepticore:2000, synthe:2499,   pepmuse:1800, peptora:3999},
  tirz20:        {label:"Tirzepatide 20mg",                                    synthe:2999,                  peptora:4899},
  tirz30:        {label:"Tirzepatide 30mg",          avo:2800, pepticore:3000, synthe:3999,   pepmuse:2700, peptora:5899},
  cagri10:       {label:"Cagrilintide 10mg",         avo:2800,                 synthe:2500},
  tesa10:        {label:"Tesamorelin 10mg",          avo:2600, pepticore:3500, pepmuse_gb:1989,                peptora:3599},
  ghkcu50:       {label:"GHK-Cu 50mg",               avo:1000,                 synthe:1500,   pepmuse:900},
  ghkcu100:      {label:"GHK-Cu 100mg",              avo:1600, pepticore:1200, synthe:2000,   pepmuse:1500, peptora:3799, purepept:1500},
  glut1500:      {label:"Glutathione 1500mg",        avo:1650,                 synthe:2499,   pepmuse:1700,               purepept:1500},
  bpc10:         {label:"BPC-157 10mg",              avo:2000, pepticore:2000, synthe:1899},
  kpv10:         {label:"KPV 10mg",                  avo:1800, pepticore:1800, synthe:2000,                               purepept:1500},
  fatblaster10:  {label:"Fat Blaster 10mL",          avo:1700,                 synthe:3000},
  lemon10:       {label:"Lemon Bottle 10mL",                                   synthe:1500,                                purepept:1500},
};

/* Map peptide IDs → PeptideGuidesPH educational page slug.
   Null = no specific page; we'll just link to the main peptide library. */
export const PG_SLUG_FOR_PEPTIDE = {
  reta:   "retatrutide",
  klow:   "klow",
  nad:    "nad",
  ta1:    null,            // PG doesn't have a dedicated Thymosin α-1 page
  amino:  "5-amino-1mq",
  snap8:  "snap-8",
  cjcipa: "cjc-ipa-protocol",
  tesa:   "tesamorelin",
  semax:  "semax",
  motsc:  "mots-c",
  glow:   "glow",
};
export const PG_BASE = "https://peptideguidesph.github.io";
export const PG_DIRECTORY = "https://yellow-fire-83c6.peptideguidesph.workers.dev/";
export const pgUrlFor = pepId => {
  const slug = PG_SLUG_FOR_PEPTIDE[pepId];
  return slug ? `${PG_BASE}/peptides/${slug}/` : `${PG_BASE}/peptides/`;
};

/* Returns ordered reorder options for a given peptide id.
   Sellers with prices come first (cheapest → most expensive), then sellers without confirmed prices. */
export const reorderOptionsFor = pepId => {
  const productKey = PRODUCT_FOR_PEPTIDE[pepId];
  if (!productKey) return null;
  const product = PRICES[productKey];
  if (!product) return null;
  const allSellers = Object.keys(SELLERS);
  const priced = [], unpriced = [];
  allSellers.forEach(sid => {
    const v = product[sid];
    if (typeof v === "number") priced.push({sellerId: sid, seller: SELLERS[sid], price: v});
    else if (v === null) unpriced.push({sellerId: sid, seller: SELLERS[sid], price: null, knownStockist: true});
  });
  priced.sort((a,b) => a.price - b.price);
  const cheapest = priced[0]?.price;
  const dearest = priced[priced.length-1]?.price;
  const savings = (cheapest != null && dearest != null && dearest > cheapest) ? dearest - cheapest : 0;
  return {
    productLabel: product.label,
    productNotes: product.notes || null,
    cheapest, dearest, savings,
    options: [...priced.map(o => ({...o, isBest: o.price === cheapest})), ...unpriced],
  };
};

/* ═══ PEPTIDE RECONSTITUTION PROTOCOLS ═══
   Sourced from PeptideGuidesPH (peptideguidesph.github.io) + clinical literature.
   Each peptide has one or more "options" — recommended one pre-fills the batch form.
   stabilityDays is the reconstituted-product stability window (vs user-set expiry).
   Peptides with shorter stability windows (TA-1: 7d, MOTS-c: 14d) get amber warnings
   when a batch is used past that window, regardless of user-set expiry. */
export const RECONSTITUTION = {
  reta: {
    label: "Retatrutide",
    options: [
      {vial:5,  bac:2, conc:2.5,  note:"Forgiving for small doses · 250µg = 10u", recommended:false},
      {vial:10, bac:2, conc:5,    note:"Standard · 2.5mg = 50u",                  recommended:false},
      {vial:10, bac:1, conc:10,   note:"Compact · 2.5mg = 25u",                   recommended:false},
      {vial:30, bac:3, conc:10,   note:"Cost-efficient reorder · 2.5mg = 25u, 4mg = 40u", recommended:true},
    ],
    stabilityDays: 28,
    technique: [
      "Allow vial and BAC water to reach room temperature (15–20 min)",
      "Clean vial top with alcohol swab and let air-dry",
      "Inject BAC water slowly down the vial wall to minimize foaming",
      "Gently swirl in circular motions — DO NOT shake vigorously",
      "Allow to fully dissolve (2–3 min); solution must be clear and colorless",
    ],
    storage: "Refrigerated 2–8°C, rotate injection sites weekly",
    sources: ["PeptideGuidesPH /peptides/retatrutide/", "Phase 3 TRIUMPH trial protocol"],
  },
  klow: {
    label: "KLOW (4-peptide blend)",
    options: [
      {vial:80, bac:4,  conc:20,    note:"PG conservative · 200–500mcg total = 1–2.5u", recommended:false},
      {vial:80, bac:3,  conc:26.7,  note:"Your reconstitution · 40u = ~10.7mg total",   recommended:true},
      {vial:80, bac:5,  conc:16,    note:"More dilute · 40u = ~6.4mg",                  recommended:false},
    ],
    stabilityDays: 42,
    stabilityWarning: "PG conservative protocol uses 200–500mcg total per dose. Your 40u = ~10.7mg is substantially higher — community practice varies widely for this blend.",
    technique: [
      "Verify vial contents and individual peptide amounts before mixing",
      "Allow vial and BAC water to reach room temperature",
      "Inject BAC slowly down vial wall — avoid foaming",
      "Gently swirl until dissolved — do not shake",
      "Solution should be clear to slightly cloudy (acceptable for this blend)",
      "Label with reconstitution date and concentration",
    ],
    storage: "Refrigerated 2–8°C immediately after reconstitution",
    sources: ["PeptideGuidesPH /peptides/klow/"],
  },
  nad: {
    label: "NAD+",
    options: [
      {vial:500, bac:5,   conc:100, note:"Standard · 50mg = 50u · easiest to measure", recommended:true},
      {vial:500, bac:3,   conc:167, note:"Compact · 50mg = 30u",                       recommended:false},
      {vial:500, bac:2.5, conc:200, note:"Concentrated · 50mg = 25u",                  recommended:false},
      {vial:500, bac:2,   conc:250, note:"Max conc · 50mg = 20u",                      recommended:false},
      {vial:1000,bac:5,   conc:200, note:"Larger vial · 50mg = 25u",                   recommended:false},
    ],
    stabilityDays: 28,
    technique: [
      "Wipe both vial tops with alcohol swabs",
      "Draw BAC water (typically 2–3 mL for a 500mg vial)",
      "Inject water slowly, aiming at the glass wall",
      "Gently swirl until completely dissolved — may take 2–3 minutes",
      "Draw the prescribed dose using a fresh needle",
    ],
    storage: "Refrigerated 2–8°C, protect from light",
    sources: ["PeptideGuidesPH /peptides/nad/"],
  },
  ta1: {
    label: "Thymosin Alpha-1",
    options: [
      {vial:10, bac:1, conc:10,  note:"Your reconstitution · 1.5mg = 15u", recommended:true},
      {vial:10, bac:2, conc:5,   note:"More forgiving · 1.5mg = 30u",      recommended:false},
      {vial:5,  bac:1, conc:5,   note:"Smaller vial · 1.5mg = 30u",        recommended:false},
      {vial:5,  bac:2, conc:2.5, note:"Most forgiving · 1.5mg = 60u",      recommended:false},
    ],
    stabilityDays: 7,
    stabilityWarning: "TA-1 has a much shorter stability window than most peptides — 7 days vs the typical 28. Mix smaller batches more frequently.",
    technique: [
      "Allow vial to reach room temperature before opening (reduces condensation)",
      "Inject BAC water slowly down the vial wall — avoid foaming",
      "Gently swirl or roll until fully dissolved — DO NOT shake",
      "Inspect solution before each use — discard if cloudy or discolored",
    ],
    storage: "Refrigerated 2–8°C, protect from light, avoid freeze-thaw",
    sources: ["Multiple peptide dosing protocols (PG has no dedicated TA-1 page)"],
  },
  amino: {
    label: "5-Amino-1MQ",
    options: [
      {vial:100, bac:2,  conc:50, note:"Standard mg-protocol · 2.5mg = 5u",  recommended:false},
      {vial:100, bac:4,  conc:25, note:"More dilute · 2.5mg = 10u",          recommended:false},
      {vial:100, bac:10, conc:10, note:"Your reconstitution · 2.5mg = 25u",  recommended:true},
      {vial:10,  bac:1,  conc:10, note:"mcg-protocol vial",                  recommended:false},
    ],
    stabilityDays: 28,
    technique: [
      "Confirm whether you're following a mcg or mg protocol (1,000× difference!)",
      "Wipe vial stopper and add BAC water slowly down the vial wall",
      "Gently swirl until fully dissolved — do not shake",
      "Label the vial with concentration and units (mg/mL)",
    ],
    storage: "Refrigerated 2–8°C",
    sources: ["PeptideGuidesPH /peptides/5-amino-1mq/"],
  },
  snap8: {
    label: "SNAP-8 (topical)",
    topical: true,
    options: [
      {note:"3–5% concentration in serum base for daily preventive use", recommended:true},
      {note:"5–10% for intensive wrinkle treatment",                     recommended:false},
    ],
    stabilityDays: null,
    technique: [
      "If powder: dissolve in distilled water OR add to serum base at 3–10% concentration",
      "Apply to clean, dry skin BEFORE heavier products",
      "Pea-sized amount to target areas (forehead, eyes, brow)",
      "Gently pat into skin — avoid rubbing (reduces efficacy)",
      "Allow 2–3 minutes for absorption before layering moisturizer/sunscreen",
    ],
    storage: "4–25°C, refrigerate the solution",
    sources: ["PeptideGuidesPH /peptides/snap-8/"],
  },
  cjcipa: {
    label: "CJC-1295 + Ipamorelin",
    options: [
      {vial:10, bac:2, conc:5,   note:"Blended vial · 100mcg each = 2u, 200mcg = 4u, 300mcg = 6u", recommended:true},
      {vial:5,  bac:2, conc:2.5, note:"Single peptide vial · 200mcg = 8u",                          recommended:false},
    ],
    stabilityDays: 28,
    technique: [
      "Blended vial: 2 mL BAC → 1 mg/mL of each peptide",
      "Inject 2–3 hours after last meal and 30–60 min before bed",
      "Rotate subcutaneous sites (abdomen, thigh, upper arm)",
    ],
    storage: "Refrigerated 2–8°C",
    sources: ["PeptideGuidesPH /peptides/cjc-ipa-protocol/"],
  },
  tesa: {
    label: "Tesamorelin",
    options: [
      {vial:2,    bac:0.5, conc:4,    note:"Egrifta SV preparation · 1.4mg = 0.35mL · USE IMMEDIATELY (single-use)", recommended:false},
      {vial:11.6, bac:1.3, conc:8.92, note:"Egrifta WR preparation · stable 7 days at room temp",                    recommended:false},
      {vial:10,   bac:2,   conc:5,    note:"Common community recon · 2mg = 0.4mL (40u) · use within 7 days",         recommended:true},
      {vial:10,   bac:1,   conc:10,   note:"Compact · 2mg = 0.2mL (20u) · use within 7 days",                        recommended:false},
    ],
    stabilityDays: 7,
    technique: [
      "Allow lyophilized vial and BAC water to reach room temperature first",
      "Wipe vial stopper with alcohol swab, let air-dry",
      "Inject BAC water slowly DOWN the vial wall (do not blast onto powder)",
      "Gently swirl to dissolve — vigorous shaking denatures the GHRH protein",
      "Solution must be CLEAR and COLORLESS — any yellow/brown tint = discard",
      "Inject SubQ in abdomen avoiding navel ±2 inches; rotate sites weekly",
    ],
    storage: "After reconstitution: refrigerate or room temp ≤25°C; USE WITHIN 7 DAYS. Tesa is unusually unstable — much shorter window than reta or NAD+.",
    sources: ["PeptideGuidesPH /peptides/tesamorelin/", "Egrifta SV/WR prescribing information"],
  },
  semax: {
    label: "Semax + Selank (nasal sprays)",
    preformulated: true,
    options: [
      {note:"Pre-formulated nasal spray · NO reconstitution required", recommended:true},
    ],
    stabilityDays: null,
    technique: [
      "Shake bottle gently before each use",
      "Tilt head slightly back, spray into nostril, breathe in gently",
      "Avoid blowing nose for 5 minutes after spraying",
      "Alternate nostrils between doses",
    ],
    storage: "Refrigerated, use within label-stated period after opening",
    sources: ["PeptideGuidesPH /peptides/semax/", "PeptideGuidesPH /peptides/selank-nasal/"],
  },
  motsc: {
    label: "MOTS-c",
    options: [
      {vial:10, bac:1, conc:10, note:"Your reconstitution · 1.5mg = 15u", recommended:true},
      {vial:10, bac:2, conc:5,  note:"More forgiving · 1.5mg = 30u",      recommended:false},
      {vial:5,  bac:1, conc:5,  note:"Smaller vial · 1.5mg = 30u",        recommended:false},
    ],
    stabilityDays: 14,
    stabilityWarning: "MOTS-c has a shorter stability window than most peptides — 14 days vs the typical 28. Mix smaller batches more frequently.",
    technique: [
      "Allow lyophilized vial to reach room temperature (~15–20 min)",
      "Inject BAC water slowly down the vial side — NOT directly onto the powder",
      "Gently swirl until dissolved — do not shake vigorously",
    ],
    storage: "Lyophilized: room temp short-term or freezer long-term. Reconstituted: 2–8°C",
    sources: ["PeptideGuidesPH /peptides/mots-c/"],
  },
  glow: {
    label: "GLOW (3-peptide blend)",
    options: [
      {vial:70, bac:3, conc:23.3, note:"Your reconstitution · 30u = ~7mg total", recommended:true},
      {vial:70, bac:4, conc:17.5, note:"More dilute · 30u = ~5.25mg",            recommended:false},
    ],
    stabilityDays: 28,
    technique: [
      "Verify vial contents and individual peptide amounts before mixing",
      "Allow vial and BAC water to reach room temperature",
      "Inject BAC slowly down the vial wall to avoid foaming",
      "Gently swirl until fully dissolved — do not shake",
      "Label vial with reconstitution date, total volume, and individual concentrations",
    ],
    storage: "Refrigerated 2–8°C",
    sources: ["PeptideGuidesPH /peptides/glow/"],
  },
};

/* ═══ PHARMACOKINETICS ═══
   In-vivo half-life data per molecule (NOT per batch/reconstitution).
   These inform dosing frequency and stacking timing — orthogonal to RECONSTITUTION.stabilityDays
   which is about how long the reconstituted product stays potent in your fridge.

   Values are typical adult ranges from clinical / community sources. For peptide mixes,
   we list each component since they clear at different rates.

   Schema:
     halfLifeNote — display string (handles mixes & wide ranges)
     halfLifeHours — single numeric value when meaningful (null for mixes / very-short / range too wide)
     dosingImplication — short rationale for why we dose this peptide this way

   Sources: PeptideGuidesPH protocols, FDA prescribing info where applicable, published PK studies.
   These are guidelines — individual variation is real. */
export const PHARMACOKINETICS = {
  reta:   {halfLifeNote: "~6 days",                                halfLifeHours: 144,  dosingImplication: "Long half-life → weekly dosing maintains steady levels"},
  klow:   {halfLifeNote: "BPC ~30m · TB ~2–3h · GHK ~1h · KPV ~1h", halfLifeHours: null, dosingImplication: "Short half-lives across all 4 components → daily dosing"},
  glow:   {halfLifeNote: "BPC ~30m · TB ~2–3h · GHK ~1h",          halfLifeHours: null, dosingImplication: "Short half-lives → daily dosing for sustained healing/skin effects"},
  nad:    {halfLifeNote: "~1–8h (route-dependent)",                halfLifeHours: 4,    dosingImplication: "Short half-life; effects are dose-dependent and cumulative"},
  ta1:    {halfLifeNote: "~2h plasma",                             halfLifeHours: 2,    dosingImplication: "Short plasma half-life but immune effects last longer; daily dosing typical"},
  amino:  {halfLifeNote: "~3–4h",                                  halfLifeHours: 3.5,  dosingImplication: "Daily dosing maintains NNMT inhibition"},
  snap8:  {halfLifeNote: "Topical · sustained on skin",            halfLifeHours: null, dosingImplication: "Daily topical use builds cumulative effect"},
  cjcipa: {halfLifeNote: "Mod-GRF ~30m · Ipa ~2h",                 halfLifeHours: 1,    dosingImplication: "Both short — pulses GH naturally; pre-bed timing best"},
  tesa:   {halfLifeNote: "~26 min plasma",                         halfLifeHours: 0.4,  dosingImplication: "Very short — daily injection required for visceral-fat effect"},
  semax:  {halfLifeNote: "~5–15 min (intranasal)",                 halfLifeHours: 0.25, dosingImplication: "BDNF effects persist much longer than plasma t½"},
  motsc:  {halfLifeNote: "~hours (poorly characterized)",          halfLifeHours: null, dosingImplication: "Effects on mitochondria last beyond plasma t½"},
};

/* ═══ CYCLING PROTOCOLS ═══
   Encodes whether each peptide is continuous or cycle-based, and what the
   app should do when cycle_end approaches or passes.
   
   type: "continuous" — no cycle-off needed, titrate and maintain
         "cycle"      — defined on/off pattern, prompt break when cycle ends
         "prn"        — as-needed, no cycle tracking
   
   Sources: clinical trials (GLP-1s), PeptideGuidesPH, community consensus */
export const CYCLING = {
  reta:   {type:"continuous", note:"GLP-1 class — no cycling. TRIUMPH ran 48 weeks. Titrate up, maintain until goal, then taper to maintenance dose. Cycling off causes weight regain."},
  klow:   {type:"cycle",      onWeeks:4, offWeeks:3, note:"4–6 weeks on / 2–4 weeks off. BPC+TB receptors downregulate with continuous use."},
  glow:   {type:"cycle",      onWeeks:6, offWeeks:3, note:"Similar to Klow. 6–8 weeks on / 2–4 weeks off."},
  nad:    {type:"continuous", note:"No cycling needed. Maintenance dosing indefinitely. Some do loading phases (daily × 2wk then 2×/wk)."},
  ta1:    {type:"continuous", note:"Continuous use typical. Some practitioners do 8-week cycles but evidence supports ongoing immune modulation."},
  amino:  {type:"cycle",      onWeeks:8, offWeeks:4, note:"8 weeks on / 4 weeks off. NNMT inhibition may plateau with continuous use."},
  snap8:  {type:"continuous", note:"Topical — continuous daily use. No receptor downregulation concern."},
  cjcipa: {type:"cycle",      onWeeks:12, offWeeks:4, note:"12 weeks on / 4 weeks off. GH-axis peptides benefit from cycling to prevent pituitary desensitization."},
  tesa:   {type:"cycle",      onWeeks:8, offWeeks:6, note:"GHRH analog — 8–12 weeks on / 4–8 weeks off. Pituitary receptor sensitivity degrades with continuous use. 5on/2off weekly within cycle. Monitor IGF-1 on extended use."},
  semax:  {type:"prn",       note:"As-needed for focus/cognition. Can be used daily for 2–4 week courses or PRN."},
  motsc:  {type:"cycle",      onWeeks:5, offWeeks:4, note:"4–5 weeks on / 4 weeks off. Mitochondrial peptide — cycling preserves sensitivity."},
};

/* Helper: get recommended reconstitution option for a peptide */
export const recommendedReconFor = pepId => {
  const r = RECONSTITUTION[pepId];
  if (!r) return null;
  return r.options.find(o => o.recommended) || r.options[0] || null;
};

/* ═══ CHANGELOG — shown in "What's New" sheet on first load after update ═══ */
export const CHANGELOG = [
  {v:"2026.08.11a", date:"2026-08-11", title:"Live Macro Targets", items:[
    {icon:"target",text:"Targets now recalculate from your latest InBody scan — a Saturday scan moves Sunday's numbers"},
    {icon:"body",text:"Deficit is now a setting (slider, 0–30%) instead of hardcoded calories"},
    {icon:"warn",text:"Fixed: macros page and insights used different TDEE formulas and disagreed by ~130 kcal — both now use Katch-McArdle"},
    {icon:"check",text:"Sustainability warning threshold tightened from 25% to 20% deficit"},
    {icon:"target",text:"Projections rebuilt — scenarios now derive from YOUR deficit, with TDEE recalculated monthly so loss decelerates realistically"},
    {icon:"body",text:"Projections model lean-mass cost of harder deficits, and Actual Pace uses regression over 70 days instead of two scans"},
  ]},
  {v:"2026.07.31a", date:"2026-07-31", title:"Supply Health, Auto-Status & Shared Vials", items:[
    {icon:"peps",   text:"Supply Health — sealed vials, weeks of supply, and weekly burn rate for every peptide, sorted so whatever runs out first is at the top"},
    {icon:"plus",   text:"Open a sealed vial in one tap — it subtracts from your supply and starts a new batch with the details already filled in"},
    {icon:"warn",   text:"Low stock warnings — total vial count up top, colour-coded urgency on every peptide"},
    {icon:"users",  text:"Shared vials count both of you — NAD+ and MOTS-c supply now includes the whole household"},
    {icon:"calendar",text:"Resuming soon — paused peptides count down to their resume date, and anything paused indefinitely shows as ON HOLD"},
    {icon:"check",  text:"Peptides now resume on their own when the resume date arrives. Until now the app could only turn things off, never back on"},
    {icon:"vial",   text:"Auto-status — cycles switch to active or completed by themselves based on your start and end dates"},
    {icon:"target", text:"Titration banners you can tap — confirm a dose increase or push it back 7 days without leaving the screen"},
    {icon:"scale",  text:"Doses now calculated from your batch's actual mg/ml and syringe units instead of reading the dose text"},
    {icon:"target", text:"Goal ETA on the home card — your projected goal date every time you open the app"},
    {icon:"pause",  text:"A paused peptide no longer jumps straight back to its old dose when you switch it on — resuming is now a deliberate step"},
    {icon:"check",  text:"Your peptide list no longer blanks out after a cycle finishes or you confirm a titration bump"},
    {icon:"star",   text:"All AI features working again — moved to Gemini 2.5 Flash after the old model was shut down"},
    {icon:"macros", text:"Menu + button opens the add meal form properly again"},
    {icon:"vial",   text:"Corrected doses per vial for 5-Amino-1MQ, NAD+ and Tesamorelin, and updated the CJC/Ipamorelin dose for the 5mg/ml mix"},
  ]},
  {v:"2026.06.11a", date:"2026-06-11", title:"Macros Overhaul, AI Analysis & Cycle Planner", items:[
    {icon:"muscle", text:"Meal autocomplete — type a meal name and it suggests from your 52-meal history with macros pre-filled"},
    {icon:"star",   text:"Quick-add strip — your top favorites as one-tap chips above the meal list"},
    {icon:"target", text:"Smart protein nudge — when behind pace, suggests protein shake, bar, or eggs"},
    {icon:"eye",    text:"Meal Library tab — all meals categorized by Breakfast/Lunch/Dinner/Snack, searchable, tap to log"},
    {icon:"camera", text:"Menu upload — photograph your Smartfitchen weekly menu, AI reads it and matches meals against your library"},
    {icon:"calendar",text:"Meal plan grid — parsed menus display as a Mon–Fri calendar with KNOWN/NEW badges"},
    {icon:"trending-up",text:"History rebuilt — weekly summary strip, deficit per day, calorie vs target bars, expandable meal detail, missing day indicators"},
    {icon:"vial",   text:"Cycle planner — visual timeline showing every peptide's cycle as a Gantt chart with start/end/break/upcoming"},
    {icon:"plus",   text:"Add supply — log sealed vials directly from the Inventory tab"},
    {icon:"eye",    text:"AI Analysis — Gemini-powered insights that connect your macros, scans, peptides, and Whoop data into 2–4 actionable recommendations"},
    {icon:"scale",  text:"Compact protein card — 60% smaller, same data, better page balance"},
    {icon:"clock",  text:"Arrow date navigation on Macros — same ← → style as the Peps tab"},
    {icon:"moon",   text:"Dark mode polish — all form inputs, date pickers, and dropdowns now properly themed"},
  ]},
  {v:"2026.06.10b", date:"2026-06-10", title:"Supply, Smart TDEE & Cycle Intelligence", items:[
    {icon:"vial",  text:"Supply tab — track sealed vials, tap Open Vial to start a batch"},
    {icon:"trending-up", text:"Titration alerts — app tells you when it's time to bump your dose"},
    {icon:"target",text:"Smart TDEE — auto-recalculates from latest InBody scan using Katch-McArdle"},
    {icon:"clock", text:"Cycle intelligence — knows which peptides need cycling off and when"},
    {icon:"scale", text:"Body comp chart — fat %, weight, and muscle on one view"},
    {icon:"vial",  text:"Off-schedule dosing — tap any not-due peptide to log with smart spacing advice"},
    {icon:"warn",  text:"Muscle loss & recomp alerts — flags when you're losing lean mass"},
    {icon:"tag",   text:"Pepmuse Group Buy pricing across all peptides"},
  ]},
];

/* ═══ DOSE SPACING — minimum hours between doses, derived from schedule patterns ═══
   Used by the off-schedule dosing feature to suggest schedule adjustments. */
export const minSpacingHours = (schedule) => {
  if (!schedule || schedule.length <= 1) return 24;
  /* Sort schedule days and compute minimum gap between consecutive days */
  const sorted = [...schedule].sort((a, b) => a - b);
  let minGap = 7; /* max possible in a week */
  for (let i = 1; i < sorted.length; i++) {
    minGap = Math.min(minGap, sorted[i] - sorted[i - 1]);
  }
  /* Also check wrap-around (last day to first day of next week) */
  minGap = Math.min(minGap, 7 - sorted[sorted.length - 1] + sorted[0]);
  return minGap * 24; /* convert days to hours */
};
