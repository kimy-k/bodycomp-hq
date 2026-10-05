// @vitest-environment jsdom
/* Render smoke test — mounts the Workouts tab against a fake db and drives
   the main interactions. Guards against "builds but crashes on open". */
import {describe, it, expect, vi, afterEach} from "vitest";
import {render, screen, fireEvent, waitFor, cleanup} from "@testing-library/react";
afterEach(cleanup);
import {Workouts} from "./Workouts.jsx";

const prevSession = {date: "2026-09-28", split: "Lower A", exercises: [
  {name: "Leg Curl", sets: [{w: 40, r: 8}, {w: 40, r: 8}, {w: 40, r: 7}]},
  {name: "Hip Thrust", sets: [{w: 80, r: 8}, {w: 80, r: 8}, {w: 80, r: 8}]},
]};
const makeDb = () => {
  const store = {};
  return {
    currentUser: "kim",
    get: vi.fn(async (t, d) => store[d] || null),
    list: vi.fn(async () => Object.values(store).sort((a, b) => a.date < b.date ? 1 : -1)),
    upsert: vi.fn(async (t, row) => { store[row.date] = row; return true; }),
    del: vi.fn(async (t, d) => { delete store[d]; return true; }),
    lastWorkoutOfSplit: vi.fn(async (split) => split === "Lower A" ? prevSession : null),
    setDayType: vi.fn(async () => true),
    _store: store,
  };
};

describe("Workouts tab", () => {
  it("mounts, picks a split, loads last session, saves, marks day hard", async () => {
    const db = makeDb(); const toast = vi.fn();
    render(<Workouts db={db} userConfig={{}} onToast={toast}/>);
    await waitFor(() => expect(screen.getByText(/Recent sessions/)).toBeTruthy());

    fireEvent.click(screen.getByText("Lower A"));
    await waitFor(() => expect(screen.getByText(/Load last/)).toBeTruthy());
    fireEvent.click(screen.getByText(/Load last/));

    /* names prefilled from previous session */
    const names = screen.getAllByPlaceholderText("Exercise").map(i => i.value);
    expect(names).toEqual(["Leg Curl", "Hip Thrust"]);

    /* enter reps for first exercise: 8,8,8 at 40 → +1 rep vs last */
    const reps = screen.getAllByPlaceholderText("reps");
    fireEvent.change(reps[0], {target: {value: "8"}});
    fireEvent.change(reps[1], {target: {value: "8"}});
    fireEvent.change(reps[2], {target: {value: "8"}});
    await waitFor(() => expect(screen.getByText("+1 rep")).toBeTruthy());

    fireEvent.click(screen.getByText("Save session"));
    await waitFor(() => expect(db.upsert).toHaveBeenCalled());
    const saved = db.upsert.mock.calls[0][1];
    expect(saved.split).toBe("Lower A");
    expect(saved.exercises).toEqual([{name: "Leg Curl", sets: [{w: 40, r: 8}, {w: 40, r: 8}, {w: 40, r: 8}]}]);  /* Hip Thrust had no reps → dropped */
    expect(db.setDayType).toHaveBeenCalledWith(expect.any(String), "hard");
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/Saved/), "ok");
  });

  it("refuses to save without a split", async () => {
    const db = makeDb(); const toast = vi.fn();
    render(<Workouts db={db} userConfig={{}} onToast={toast}/>);
    await waitFor(() => screen.getByText(/Add exercise/));
    fireEvent.click(screen.getByText(/Add exercise/));
    fireEvent.change(screen.getByPlaceholderText("Exercise"), {target: {value: "X"}});
    fireEvent.change(screen.getAllByPlaceholderText("reps")[0], {target: {value: "5"}});
    fireEvent.click(screen.getByText("Save session"));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.stringMatching(/split/), "error"));
    expect(db.upsert).not.toHaveBeenCalled();
  });
});
