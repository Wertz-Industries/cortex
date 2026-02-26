import type { LoopState, PhaseName } from "../data/schemas.js";

/** Valid state transitions. Key = current state, value = set of allowed next states. */
const TRANSITIONS: Record<LoopState, Set<LoopState>> = {
  idle: new Set(["scanning", "paused"]),
  scanning: new Set(["planning", "error", "paused", "budget_exceeded"]),
  planning: new Set(["building", "error", "paused", "budget_exceeded"]),
  building: new Set(["ship_checking", "error", "paused", "budget_exceeded", "awaiting_approval"]),
  ship_checking: new Set(["evaluating", "error", "paused", "budget_exceeded"]),
  evaluating: new Set(["idle", "error", "paused"]),
  paused: new Set(["idle", "scanning", "planning", "building", "ship_checking", "evaluating"]),
  error: new Set(["idle", "scanning", "paused"]),
  awaiting_approval: new Set(["building", "paused", "error"]),
  budget_exceeded: new Set(["idle", "paused"]),
};

/** Map loop state to the phase it represents (null for non-phase states). */
const STATE_TO_PHASE: Partial<Record<LoopState, PhaseName>> = {
  scanning: "scan",
  planning: "plan",
  building: "build",
  ship_checking: "ship_check",
  evaluating: "eval",
};

/** Ordered phase sequence for a normal cycle. */
export const PHASE_ORDER: PhaseName[] = ["scan", "plan", "build", "ship_check", "eval"];

export type TransitionResult =
  | { ok: true; from: LoopState; to: LoopState }
  | { ok: false; from: LoopState; to: LoopState; reason: string };

export function canTransition(from: LoopState, to: LoopState): boolean {
  return TRANSITIONS[from]?.has(to) ?? false;
}

export function transition(from: LoopState, to: LoopState): TransitionResult {
  if (canTransition(from, to)) {
    return { ok: true, from, to };
  }
  return {
    ok: false,
    from,
    to,
    reason: `Invalid transition: ${from} → ${to}`,
  };
}

export function phaseForState(state: LoopState): PhaseName | null {
  return STATE_TO_PHASE[state] ?? null;
}

export function stateForPhase(phase: PhaseName): LoopState {
  const map: Record<PhaseName, LoopState> = {
    scan: "scanning",
    plan: "planning",
    build: "building",
    ship_check: "ship_checking",
    eval: "evaluating",
  };
  return map[phase];
}

export function nextPhase(current: PhaseName): PhaseName | null {
  const idx = PHASE_ORDER.indexOf(current);
  if (idx === -1 || idx >= PHASE_ORDER.length - 1) return null;
  return PHASE_ORDER[idx + 1]!;
}
