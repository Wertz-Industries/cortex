import { describe, expect, it } from "vitest";
import { resolveTier } from "./tier-resolver.js";

describe("resolveTier", () => {
  // ── Tier 2 (human approval required) ─────────────────────────────

  describe("tier 2 keywords", () => {
    const tier2Cases = [
      ["deploy to production", "Ship the release"],
      ["Publish package", "npm publish to registry"],
      ["Release notes", "Create release"],
      ["Customer notification", "Send updates"],
      ["Outbound email", "Notify users"],
      ["Email send campaign", "Blast to list"],
      ["Billing integration", "Stripe setup"],
      ["Payment processing", "Handle charges"],
      ["Spend budget", "Purchase resources"],
      ["Purchase server", "Buy compute"],
      ["Delete all data", "Wipe records"],
      ["Destroy environment", "Teardown staging"],
      ["Public announcement", "Post to blog"],
    ];

    for (const [title, description] of tier2Cases) {
      it(`"${title}" → tier 2`, () => {
        expect(resolveTier({ title, description })).toBe("2");
      });
    }
  });

  // ── Tier 1 (budget-constrained) ──────────────────────────────────

  describe("tier 1 keywords", () => {
    const tier1Cases = [
      ["Staging environment", "Push to staging env"],
      ["Run experiment", "A/B test for conversion"],
      ["A/B test variants", "Test two layouts"],
      ["Trial subscription", "Free trial signup flow"],
      ["Build prototype", "Quick prototype of feature"],
      ["Draft PR", "Create draft pull request"],
    ];

    for (const [title, description] of tier1Cases) {
      it(`"${title}" → tier 1`, () => {
        expect(resolveTier({ title, description })).toBe("1");
      });
    }
  });

  // ── Tier 0 (fully autonomous) ────────────────────────────────────

  describe("tier 0 fallback", () => {
    it("analyze data → tier 0", () => {
      expect(resolveTier({ title: "Analyze data", description: "Generate report" })).toBe("0");
    });

    it("run unit tests → tier 0", () => {
      expect(resolveTier({ title: "Run tests", description: "Execute test suite" })).toBe("0");
    });

    it("refactor module → tier 0", () => {
      expect(resolveTier({ title: "Refactor auth module", description: "Clean up code" })).toBe(
        "0",
      );
    });
  });

  // ── Case insensitivity ───────────────────────────────────────────

  it("is case insensitive", () => {
    expect(resolveTier({ title: "DEPLOY", description: "TO PRODUCTION" })).toBe("2");
    expect(resolveTier({ title: "Deploy", description: "Production" })).toBe("2");
    expect(resolveTier({ title: "STAGING", description: "test" })).toBe("1");
  });

  // ── Keyword inside longer string ─────────────────────────────────

  it("matches keyword inside longer string", () => {
    expect(resolveTier({ title: "We should deploy this soon", description: "Ready to go" })).toBe(
      "2",
    );
    expect(resolveTier({ title: "Set up staging environment", description: "For QA" })).toBe("1");
  });

  // ── suggestedTier behavior ───────────────────────────────────────

  describe("suggestedTier", () => {
    it("suggestedTier=2 always returns 2", () => {
      expect(
        resolveTier({ title: "Harmless task", description: "Nothing risky", suggestedTier: "2" }),
      ).toBe("2");
    });

    it("suggestedTier=2 is never downgraded", () => {
      expect(resolveTier({ title: "Analyze data", description: "Safe", suggestedTier: "2" })).toBe(
        "2",
      );
    });

    it("suggestedTier=1 is kept when no keywords match", () => {
      expect(
        resolveTier({ title: "Analyze data", description: "Review", suggestedTier: "1" }),
      ).toBe("1");
    });

    it("suggestedTier=1 is overridden by tier 2 keyword", () => {
      expect(
        resolveTier({ title: "Deploy to production", description: "Ship it", suggestedTier: "1" }),
      ).toBe("2");
    });

    it("suggestedTier=0 with tier 1 keyword resolves to 1", () => {
      expect(
        resolveTier({ title: "Run experiment", description: "Test it", suggestedTier: "0" }),
      ).toBe("1");
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────

  it("empty strings → tier 0", () => {
    expect(resolveTier({ title: "", description: "" })).toBe("0");
  });

  it("tier 2 keyword in description only still triggers", () => {
    expect(resolveTier({ title: "Ship it", description: "deploy to production servers" })).toBe(
      "2",
    );
  });
});
