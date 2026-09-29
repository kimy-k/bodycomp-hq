import {describe, it, expect} from "vitest";
import {deriveStatus} from "./Dashboard.jsx";
import {addDays} from "./helpers.js";

/* Regression tests for the auto-resume bug (MOTS-c Aug 12, CJC-IPA Sep 10,
   Klow Sep 14 2026): a resume consumed resume_date, then the stale cycle_end
   from the previous cycle re-completed the row on the next pass, parking the
   compound forever (completed + null resume_date). */

const TODAY = "2026-09-14";

describe("deriveStatus — resume transitions", () => {
  const parked = {
    status: "completed",
    resume_date: "2026-09-14",
    start_date: "2026-06-21",   // previous cycle
    cycle_end: "2026-08-17",    // previous cycle — STALE
    total_weeks: 8,
  };

  it("fires the resume on the resume day and consumes resume_date", () => {
    const r = deriveStatus(parked, TODAY);
    expect(r.clearResume).toBe(true);
    expect(["starting", "active"]).toContain(r.status);
  });

  it("PASS 2 with rolled dates stays active (the writeback rolls start_date + cycle_end)", () => {
    // Simulate the row exactly as the fixed writeback PATCHes it:
    const patched = {
      ...parked,
      status: "active",
      resume_date: null,
      start_date: TODAY,
      cycle_end: addDays(TODAY, parked.total_weeks * 7),
    };
    const r = deriveStatus(patched, TODAY);
    expect(r.status).toBe("active");
    expect(r.clearResume).toBe(false);
  });

  it("GUARD: a resumed row whose cycle_end was NOT rolled must not re-complete (the bug)", () => {
    // This is the exact post-resume state that killed all three compounds:
    const unRolled = {
      status: "active",
      resume_date: null,
      start_date: TODAY,          // resumed today...
      cycle_end: "2026-08-17",    // ...but stale cycle_end predates it
      total_weeks: 8,
    };
    const r = deriveStatus(unRolled, TODAY);
    expect(r.status).toBe("active"); // pre-fix this was "completed"
  });

  it("still completes normally when the CURRENT cycle genuinely ends", () => {
    const done = {
      status: "active",
      resume_date: null,
      start_date: "2026-06-21",
      cycle_end: "2026-08-17",   // cycle_end AFTER start_date → legitimate
      total_weeks: 8,
    };
    const r = deriveStatus(done, TODAY);
    expect(r.status).toBe("completed");
  });

  it("break → starting → active routes correctly on resume day", () => {
    const onBreak = {
      status: "break",
      resume_date: "2026-09-14",
      start_date: "2026-03-14",
      cycle_end: "2026-05-02",
      total_weeks: 8,
    };
    const r = deriveStatus(onBreak, TODAY);
    expect(r.clearResume).toBe(true);
    expect(r.status).toBe("active"); // start_date in the past → active immediately
  });

  it("future resume_date does nothing", () => {
    const r = deriveStatus({status: "completed", resume_date: "2026-10-12", start_date: "2026-08-01", cycle_end: "2026-09-12"}, TODAY);
    expect(r.status).toBe("completed");
    expect(r.clearResume).toBe(false);
  });
});
