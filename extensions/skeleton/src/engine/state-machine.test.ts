import { describe, expect, it } from "vitest";
import type { LoopState, PhaseName } from "../data/schemas.js";
import {
  PHASE_ORDER,
  canTransition,
  nextPhase,
  phaseForState,
  stateForPhase,
  transition,
} from "./state-machine.js";

describe("state-machine", () => {
  // ── canTransition / transition ────────────────────────────────────

  describe("valid transitions", () => {
    const validPairs: [LoopState, LoopState][] = [
      ["idle", "scanning"],
      ["idle", "paused"],
      ["scanning", "planning"],
      ["scanning", "error"],
      ["scanning", "paused"],
      ["scanning", "budget_exceeded"],
      ["planning", "building"],
      ["planning", "error"],
      ["planning", "paused"],
      ["planning", "budget_exceeded"],
      ["building", "ship_checking"],
      ["building", "error"],
      ["building", "paused"],
      ["building", "budget_exceeded"],
      ["building", "awaiting_approval"],
      ["ship_checking", "evaluating"],
      ["ship_checking", "error"],
      ["ship_checking", "paused"],
      ["ship_checking", "budget_exceeded"],
      ["evaluating", "idle"],
      ["evaluating", "error"],
      ["evaluating", "paused"],
      ["paused", "idle"],
      ["paused", "scanning"],
      ["paused", "planning"],
      ["paused", "building"],
      ["paused", "ship_checking"],
      ["paused", "evaluating"],
      ["error", "idle"],
      ["error", "scanning"],
      ["error", "paused"],
      ["awaiting_approval", "building"],
      ["awaiting_approval", "paused"],
      ["awaiting_approval", "error"],
      ["budget_exceeded", "idle"],
      ["budget_exceeded", "paused"],
    ];

    for (const [from, to] of validPairs) {
      it(`${from} → ${to}`, () => {
        expect(canTransition(from, to)).toBe(true);
        const result = transition(from, to);
        expect(result.ok).toBe(true);
        expect(result.from).toBe(from);
        expect(result.to).toBe(to);
      });
    }
  });

  describe("invalid transitions", () => {
    const invalidPairs: [LoopState, LoopState][] = [
      ["idle", "building"],
      ["idle", "evaluating"],
      ["idle", "error"],
      ["scanning", "evaluating"],
      ["scanning", "idle"],
      ["planning", "scanning"],
      ["building", "planning"],
      ["evaluating", "building"],
      ["budget_exceeded", "scanning"],
      ["budget_exceeded", "building"],
      ["awaiting_approval", "idle"],
      ["awaiting_approval", "scanning"],
    ];

    for (const [from, to] of invalidPairs) {
      it(`${from} → ${to} is rejected`, () => {
        expect(canTransition(from, to)).toBe(false);
        const result = transition(from, to);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain("Invalid transition");
        }
      });
    }
  });

  // ── phaseForState ────────────────────────────────────────────────

  describe("phaseForState", () => {
    it("maps scanning → scan", () => expect(phaseForState("scanning")).toBe("scan"));
    it("maps planning → plan", () => expect(phaseForState("planning")).toBe("plan"));
    it("maps building → build", () => expect(phaseForState("building")).toBe("build"));
    it("maps ship_checking → ship_check", () =>
      expect(phaseForState("ship_checking")).toBe("ship_check"));
    it("maps evaluating → eval", () => expect(phaseForState("evaluating")).toBe("eval"));
    it("returns null for idle", () => expect(phaseForState("idle")).toBeNull());
    it("returns null for paused", () => expect(phaseForState("paused")).toBeNull());
    it("returns null for error", () => expect(phaseForState("error")).toBeNull());
    it("returns null for awaiting_approval", () =>
      expect(phaseForState("awaiting_approval")).toBeNull());
    it("returns null for budget_exceeded", () =>
      expect(phaseForState("budget_exceeded")).toBeNull());
  });

  // ── stateForPhase ────────────────────────────────────────────────

  describe("stateForPhase", () => {
    it("scan → scanning", () => expect(stateForPhase("scan")).toBe("scanning"));
    it("plan → planning", () => expect(stateForPhase("plan")).toBe("planning"));
    it("build → building", () => expect(stateForPhase("build")).toBe("building"));
    it("ship_check → ship_checking", () =>
      expect(stateForPhase("ship_check")).toBe("ship_checking"));
    it("eval → evaluating", () => expect(stateForPhase("eval")).toBe("evaluating"));
  });

  // ── nextPhase ────────────────────────────────────────────────────

  describe("nextPhase", () => {
    it("scan → plan", () => expect(nextPhase("scan")).toBe("plan"));
    it("plan → build", () => expect(nextPhase("plan")).toBe("build"));
    it("build → ship_check", () => expect(nextPhase("build")).toBe("ship_check"));
    it("ship_check → eval", () => expect(nextPhase("ship_check")).toBe("eval"));
    it("eval → null (end of sequence)", () => expect(nextPhase("eval")).toBeNull());
  });

  // ── PHASE_ORDER ──────────────────────────────────────────────────

  describe("PHASE_ORDER", () => {
    it("has 5 phases in correct order", () => {
      expect(PHASE_ORDER).toEqual(["scan", "plan", "build", "ship_check", "eval"]);
    });

    it("stateForPhase and phaseForState are inverses", () => {
      for (const phase of PHASE_ORDER) {
        const state = stateForPhase(phase);
        expect(phaseForState(state)).toBe(phase);
      }
    });
  });
});
