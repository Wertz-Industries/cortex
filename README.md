# Cortex

Autonomous AI nervous system for Wertz Industries.

Forked from [OpenClaw](https://github.com/openclaw/openclaw) (MIT license).

## Architecture

- **Brain**: Claude Code (Opus via Max subscription)
- **Body**: Cortex (this system) — messaging, scheduling, hooks, memory, node orchestration
- **Hands**: Fleet nodes (Mac Studio, MacBook, Windows PC)
- **Ears**: Telegram, logs, events, sensors
- **Eyes**: File system, RAG index, network monitoring
- **Voice**: Telegram, terminal output

## Setup

```bash
pnpm install
pnpm build
```

## License

MIT — see LICENSE

---

Built by Wertz Industries. Powered by Claude.
