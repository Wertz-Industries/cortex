## Cortex Vision

Cortex is the autonomous AI nervous system for Wertz Industries.
It runs on our devices, coordinates our agents, and executes real work without waiting for human input.

This document explains the current state and direction of the project.
Project overview and setup: [`README.md`](README.md)

Cortex started as a fork of OpenClaw, a personal AI assistant framework.
We took its solid orchestration foundation and are reshaping it into something different:
a persistent, multi-node nervous system where AI agents operate autonomously across a fleet of machines.

The goal: a self-managing infrastructure where Claude (the brain) directs work across
Mac Studio, MacBook, and Windows PC nodes — handling messaging, scheduling, memory,
monitoring, and task execution without constant human oversight.

### Current Focus

Priority:

- Autonomous agent operation (Jarvis worker pattern, task queue)
- Multi-node orchestration (WertzNet mesh connectivity)
- Memory and context persistence (RAG, ChromaDB, session continuity)
- Telegram integration as primary communication channel

Next priorities:

- Hook system for event-driven automation
- Scheduled task execution (cron-like agent triggers)
- Cross-node file synchronization and state sharing
- Sensor integration (system health, network status, log monitoring)
- Self-healing: agents detect failures and recover without intervention

### Architecture Principles

- **Autonomy first.** The system should keep working when no human is watching.
  Agents pick up tasks, execute them, and report results. Human input is for
  strategy and course correction, not micromanagement.

- **Fleet-native.** Cortex assumes multiple nodes. Work routes to the right machine
  based on capability (GPU on Windows, always-on on Mac Studio, mobile on MacBook).

- **Memory is infrastructure.** Context doesn't die between sessions. RAG indexing,
  task history, and conversation memory are core services, not plugins.

- **Secure by default.** Strong defaults without killing capability. WertzNet provides
  the encrypted mesh; Cortex manages permissions and trust boundaries.

### What Cortex Is Not

- Not a chatbot framework. Conversation is one interface, not the product.
- Not a cloud service. Everything runs on our hardware.
- Not a general-purpose AI platform. This is built for one organization's needs,
  optimized for how we actually work.

### Lineage

Cortex is forked from [OpenClaw](https://github.com/openclaw/openclaw) (MIT license),
created by Peter Steinberger. We gratefully acknowledge the OpenClaw project and its
contributors for building the orchestration foundation that Cortex builds upon.

The divergence is intentional: OpenClaw is a personal assistant for individuals.
Cortex is an autonomous nervous system for an organization's machine fleet.

---

Built by Wertz Industries. Powered by Claude.
