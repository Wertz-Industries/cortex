/**
 * Skeleton event definitions broadcast to connected WebSocket clients.
 *
 * These follow the Cortex gateway event frame protocol:
 * { type: "event", event: "skeleton.<name>", payload: { ... } }
 */

export const SKELETON_EVENTS = {
  STATE_CHANGED: "skeleton.state_changed",
  PHASE_COMPLETE: "skeleton.phase_complete",
  TASK_UPDATE: "skeleton.task_update",
  APPROVAL_REQUIRED: "skeleton.approval_required",
  COST_ALERT: "skeleton.cost_alert",
  BUDGET_EXCEEDED: "skeleton.budget_exceeded",
} as const;

export type SkeletonEventName = (typeof SKELETON_EVENTS)[keyof typeof SKELETON_EVENTS];
