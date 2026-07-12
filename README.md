# SwiggyAgent

A customer-facing AI ordering concierge for **Swiggy Food, Instamart, and Dineout** — a
chat-first web app (Swiggy-inspired UI) where customers search, build carts, apply coupons,
place COD orders, track deliveries live, and book tables, all by talking to the agent in
English or Hinglish, by voice, or by attaching a photo (a dish, a grocery list, a menu).

## What's here

| Layer | Path | Notes |
|---|---|---|
| Chat UI | `src/app/page.tsx`, `src/components/` | Swiggy-styled cards: restaurants, menus (veg marks, bestseller tags), Instamart product grid, cart with bill breakdown, slot picker, order tracker, confirm gate |
| Agent loop | `src/lib/agent/` | Claude (`claude-sonnet-5`) + 18 typed tools; streams over SSE; **checkout/booking tools are gated** — the backend pauses and requires a UI Confirm tap before executing |
| Swiggy gateway | `src/lib/gateway/` | One typed interface, two impls: `mock.ts` (stateful simulator, default) and `mcp.ts` (real MCP clients for `mcp.swiggy.com/{food,im,dineout}` with per-user bearer tokens) |
| Live tracking | `src/lib/store.ts`, `/api/orders/stream` | Background poller pushes status changes (confirmed → preparing → out for delivery → delivered) into the chat via SSE |
| API | `src/app/api/` | `chat`, `confirm`, `session`, `orders`, `orders/stream`, `auth/swiggy/login` (real-mode OAuth stub pending Builders Club whitelist) |
| Scripts | `scripts/` | `npm run smoke` (18-step gateway E2E), `npm run discover-tools` (dumps real `tools/list` from Swiggy staging after OAuth) |
| Research | `docs/` | [Swiggy MCP review](docs/swiggy-mcp-review.md) · [architecture](docs/agent-architecture.md) |

## Run it

```bash
npm install
cp .env.example .env.local   # add an LLM key (see below)
npm run dev                  # http://localhost:3000
```

### Choosing the LLM (paid vs free)

The agent loop is provider-pluggable (`src/lib/agent/llm.ts`):

- **Claude (`ANTHROPIC_API_KEY`)** — best quality for this tool-heavy, multi-step
  agent; pay-per-use (no free tier on the Anthropic API).
- **Free tiers via any OpenAI-compatible endpoint** — set `OPENAI_API_KEY`,
  `OPENAI_BASE_URL`, `OPENAI_MODEL` (presets for **Google Gemini**, **Groq**, and
  **OpenRouter** are in `.env.example`). Gemini's free tier is the best default:
  it supports tool calling **and** vision (needed for the photo features).
  Auto-selected when no Anthropic key is set; force with `LLM_PROVIDER=openai`.

Free tiers are rate-limited and the smaller models make more tool-calling
mistakes — fine for development and demos, not for real customers.

- **Mock mode (default, `SWIGGY_MODE=mock`)** — full product experience against a built-in
  simulator of Swiggy's servers (Bengaluru fixtures). "Connect Swiggy" links instantly.
  No Swiggy account needed.
- **Design preview without any key** — open `http://localhost:3000/?demo=1` to see every
  card type on a seeded conversation.
- **Real mode (`SWIGGY_MODE=real`)** — points the same gateway interface at Swiggy's MCP
  servers. Requires: (1) run `npm run discover-tools` on your machine to OAuth via
  localhost and dump the live tool schemas into `docs/tool-schemas/`, (2) reconcile
  `DEFAULT_TOOL_MAP` in `src/lib/gateway/mcp.ts` (or set `SWIGGY_TOOLMAP_JSON`),
  (3) Swiggy Builders Club approval + redirect-URI whitelisting for the hosted OAuth flow.

## Verify

```bash
npm run smoke   # mock gateway end-to-end: food, instamart, dineout flows
npm run build   # type-check + production build
```

## Safety rails (by design)

- Swiggy MCP orders are **COD-only and non-cancellable** → `place_food_order`,
  `place_instamart_order`, `book_table` are never auto-executed. The agent loop pauses,
  the UI shows the exact cart/bill snapshot, and only an explicit **Confirm** tap
  (`POST /api/confirm`) executes the call.
- The model only sees tool results — it cannot invent menu items or prices, and cards are
  rendered from tool data, not model text.
- Per-user tokens live server-side only; the model and the browser never see them.

## Roadmap

Phase 2+: real-mode OAuth callback once whitelisted, Postgres/Redis persistence, agentic
UPI (Razorpay/NPCI Reserve Pay) when Swiggy opens it to third-party surfaces, spend caps,
multi-user accounts. See [docs/agent-architecture.md](docs/agent-architecture.md).
