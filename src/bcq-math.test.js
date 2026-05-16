/* ═══ BCQ MATH TESTS — Vitest ═══
   Run: npm test
   Watch: npm run test:watch
   ──────────────────────────────────────────────────────────────────── */

import {describe, it, expect} from "vitest";
import {
  enrich,
  daysSinceRecon,
  isPastPGStability,
  parseTimeStr,
  dueState,
  concentration,
  batchStatus,
  currentBatchFor,
  mgFromDoseStr,
  inventoryFor,
} from "./bcq-math.js";

/* Fixed reference date for all time-dependent tests: May 17, 2026, noon UTC */
const NOW = new Date("2026-05-17T12:00:00Z");

// ════════════════════════════════════════════════════════════════
// enrich
// ════════════════════════════════════════════════════════════════
describe("enrich", () => {
  it("computes fat mass and lean mass", () => {
    const r = enrich({date: "2026-05-01", weight: 80, fatPct: 25});
    expect(r.fatMass).toBe(20);
    expect(r.leanMass).toBe(60);
  });

  it("rounds to 1 decimal place", () => {
    const r = enrich({date: "2026-05-01", weight: 70.5, fatPct: 23.7});
    expect(r.fatMass).toBe(16.7);
    expect(r.leanMass).toBe(53.8);
  });

  it("preserves all input fields", () => {
    const r = enrich({date: "2026-05-01", weight: 80, fatPct: 25, muscle: 35});
    expect(r.muscle).toBe(35);
    expect(r.weight).toBe(80);
  });

  it("generates date labels", () => {
    const r = enrich({date: "2026-05-01", weight: 80, fatPct: 25});
    expect(r.label).toMatch(/May/);
    expect(r.labelYr).toMatch(/26/);
  });
});

// ════════════════════════════════════════════════════════════════
// daysSinceRecon
// ════════════════════════════════════════════════════════════════
describe("daysSinceRecon", () => {
  it("returns 0 for missing batch", () => {
    expect(daysSinceRecon(null, NOW)).toBe(0);
    expect(daysSinceRecon(undefined, NOW)).toBe(0);
    expect(daysSinceRecon({}, NOW)).toBe(0);
  });

  it("returns 0 for today's batch", () => {
    expect(daysSinceRecon({date_recon: "2026-05-17"}, NOW)).toBe(0);
  });

  it("counts days for past batches", () => {
    expect(daysSinceRecon({date_recon: "2026-05-10"}, NOW)).toBe(7);
    expect(daysSinceRecon({date_recon: "2026-04-17"}, NOW)).toBe(30);
  });

  it("returns negative for future batches", () => {
    expect(daysSinceRecon({date_recon: "2026-05-24"}, NOW)).toBe(-7);
  });
});

// ════════════════════════════════════════════════════════════════
// isPastPGStability
// ════════════════════════════════════════════════════════════════
describe("isPastPGStability", () => {
  const reta7 = {stabilityDays: 7};
  const reta28 = {stabilityDays: 28};

  it("returns false when no recon entry", () => {
    expect(isPastPGStability({date_recon: "2026-05-01"}, null, NOW)).toBe(false);
    expect(isPastPGStability({date_recon: "2026-05-01"}, {}, NOW)).toBe(false);
  });

  it("returns false when within window", () => {
    expect(isPastPGStability({date_recon: "2026-05-11"}, reta7, NOW)).toBe(false);  // 6 days ago
  });

  it("returns true when past window", () => {
    expect(isPastPGStability({date_recon: "2026-05-09"}, reta7, NOW)).toBe(true);   // 8 days ago
  });

  it("28-day window vs 7-day window", () => {
    const batch = {date_recon: "2026-04-25"};  // 22 days ago
    expect(isPastPGStability(batch, reta28, NOW)).toBe(false);  // within 28d
    expect(isPastPGStability(batch, reta7, NOW)).toBe(true);    // past 7d
  });
});

// ════════════════════════════════════════════════════════════════
// parseTimeStr
// ════════════════════════════════════════════════════════════════
describe("parseTimeStr", () => {
  it("handles AM/PM shorthand", () => {
    expect(parseTimeStr("AM")).toEqual({h: 8, m: 0});
    expect(parseTimeStr("PM")).toEqual({h: 20, m: 0});
    expect(parseTimeStr("am")).toEqual({h: 8, m: 0});
    expect(parseTimeStr("pm")).toEqual({h: 20, m: 0});
  });

  it("parses 12-hour with am/pm", () => {
    expect(parseTimeStr("8:00am")).toEqual({h: 8, m: 0});
    expect(parseTimeStr("9pm")).toEqual({h: 21, m: 0});
    expect(parseTimeStr("12:30pm")).toEqual({h: 12, m: 30});
    expect(parseTimeStr("12:00am")).toEqual({h: 0, m: 0});   // midnight
  });

  it("parses 24-hour", () => {
    expect(parseTimeStr("13:30")).toEqual({h: 13, m: 30});
    expect(parseTimeStr("00:00")).toEqual({h: 0, m: 0});
    expect(parseTimeStr("23:59")).toEqual({h: 23, m: 59});
  });

  it("returns null for invalid input", () => {
    expect(parseTimeStr(null)).toBe(null);
    expect(parseTimeStr("")).toBe(null);
    expect(parseTimeStr("bedtime")).toBe(null);
    expect(parseTimeStr("AM+PM")).toBe(null);
    expect(parseTimeStr("25:00")).toBe(null);  // invalid hour
    expect(parseTimeStr("12:60")).toBe(null);  // invalid minute
  });
});

// ════════════════════════════════════════════════════════════════
// dueState
// ════════════════════════════════════════════════════════════════
describe("dueState", () => {
  /* NOW is May 17 2026, noon UTC. Tests use local-time interpretation
     since the function uses setHours()/getHours() (local).
     We construct `now` as a specific local time to keep tests deterministic. */
  const localNoon = new Date(2026, 4, 17, 12, 0, 0);  // May 17 noon local
  const peptide8AM = {time: "AM"};   // → 8:00
  const peptide8PM = {time: "PM"};   // → 20:00

  it("returns null when checked", () => {
    expect(dueState(peptide8AM, true, localNoon)).toBe(null);
  });

  it("returns null when no time info", () => {
    expect(dueState({time: ""}, false, localNoon)).toBe(null);
    expect(dueState({time: "Bedtime"}, false, localNoon)).toBe(null);
    expect(dueState(null, false, localNoon)).toBe(null);
  });

  it("marks AM dose as overdue at noon", () => {
    const r = dueState(peptide8AM, false, localNoon);  // 4h overdue
    expect(r.overdue).toBe(true);
    expect(r.label).toMatch(/h overdue/);
    expect(r.color).toBe("var(--c-danger)");
  });

  it("marks PM dose as 'due 8pm' before window", () => {
    const r = dueState(peptide8PM, false, localNoon);
    expect(r.overdue).toBe(false);
    expect(r.label).toMatch(/due 8pm/);
  });

  it("marks dose 'due now' within 15min window", () => {
    const tenMinAfter8 = new Date(2026, 4, 17, 8, 10, 0);
    const r = dueState(peptide8AM, false, tenMinAfter8);
    expect(r.urgent).toBe(true);
    expect(r.label).toBe("due now");
  });

  it("marks dose as 'Nmin overdue' between 15-120min", () => {
    const fortyAfter8 = new Date(2026, 4, 17, 8, 40, 0);
    const r = dueState(peptide8AM, false, fortyAfter8);
    expect(r.overdue).toBe(true);
    expect(r.label).toBe("40min overdue");
    expect(r.color).toBe("var(--c-warn)");
  });
});

// ════════════════════════════════════════════════════════════════
// concentration
// ════════════════════════════════════════════════════════════════
describe("concentration", () => {
  it("computes mg/mL", () => {
    expect(concentration({mg_total: 30, ml_bac: 3})).toBe(10);
    expect(concentration({mg_total: 5, ml_bac: 2})).toBe(2.5);
    expect(concentration({mg_total: 500, ml_bac: 2.5})).toBe(200);
  });

  it("rounds to 2 decimals", () => {
    expect(concentration({mg_total: 11.6, ml_bac: 1.3})).toBe(8.92);
    expect(concentration({mg_total: 10, ml_bac: 3})).toBe(3.33);
  });

  it("returns null on missing/zero fields", () => {
    expect(concentration({})).toBe(null);
    expect(concentration({mg_total: 10})).toBe(null);
    expect(concentration({ml_bac: 2})).toBe(null);
    expect(concentration({mg_total: 0, ml_bac: 2})).toBe(null);
    expect(concentration({mg_total: 10, ml_bac: 0})).toBe(null);
    expect(concentration(null)).toBe(null);
  });
});

// ════════════════════════════════════════════════════════════════
// batchStatus
// ════════════════════════════════════════════════════════════════
describe("batchStatus", () => {
  it("marks exhausted batches first regardless of expiry", () => {
    const r = batchStatus({exhausted: true, expiry_date: "2027-01-01"}, NOW);
    expect(r.label).toBe("Exhausted");
    expect(r.rank).toBe(3);
  });

  it("marks expired batches", () => {
    const r = batchStatus({expiry_date: "2026-05-10"}, NOW);  // 7 days past
    expect(r.label).toBe("Expired");
    expect(r.rank).toBe(2);
    expect(r.color).toBe("var(--c-danger)");
  });

  it("warns when ≤7d to expiry", () => {
    const r = batchStatus({expiry_date: "2026-05-22"}, NOW);  // 5 days out
    expect(r.label).toMatch(/d to expiry/);
    expect(r.rank).toBe(1);
    expect(r.color).toBe("var(--c-warn)");
  });

  it("shows success when >7d to expiry", () => {
    const r = batchStatus({expiry_date: "2026-06-14"}, NOW);  // 28 days out
    expect(r.rank).toBe(0);
    expect(r.color).toBe("var(--c-success)");
  });

  it("marks 'Active' when no expiry set", () => {
    const r = batchStatus({}, NOW);
    expect(r.label).toBe("Active");
    expect(r.rank).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════
// currentBatchFor
// ════════════════════════════════════════════════════════════════
describe("currentBatchFor", () => {
  const batches = [
    {id: "a", peptide_id: "reta", date_recon: "2026-05-01", expiry_date: "2026-05-29", exhausted: false},
    {id: "b", peptide_id: "reta", date_recon: "2026-04-15", expiry_date: "2026-05-13", exhausted: false}, // expired
    {id: "c", peptide_id: "reta", date_recon: "2026-05-10", expiry_date: "2026-06-07", exhausted: true},  // exhausted
    {id: "d", peptide_id: "reta", date_recon: "2026-05-15", expiry_date: "2026-06-12", exhausted: false}, // newer than 'a'
    {id: "e", peptide_id: "klow", date_recon: "2026-05-08", expiry_date: "2026-06-05", exhausted: false},
  ];

  it("returns the most recent active batch for the peptide", () => {
    const r = currentBatchFor("reta", batches, NOW);
    expect(r.id).toBe("d");  // newest non-exhausted, non-expired
  });

  it("returns batch from different peptide correctly", () => {
    const r = currentBatchFor("klow", batches, NOW);
    expect(r.id).toBe("e");
  });

  it("skips exhausted batches", () => {
    const onlyExhausted = batches.filter(b => b.id === "c");
    expect(currentBatchFor("reta", onlyExhausted, NOW)).toBe(null);
  });

  it("skips expired batches", () => {
    const onlyExpired = batches.filter(b => b.id === "b");
    expect(currentBatchFor("reta", onlyExpired, NOW)).toBe(null);
  });

  it("returns null when no batches for that peptide", () => {
    expect(currentBatchFor("nonexistent", batches, NOW)).toBe(null);
  });

  it("handles missing input", () => {
    expect(currentBatchFor("reta", null, NOW)).toBe(null);
    expect(currentBatchFor("reta", [], NOW)).toBe(null);
  });

  it("handles batch with no expiry_date as still active", () => {
    const noExpiry = [{id: "x", peptide_id: "ta1", date_recon: "2026-01-01", exhausted: false}];
    expect(currentBatchFor("ta1", noExpiry, NOW).id).toBe("x");
  });
});

// ════════════════════════════════════════════════════════════════
// mgFromDoseStr
// ════════════════════════════════════════════════════════════════
describe("mgFromDoseStr", () => {
  it("extracts mg from common formats", () => {
    expect(mgFromDoseStr("2.5mg (25u)")).toBe(2.5);
    expect(mgFromDoseStr("40u (10.7mg)")).toBe(10.7);
    expect(mgFromDoseStr("1.5mg")).toBe(1.5);
    expect(mgFromDoseStr("50 mg")).toBe(50);
    expect(mgFromDoseStr("0.5mg")).toBe(0.5);
  });

  it("handles whitespace and case", () => {
    expect(mgFromDoseStr("2MG")).toBe(2);
    expect(mgFromDoseStr("  3.5  mg  ")).toBe(3.5);
  });

  it("returns null for mcg-only or invalid input", () => {
    expect(mgFromDoseStr("100mcg")).toBe(null);
    expect(mgFromDoseStr("200mcg (2u)")).toBe(null);
    expect(mgFromDoseStr("topical")).toBe(null);
    expect(mgFromDoseStr("")).toBe(null);
    expect(mgFromDoseStr(null)).toBe(null);
    expect(mgFromDoseStr(undefined)).toBe(null);
  });

  it("picks the FIRST mg number when multiple present", () => {
    expect(mgFromDoseStr("5mg or 10mg")).toBe(5);
  });
});

// ════════════════════════════════════════════════════════════════
// inventoryFor — the most critical function (drives reorder alerts)
// ════════════════════════════════════════════════════════════════
describe("inventoryFor", () => {
  const peptide = {id: "reta", dose: "2.5mg (25u)", schedule: [2]};  // once/week
  const batches = [
    {id: "v1", peptide_id: "reta", date_recon: "2026-05-01", mg_total: 30, ml_bac: 3, exhausted: false, expiry_date: "2026-05-29"},
  ];

  it("returns null when peptide is null", () => {
    expect(inventoryFor(null, batches, [], NOW)).toBe(null);
  });

  it("returns null when no active batch", () => {
    expect(inventoryFor(peptide, [], [], NOW)).toBe(null);
  });

  it("returns null when dose has no mg", () => {
    const noMg = {id: "x", dose: "100mcg", schedule: [1]};
    expect(inventoryFor(noMg, batches, [], NOW)).toBe(null);
  });

  it("computes totalDosesInVial correctly", () => {
    const r = inventoryFor(peptide, batches, [], NOW);
    expect(r.totalDosesInVial).toBe(12);  // 30mg / 2.5mg = 12
    expect(r.dosesUsed).toBe(0);
    expect(r.dosesRemaining).toBe(12);
    expect(r.mgPerDose).toBe(2.5);
    expect(r.source).toBe("batch");
  });

  it("counts doses across users since batch reconstitution", () => {
    const log = [
      {date: "2026-05-05", user_id: "kim",        checks: {reta: {time: "08:15"}}},  // counts
      {date: "2026-05-10", user_id: "bernadette", checks: {reta: {time: "09:00"}}},  // counts
      {date: "2026-05-12", user_id: "kim",        checks: {klow: {}}},               // skip — wrong peptide
      {date: "2026-04-28", user_id: "kim",        checks: {reta: {}}},               // skip — before batch
      {date: "2026-05-15", user_id: "bernadette", checks: {reta: {}}},               // counts
    ];
    const r = inventoryFor(peptide, batches, log, NOW);
    expect(r.dosesUsed).toBe(3);
    expect(r.dosesRemaining).toBe(9);  // 12 - 3
  });

  it("never returns negative remaining doses", () => {
    const overdrawn = Array(20).fill(0).map((_, i) => ({
      date: `2026-05-${String(i + 2).padStart(2, "0")}`,
      checks: {reta: {}},
    }));
    const r = inventoryFor(peptide, batches, overdrawn, NOW);
    expect(r.dosesRemaining).toBe(0);  // can't go below zero
  });

  it("computes daysSupply from schedule frequency", () => {
    const dailyPep = {id: "klow", dose: "10.7mg (40u)", schedule: [0, 1, 2, 3, 4, 5, 6]};  // 7×/week
    const klowBatches = [{id: "k1", peptide_id: "klow", date_recon: "2026-05-15", mg_total: 80, ml_bac: 3, exhausted: false}];
    const r = inventoryFor(dailyPep, klowBatches, [], NOW);
    expect(r.totalDosesInVial).toBe(7);  // 80 / 10.7 = 7.47 → floor 7
    expect(r.daysSupply).toBe(7);        // 7 doses × 7/7 days ≈ 7 days
  });

  it("computes daysSupply for weekly peptide", () => {
    const r = inventoryFor(peptide, batches, [], NOW);  // 12 doses, 1×/week
    expect(r.daysSupply).toBe(84);  // 12 × 7 = 84 days
  });

  it("scenario: shared household decrements visibly", () => {
    /* Kim takes 1 dose Monday, Bea takes 1 dose Thursday — vial should show 10 left. */
    const log = [
      {date: "2026-05-04", user_id: "kim",        checks: {reta: {time: "08:00"}}},
      {date: "2026-05-07", user_id: "bernadette", checks: {reta: {time: "09:30"}}},
    ];
    const r = inventoryFor(peptide, batches, log, NOW);
    expect(r.dosesUsed).toBe(2);
    expect(r.dosesRemaining).toBe(10);
  });
});

// ════════════════════════════════════════════════════════════════
// Integration: realistic Reta cycle scenario
// ════════════════════════════════════════════════════════════════
describe("integration: realistic Reta cycle", () => {
  it("week 4 of a 30mg vial with both users dosing", () => {
    const peptide = {id: "reta", dose: "2.5mg (25u)", schedule: [2]};
    const batches = [
      {id: "v1", peptide_id: "reta", date_recon: "2026-04-19", mg_total: 30, ml_bac: 3, exhausted: false, expiry_date: "2026-05-17"},
    ];
    const log = [
      {date: "2026-04-21", checks: {reta: {time: "08:00"}}},  // wk 1
      {date: "2026-04-28", checks: {reta: {time: "08:00"}}},  // wk 2
      {date: "2026-05-05", checks: {reta: {time: "08:00"}}},  // wk 3
      {date: "2026-05-12", checks: {reta: {time: "08:00"}}},  // wk 4
    ];
    const r = inventoryFor(peptide, batches, log, NOW);
    expect(r.totalDosesInVial).toBe(12);
    expect(r.dosesUsed).toBe(4);
    expect(r.dosesRemaining).toBe(8);
    expect(r.daysSupply).toBe(56);  // 8 weeks
  });

  it("stability warning fires on a TA-1 batch held 8 days", () => {
    const ta1Batch = {peptide_id: "ta1", date_recon: "2026-05-09", mg_total: 10, ml_bac: 1};
    const ta1Recon = {stabilityDays: 7};
    expect(daysSinceRecon(ta1Batch, NOW)).toBe(8);
    expect(isPastPGStability(ta1Batch, ta1Recon, NOW)).toBe(true);  // past 7-day window
  });

  it("stability warning does NOT fire on a Reta batch held 21 days", () => {
    const retaBatch = {peptide_id: "reta", date_recon: "2026-04-26", mg_total: 30, ml_bac: 3};
    const retaRecon = {stabilityDays: 28};
    expect(daysSinceRecon(retaBatch, NOW)).toBe(21);
    expect(isPastPGStability(retaBatch, retaRecon, NOW)).toBe(false);  // within 28-day window
  });
});
