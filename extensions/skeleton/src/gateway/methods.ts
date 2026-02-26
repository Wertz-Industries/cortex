import crypto from "node:crypto";
import type { GatewayRequestHandlerOptions, OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { Objective } from "../data/schemas.js";
import type { SkeletonStore } from "../data/store.js";
import type { Orchestrator } from "../engine/orchestrator.js";
import type { GuiAdapter } from "../gui/gui-adapter.js";

type Respond = GatewayRequestHandlerOptions["respond"];

function sendError(respond: Respond, err: unknown): void {
  respond(false, { error: err instanceof Error ? err.message : String(err) });
}

export function registerSkeletonGatewayMethods(
  api: OpenClawPluginApi,
  store: SkeletonStore,
  orchestrator: Orchestrator,
  gui?: GuiAdapter,
): void {
  // ── State ─────────────────────────────────────────────────────

  api.registerGatewayMethod("skeleton.state", async ({ respond }) => {
    try {
      const state = await orchestrator.getState();
      respond(true, state);
    } catch (err) {
      sendError(respond, err);
    }
  });

  // ── Objectives CRUD ───────────────────────────────────────────

  api.registerGatewayMethod("skeleton.objectives.list", async ({ respond }) => {
    try {
      const objectives = await store.loadObjectives();
      respond(true, { objectives });
    } catch (err) {
      sendError(respond, err);
    }
  });

  api.registerGatewayMethod("skeleton.objectives.create", async ({ params, respond }) => {
    try {
      const title = typeof params?.title === "string" ? params.title.trim() : "";
      const description = typeof params?.description === "string" ? params.description : "";
      const weight =
        typeof params?.weight === "number" ? Math.min(1, Math.max(0, params.weight)) : 0.5;
      const acceptanceCriteria = Array.isArray(params?.acceptanceCriteria)
        ? params.acceptanceCriteria
        : [];

      if (!title) {
        respond(false, { error: "title required" });
        return;
      }

      const now = new Date().toISOString();
      const objective: Objective = {
        id: crypto.randomUUID(),
        title,
        description,
        weight,
        status: "active",
        tags: Array.isArray(params?.tags) ? params.tags : [],
        acceptanceCriteria,
        truthStatus: "hypothesis",
        confidence: "medium",
        createdAt: now,
        updatedAt: now,
      };

      const objectives = await store.loadObjectives();
      objectives.push(objective);
      await store.saveObjectives(objectives);

      respond(true, { objective });
    } catch (err) {
      sendError(respond, err);
    }
  });

  api.registerGatewayMethod("skeleton.objectives.update", async ({ params, respond }) => {
    try {
      const id = typeof params?.id === "string" ? params.id : "";
      if (!id) {
        respond(false, { error: "id required" });
        return;
      }

      const objectives = await store.loadObjectives();
      const idx = objectives.findIndex((o) => o.id === id);
      if (idx === -1) {
        respond(false, { error: "objective not found" });
        return;
      }

      const obj = objectives[idx]!;
      if (typeof params?.title === "string") obj.title = params.title;
      if (typeof params?.description === "string") obj.description = params.description;
      if (typeof params?.weight === "number") obj.weight = Math.min(1, Math.max(0, params.weight));
      if (typeof params?.status === "string") obj.status = params.status as Objective["status"];
      if (typeof params?.truthStatus === "string")
        obj.truthStatus = params.truthStatus as Objective["truthStatus"];
      if (typeof params?.confidence === "string")
        obj.confidence = params.confidence as Objective["confidence"];
      if (Array.isArray(params?.tags)) obj.tags = params.tags;
      if (Array.isArray(params?.acceptanceCriteria))
        obj.acceptanceCriteria = params.acceptanceCriteria;
      obj.updatedAt = new Date().toISOString();

      objectives[idx] = obj;
      await store.saveObjectives(objectives);

      respond(true, { objective: obj });
    } catch (err) {
      sendError(respond, err);
    }
  });

  api.registerGatewayMethod("skeleton.objectives.delete", async ({ params, respond }) => {
    try {
      const id = typeof params?.id === "string" ? params.id : "";
      if (!id) {
        respond(false, { error: "id required" });
        return;
      }

      const objectives = await store.loadObjectives();
      const filtered = objectives.filter((o) => o.id !== id);
      if (filtered.length === objectives.length) {
        respond(false, { error: "objective not found" });
        return;
      }

      await store.saveObjectives(filtered);
      respond(true, { deleted: id });
    } catch (err) {
      sendError(respond, err);
    }
  });

  // ── Tasks ─────────────────────────────────────────────────────

  api.registerGatewayMethod("skeleton.tasks.list", async ({ respond }) => {
    try {
      const tasks = await store.loadTasks();
      respond(true, { tasks });
    } catch (err) {
      sendError(respond, err);
    }
  });

  api.registerGatewayMethod("skeleton.tasks.detail", async ({ params, respond }) => {
    try {
      const id = typeof params?.id === "string" ? params.id : "";
      if (!id) {
        respond(false, { error: "id required" });
        return;
      }
      const tasks = await store.loadTasks();
      const task = tasks.find((t) => t.id === id);
      if (!task) {
        respond(false, { error: "task not found" });
        return;
      }
      // Include related runs
      const runs = await store.listRuns();
      const taskRuns = runs.filter((r) => r.taskId === id);
      respond(true, { task, runs: taskRuns });
    } catch (err) {
      sendError(respond, err);
    }
  });

  // ── History (scans, plans, runs, evals) ───────────────────────

  api.registerGatewayMethod("skeleton.scans.list", async ({ respond }) => {
    try {
      respond(true, { scans: await store.listScans() });
    } catch (err) {
      sendError(respond, err);
    }
  });

  api.registerGatewayMethod("skeleton.plans.list", async ({ respond }) => {
    try {
      respond(true, { plans: await store.listPlans() });
    } catch (err) {
      sendError(respond, err);
    }
  });

  api.registerGatewayMethod("skeleton.runs.list", async ({ respond }) => {
    try {
      respond(true, { runs: await store.listRuns() });
    } catch (err) {
      sendError(respond, err);
    }
  });

  api.registerGatewayMethod("skeleton.evals.list", async ({ respond }) => {
    try {
      respond(true, { evaluations: await store.listEvaluations() });
    } catch (err) {
      sendError(respond, err);
    }
  });

  // ── Cost + Budget ─────────────────────────────────────────────

  api.registerGatewayMethod("skeleton.cost.summary", async ({ respond }) => {
    try {
      const runs = await store.listRuns();
      const byProvider: Record<string, number> = {};
      const byPhase: Record<string, number> = {};
      let total = 0;

      for (const run of runs) {
        byProvider[run.provider] = (byProvider[run.provider] ?? 0) + run.costUsd;
        byPhase[run.phase] = (byPhase[run.phase] ?? 0) + run.costUsd;
        total += run.costUsd;
      }

      respond(true, { total, byProvider, byPhase, runCount: runs.length });
    } catch (err) {
      sendError(respond, err);
    }
  });

  api.registerGatewayMethod("skeleton.budget.status", async ({ respond }) => {
    try {
      const budget = await store.loadBudgetState();
      const config = await store.loadConfig();
      respond(true, { budget, caps: config.budgets });
    } catch (err) {
      sendError(respond, err);
    }
  });

  // ── Logs ──────────────────────────────────────────────────────

  api.registerGatewayMethod("skeleton.decisions", async ({ respond }) => {
    try {
      respond(true, { decisions: await store.loadDecisions() });
    } catch (err) {
      sendError(respond, err);
    }
  });

  api.registerGatewayMethod("skeleton.experiments", async ({ respond }) => {
    try {
      respond(true, { experiments: await store.loadExperiments() });
    } catch (err) {
      sendError(respond, err);
    }
  });

  // ── Loop Control ──────────────────────────────────────────────

  api.registerGatewayMethod("skeleton.pause", async ({ respond }) => {
    try {
      await orchestrator.pause();
      respond(true, { paused: true });
    } catch (err) {
      sendError(respond, err);
    }
  });

  api.registerGatewayMethod("skeleton.resume", async ({ respond }) => {
    try {
      await orchestrator.resume();
      respond(true, { resumed: true });
    } catch (err) {
      sendError(respond, err);
    }
  });

  api.registerGatewayMethod("skeleton.trigger", async ({ params, respond }) => {
    try {
      const preset = typeof params?.preset === "string" ? params.preset : undefined;
      const result = await orchestrator.trigger(preset);
      respond(true, result);
    } catch (err) {
      sendError(respond, err);
    }
  });

  // ── Approvals ────────────────────────────────────────────────

  api.registerGatewayMethod("skeleton.approve", async ({ params, respond }) => {
    try {
      const taskId = typeof params?.taskId === "string" ? params.taskId : "";
      if (!taskId) {
        respond(false, { error: "taskId required" });
        return;
      }
      const tasks = await store.loadTasks();
      const task = tasks.find((t) => t.id === taskId);
      if (!task || task.state !== "awaiting_approval") {
        respond(false, { error: "Task not found or not awaiting approval" });
        return;
      }
      task.state = "building";
      task.updatedAt = new Date().toISOString();
      await store.saveTasks(tasks);
      respond(true, { task });
    } catch (err) {
      sendError(respond, err);
    }
  });

  api.registerGatewayMethod("skeleton.reject", async ({ params, respond }) => {
    try {
      const taskId = typeof params?.taskId === "string" ? params.taskId : "";
      const reason = typeof params?.reason === "string" ? params.reason : "Rejected by operator";
      if (!taskId) {
        respond(false, { error: "taskId required" });
        return;
      }
      const tasks = await store.loadTasks();
      const task = tasks.find((t) => t.id === taskId);
      if (!task || task.state !== "awaiting_approval") {
        respond(false, { error: "Task not found or not awaiting approval" });
        return;
      }
      task.state = "failed";
      task.error = reason;
      task.updatedAt = new Date().toISOString();
      await store.saveTasks(tasks);
      respond(true, { task });
    } catch (err) {
      sendError(respond, err);
    }
  });

  // ── Config ────────────────────────────────────────────────────

  api.registerGatewayMethod("skeleton.config.get", async ({ respond }) => {
    try {
      const config = await store.loadConfig();
      respond(true, { config });
    } catch (err) {
      sendError(respond, err);
    }
  });

  api.registerGatewayMethod("skeleton.config.set", async ({ params, respond }) => {
    try {
      const config = await store.loadConfig();

      if (
        typeof params?.mode === "string" &&
        ["simulation", "selective", "live"].includes(params.mode)
      ) {
        config.mode = params.mode as "simulation" | "selective" | "live";
      }
      if (typeof params?.cycleCooldownMinutes === "number" && params.cycleCooldownMinutes >= 1) {
        config.cycleCooldownMinutes = params.cycleCooldownMinutes;
      }
      if (params?.budgets && typeof params.budgets === "object") {
        Object.assign(config.budgets, params.budgets);
      }
      if (params?.selectiveProviders && typeof params.selectiveProviders === "object") {
        Object.assign(config.selectiveProviders, params.selectiveProviders);
      }

      await store.saveConfig(config);
      await orchestrator.reloadConfig();
      respond(true, { config });
    } catch (err) {
      sendError(respond, err);
    }
  });

  // ── GUI Automation ───────────────────────────────────────────

  if (gui) {
    api.registerGatewayMethod("skeleton.gui.screenshot", async ({ params, respond }) => {
      try {
        const region = params?.region as
          | { x: number; y: number; width: number; height: number }
          | undefined;
        const result = await gui.screenshot(region);
        respond(true, result);
      } catch (err) {
        sendError(respond, err);
      }
    });

    api.registerGatewayMethod("skeleton.gui.click", async ({ params, respond }) => {
      try {
        const x = params?.x as number;
        const y = params?.y as number;
        const button = (params?.button as "left" | "right" | "middle") ?? "left";
        await gui.click(x, y, { button });
        respond(true, { clicked: true });
      } catch (err) {
        sendError(respond, err);
      }
    });

    api.registerGatewayMethod("skeleton.gui.type", async ({ params, respond }) => {
      try {
        const text = params?.text as string;
        await gui.type(text);
        respond(true, { typed: true });
      } catch (err) {
        sendError(respond, err);
      }
    });

    api.registerGatewayMethod("skeleton.gui.hotkey", async ({ params, respond }) => {
      try {
        const keys = params?.keys as string[];
        await gui.hotkey(...keys);
        respond(true, { pressed: true });
      } catch (err) {
        sendError(respond, err);
      }
    });

    api.registerGatewayMethod("skeleton.gui.moveto", async ({ params, respond }) => {
      try {
        const x = params?.x as number;
        const y = params?.y as number;
        await gui.moveTo(x, y);
        respond(true, { moved: true });
      } catch (err) {
        sendError(respond, err);
      }
    });

    api.registerGatewayMethod("skeleton.gui.screensize", async ({ respond }) => {
      try {
        const size = await gui.screenSize();
        respond(true, size);
      } catch (err) {
        sendError(respond, err);
      }
    });

    api.registerGatewayMethod("skeleton.gui.mousepos", async ({ respond }) => {
      try {
        const pos = await gui.mousePosition();
        respond(true, pos);
      } catch (err) {
        sendError(respond, err);
      }
    });

    api.registerGatewayMethod("skeleton.gui.scroll", async ({ params, respond }) => {
      try {
        const amount = params?.amount as number;
        const x = params?.x as number | undefined;
        const y = params?.y as number | undefined;
        await gui.scroll(amount, x, y);
        respond(true, { scrolled: true });
      } catch (err) {
        sendError(respond, err);
      }
    });

    api.registerGatewayMethod("skeleton.gui.locate", async ({ params, respond }) => {
      try {
        const imagePath = params?.imagePath as string;
        const confidence = (params?.confidence as number) ?? 0.8;
        const result = await gui.locate(imagePath, confidence);
        respond(true, result);
      } catch (err) {
        sendError(respond, err);
      }
    });

    api.registerGatewayMethod("skeleton.gui.drag", async ({ params, respond }) => {
      try {
        const { fromX, fromY, toX, toY, duration } = params as {
          fromX: number;
          fromY: number;
          toX: number;
          toY: number;
          duration?: number;
        };
        await gui.drag(fromX, fromY, toX, toY, { duration });
        respond(true, { dragged: true });
      } catch (err) {
        sendError(respond, err);
      }
    });
  }
}
