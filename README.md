# swiggyagent

An AI agent that lets customers interact with **Swiggy Food, Instamart, and Dineout**
through a live chat UI — searching, building carts, placing orders, tracking deliveries,
and booking tables via Swiggy's official MCP servers.

## Docs

- [`docs/swiggy-mcp-review.md`](docs/swiggy-mcp-review.md) — full review of what Swiggy's
  MCP servers provide: the three servers, ~35 tools across the verticals, OAuth/access
  model, payments (COD today, agentic UPI coming), end-to-end flows, and constraints.
- [`docs/agent-architecture.md`](docs/agent-architecture.md) — proposed architecture for
  the customer-facing chat agent: per-user OAuth, Claude + MCP connector agent loop,
  checkout guardrails, chat UI design, and a phased build plan.

## Status

Research phase complete. Next step: Phase 0 sandbox spike against Swiggy's staging
endpoints (free, localhost — no approval required) to enumerate live tool schemas and
complete one end-to-end order per vertical.
