import crypto from "node:crypto";
import type { Objective } from "../data/schemas.js";
import type { SkeletonStore } from "../data/store.js";

/**
 * SMB Opportunity Scout — first constrained end-to-end test preset.
 *
 * Creates a seed objective targeting SMB market research,
 * then triggers a full SCAN→PLAN→BUILD→SHIP_CHECK→EVAL cycle.
 */
export const SMB_SCOUT_PRESET = {
  id: "smb-scout",
  name: "SMB Opportunity Scout",
  description:
    "Research local SMB pain points → draft solution spec → build landing page → review → evaluate ROI",
};

export async function ensureSmbScoutObjective(store: SkeletonStore): Promise<Objective> {
  const objectives = await store.loadObjectives();
  const existing = objectives.find((o) => o.tags.includes("preset:smb-scout"));
  if (existing) return existing;

  const now = new Date().toISOString();
  const objective: Objective = {
    id: crypto.randomUUID(),
    title: "Find first paying SMB customer via opportunity scouting",
    description:
      "Research underserved SMB verticals in the local market. Identify businesses that lack web presence or modern tooling. Draft a micro-solution (landing page + outreach) and evaluate whether it could convert to a paying engagement.",
    weight: 0.9,
    status: "active",
    tags: ["preset:smb-scout", "revenue", "smb"],
    acceptanceCriteria: [
      "At least 2 concrete SMB pain points identified with evidence",
      "Landing page draft with clear value proposition",
      "Outreach email drafts targeting specific business types",
      "ROI estimate: cost of cycle vs potential revenue",
    ],
    truthStatus: "hypothesis",
    confidence: "medium",
    createdAt: now,
    updatedAt: now,
  };

  objectives.push(objective);
  await store.saveObjectives(objectives);
  return objective;
}
