import type { AutonomyTier } from "../data/schemas.js";

/**
 * Actions that always require human approval (Tier 2).
 * These are the hard gates — never do these autonomously.
 */
const TIER_2_KEYWORDS = [
  "deploy",
  "production",
  "publish",
  "release",
  "customer",
  "outbound",
  "email send",
  "billing",
  "payment",
  "spend",
  "purchase",
  "delete",
  "destroy",
  "public",
];

/**
 * Actions that are budget-constrained (Tier 1).
 * Can proceed if within budget caps.
 */
const TIER_1_KEYWORDS = ["staging", "experiment", "a/b test", "trial", "prototype", "draft"];

/**
 * Resolves the autonomy tier for a given action.
 * Tier 0: Fully autonomous (research, tests, code in branches, PR creation)
 * Tier 1: Budget-constrained (staging deploys, low-budget experiments)
 * Tier 2: Human approval (production deploys, spending, client-facing)
 */
export function resolveTier(action: {
  title: string;
  description: string;
  suggestedTier?: AutonomyTier;
}): AutonomyTier {
  // If explicitly marked, respect it (but never downgrade from Tier 2)
  if (action.suggestedTier === "2") return "2";

  const text = `${action.title} ${action.description}`.toLowerCase();

  // Check Tier 2 keywords
  for (const keyword of TIER_2_KEYWORDS) {
    if (text.includes(keyword)) return "2";
  }

  // Check Tier 1 keywords
  for (const keyword of TIER_1_KEYWORDS) {
    if (text.includes(keyword)) return "1";
  }

  // If suggested Tier 1, keep it
  if (action.suggestedTier === "1") return "1";

  // Default: Tier 0 (autonomous)
  return "0";
}
