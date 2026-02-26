import { describe, expect, it, beforeEach } from "vitest";
import { CostTracker, type CostRecord } from "./cost-tracker.js";

function makeRecord(overrides: Partial<CostRecord> = {}): CostRecord {
  return {
    timestamp: new Date().toISOString(),
    phase: "scan",
    provider: "openai",
    model: "gpt-4o",
    inputTokens: 100,
    outputTokens: 50,
    costUsd: 0.01,
    latencyMs: 200,
    ...overrides,
  };
}

describe("CostTracker", () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker();
  });

  // ── Empty state ──────────────────────────────────────────────────

  describe("empty tracker", () => {
    it("total() returns 0", () => expect(tracker.total()).toBe(0));
    it("dailyCost() returns 0", () => expect(tracker.dailyCost()).toBe(0));
    it("weeklyCost() returns 0", () => expect(tracker.weeklyCost()).toBe(0));
    it("costForTask() returns 0", () => expect(tracker.costForTask("nonexistent")).toBe(0));
    it("costForPhase() returns 0", () => expect(tracker.costForPhase("scan")).toBe(0));
    it("providerDailyCost() returns 0", () => expect(tracker.providerDailyCost("openai")).toBe(0));
    it("getRecords() returns empty array", () => expect(tracker.getRecords()).toEqual([]));
  });

  // ── Record and retrieve ──────────────────────────────────────────

  describe("record + total", () => {
    it("records a single entry", () => {
      tracker.record(makeRecord({ costUsd: 0.05 }));
      expect(tracker.total()).toBeCloseTo(0.05);
      expect(tracker.getRecords()).toHaveLength(1);
    });

    it("accumulates multiple entries", () => {
      tracker.record(makeRecord({ costUsd: 0.05 }));
      tracker.record(makeRecord({ costUsd: 0.1 }));
      tracker.record(makeRecord({ costUsd: 0.03 }));
      expect(tracker.total()).toBeCloseTo(0.18);
      expect(tracker.getRecords()).toHaveLength(3);
    });
  });

  // ── costSince ────────────────────────────────────────────────────

  describe("costSince", () => {
    it("filters by timestamp", () => {
      const past = new Date(Date.now() - 3600_000).toISOString();
      const recent = new Date().toISOString();

      tracker.record(makeRecord({ timestamp: past, costUsd: 0.1 }));
      tracker.record(makeRecord({ timestamp: recent, costUsd: 0.05 }));

      const oneHourAgo = new Date(Date.now() - 1800_000); // 30 min ago
      expect(tracker.costSince(oneHourAgo)).toBeCloseTo(0.05);
    });

    it("includes entries exactly at boundary", () => {
      const boundary = new Date();
      tracker.record(makeRecord({ timestamp: boundary.toISOString(), costUsd: 0.1 }));
      expect(tracker.costSince(boundary)).toBeCloseTo(0.1);
    });
  });

  // ── Task filtering ───────────────────────────────────────────────

  describe("costForTask", () => {
    it("isolates cost by taskId", () => {
      tracker.record(makeRecord({ taskId: "task-1", costUsd: 0.1 }));
      tracker.record(makeRecord({ taskId: "task-2", costUsd: 0.2 }));
      tracker.record(makeRecord({ taskId: "task-1", costUsd: 0.05 }));

      expect(tracker.costForTask("task-1")).toBeCloseTo(0.15);
      expect(tracker.costForTask("task-2")).toBeCloseTo(0.2);
      expect(tracker.costForTask("task-3")).toBe(0);
    });

    it("ignores entries without taskId", () => {
      tracker.record(makeRecord({ costUsd: 0.1 })); // no taskId
      tracker.record(makeRecord({ taskId: "task-1", costUsd: 0.05 }));
      expect(tracker.costForTask("task-1")).toBeCloseTo(0.05);
    });
  });

  // ── Phase filtering ──────────────────────────────────────────────

  describe("costForPhase", () => {
    it("isolates cost by phase", () => {
      tracker.record(makeRecord({ phase: "scan", costUsd: 0.01 }));
      tracker.record(makeRecord({ phase: "plan", costUsd: 0.05 }));
      tracker.record(makeRecord({ phase: "scan", costUsd: 0.02 }));

      expect(tracker.costForPhase("scan")).toBeCloseTo(0.03);
      expect(tracker.costForPhase("plan")).toBeCloseTo(0.05);
      expect(tracker.costForPhase("build")).toBe(0);
    });
  });

  // ── Daily cost ───────────────────────────────────────────────────

  describe("dailyCost", () => {
    it("includes today's entries", () => {
      tracker.record(makeRecord({ costUsd: 0.1 }));
      expect(tracker.dailyCost()).toBeCloseTo(0.1);
    });

    it("excludes yesterday's entries", () => {
      const yesterday = new Date(Date.now() - 86400_000 * 2).toISOString();
      tracker.record(makeRecord({ timestamp: yesterday, costUsd: 0.5 }));
      tracker.record(makeRecord({ costUsd: 0.1 })); // today
      expect(tracker.dailyCost()).toBeCloseTo(0.1);
    });
  });

  // ── Weekly cost ──────────────────────────────────────────────────

  describe("weeklyCost", () => {
    it("includes last 7 days", () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 86400_000).toISOString();
      tracker.record(makeRecord({ timestamp: threeDaysAgo, costUsd: 0.3 }));
      tracker.record(makeRecord({ costUsd: 0.1 }));
      expect(tracker.weeklyCost()).toBeCloseTo(0.4);
    });

    it("excludes entries older than 7 days", () => {
      const twoWeeksAgo = new Date(Date.now() - 14 * 86400_000).toISOString();
      tracker.record(makeRecord({ timestamp: twoWeeksAgo, costUsd: 1.0 }));
      tracker.record(makeRecord({ costUsd: 0.1 }));
      expect(tracker.weeklyCost()).toBeCloseTo(0.1);
    });
  });

  // ── Provider daily cost ──────────────────────────────────────────

  describe("providerDailyCost", () => {
    it("filters by provider and today", () => {
      tracker.record(makeRecord({ provider: "openai", costUsd: 0.1 }));
      tracker.record(makeRecord({ provider: "gemini", costUsd: 0.05 }));
      tracker.record(makeRecord({ provider: "openai", costUsd: 0.03 }));

      expect(tracker.providerDailyCost("openai")).toBeCloseTo(0.13);
      expect(tracker.providerDailyCost("gemini")).toBeCloseTo(0.05);
      expect(tracker.providerDailyCost("claude")).toBe(0);
    });
  });

  // ── costForProvider (with date range) ────────────────────────────

  describe("costForProvider", () => {
    it("filters provider + time range", () => {
      const old = new Date(Date.now() - 86400_000 * 10).toISOString();
      tracker.record(makeRecord({ provider: "openai", timestamp: old, costUsd: 1.0 }));
      tracker.record(makeRecord({ provider: "openai", costUsd: 0.1 }));

      const weekAgo = new Date(Date.now() - 7 * 86400_000);
      expect(tracker.costForProvider("openai", weekAgo)).toBeCloseTo(0.1);
    });
  });

  // ── loadRecords / getRecords persistence ─────────────────────────

  describe("loadRecords", () => {
    it("replaces internal state", () => {
      tracker.record(makeRecord({ costUsd: 0.1 }));
      const saved = tracker.getRecords();

      const fresh = new CostTracker();
      fresh.loadRecords(saved);
      expect(fresh.total()).toBeCloseTo(0.1);
      expect(fresh.getRecords()).toHaveLength(1);
    });

    it("getRecords returns a copy", () => {
      tracker.record(makeRecord({ costUsd: 0.1 }));
      const records = tracker.getRecords();
      records.push(makeRecord({ costUsd: 999 }));
      expect(tracker.getRecords()).toHaveLength(1);
    });
  });
});
