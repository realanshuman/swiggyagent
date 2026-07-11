# Proposed Architecture — Customer-Facing Swiggy AI Agent

Goal: a **live chat UI** where any customer can talk to an agent that acts across
**Swiggy Food, Instamart, and Dineout** — search, build carts, apply offers, place orders,
track deliveries, and book tables — with their own Swiggy account.

This builds directly on the capabilities documented in
[`swiggy-mcp-review.md`](./swiggy-mcp-review.md).

---

## 1. High-level design

```
┌─────────────┐   WebSocket/SSE   ┌──────────────────┐   Anthropic API    ┌─────────────┐
│   Chat UI    │ ◄──────────────► │  Agent Backend    │ ◄────────────────► │  Claude      │
│ (web/mobile) │                  │  (orchestrator)   │  (MCP connector /  │  (LLM)       │
└─────────────┘                  │                    │   tool bridging)   └─────────────┘
       │                          │  ┌─────────────┐  │
       │  OAuth redirect          │  │ Token vault │  │        streamable HTTP + Bearer
       └──────────────────────────┼──┤  (per-user) │──┼──► https://mcp.swiggy.com/food
                                  │  └─────────────┘  ├──► https://mcp.swiggy.com/im
                                  │  Postgres + Redis ├──► https://mcp.swiggy.com/dineout
                                  └──────────────────┘
```

Three moving parts:

1. **Chat UI** — streaming chat (web first), with rich structured cards for restaurants,
   menus, carts, and order status, plus hard confirmation buttons for checkout.
2. **Agent backend** — owns the conversation loop: calls Claude with the three Swiggy MCP
   servers attached, executes tool calls with the *customer's* OAuth token, enforces
   guardrails, persists sessions.
3. **Swiggy MCP servers** — the system of record; we hold no catalogue data, only tokens
   and conversation state.

## 2. Per-user auth (the critical path)

- Each customer links their Swiggy account once: our backend runs the **OAuth 2.0
  authorization-code flow** against Swiggy, with our app's callback URL
  (`https://app.<ourdomain>/auth/swiggy/callback`).
- **Dependency**: Swiggy must whitelist that redirect URI → apply to **Swiggy Builders
  Club** (staging is free on localhost today; production needs approval + demo video).
  Multi-tenant products use their **delegated OAuth** offering.
- Store access/refresh tokens encrypted (KMS-wrapped) in a token vault keyed by user ID;
  refresh proactively; on 401 from any tool call, trigger silent refresh then re-auth UX.
- One Swiggy identity per chat user; tokens are injected per-request into the MCP
  `Authorization: Bearer` header — never exposed to the model or the client.

## 3. Agent loop

Use the **Anthropic Messages API MCP connector** (`mcp_servers` block) — it lets the API
call remote MCP servers directly with a per-user `authorization_token`, so we don't have to
re-implement JSON-RPC plumbing:

```jsonc
{
  "model": "claude-sonnet-5",
  "mcp_servers": [
    { "type": "url", "url": "https://mcp.swiggy.com/food",    "name": "swiggy-food",  "authorization_token": "<user token>" },
    { "type": "url", "url": "https://mcp.swiggy.com/im",      "name": "instamart",    "authorization_token": "<user token>" },
    { "type": "url", "url": "https://mcp.swiggy.com/dineout", "name": "dineout",      "authorization_token": "<user token>" }
  ],
  "messages": [ /* conversation */ ]
}
```

(Fallback: run our own MCP clients in the backend and expose the tools to Claude as
ordinary `tools` — needed anyway if we add non-MCP capabilities later.)

**System prompt responsibilities**
- Route intent → vertical (food vs. grocery vs. dining) and keep flows separate.
- Always resolve/confirm the **delivery address first** (results are address-scoped).
- Always show the **full cart + bill breakdown** and get explicit confirmation before
  checkout (orders are **non-cancellable**, COD).
- Never invent menu items/prices — only present tool results.

## 4. Guardrails (non-negotiable)

| Risk | Control |
|---|---|
| Irreversible COD orders | Checkout/booking tools are **gated outside the model**: the backend intercepts `place_order`/`book_table`-class calls and requires an explicit UI confirmation click (not just chat text) before executing. |
| Overspend | Per-user order-value caps and daily order-count caps in the backend; later, UPI Reserve Pay per-merchant limits. |
| Cart clobbering | Warn users not to use the Swiggy app mid-session (official Swiggy guidance); re-fetch cart before checkout and re-display if it changed. |
| Flaky tools (observed in the wild) | Timeouts, one retry, then graceful fallback message; circuit-breaker per vertical. |
| Prompt injection via catalogue data | Treat tool results as data; the confirmation gate means injected text can never place an order by itself. |
| Privacy | Tokens and addresses never enter model logs; PII-scrubbed tracing. |

## 5. Chat UI

- **Transport**: WebSocket (or SSE) streaming of model tokens + structured events.
- **Structured messages**: alongside text, the backend emits typed events the UI renders
  as cards — `restaurant_list`, `menu_items`, `cart_summary`, `order_confirmation_request`
  (with Confirm/Cancel buttons), `order_status`, `booking_slots`.
- **Order tracking**: after checkout, backend polls the tracking tool and pushes status
  updates into the thread.
- Session history in Postgres; active conversation state in Redis.

## 6. Suggested stack

| Layer | Choice |
|---|---|
| Frontend | Next.js/React + WebSocket streaming chat |
| Backend | Node (TypeScript) or Python (FastAPI); Anthropic SDK with MCP connector |
| Model | `claude-sonnet-5` for the main loop (tool-heavy, low latency); `claude-haiku-4-5` for cheap classification/routing |
| Storage | Postgres (users, sessions, order log), Redis (live session state), KMS-encrypted token vault |
| Observability | Full tool-call audit log per order (who confirmed, when, cart snapshot) |

## 7. Build phases

1. **Phase 0 — Sandbox spike (now, no approval needed)**: localhost OAuth against Swiggy
   staging; CLI/dev chat that completes one Food order end-to-end (7-tool flow), one
   Instamart cart, one Dineout availability check. Enumerate the real `tools/list` schemas
   for all three servers and check them into this repo.
2. **Phase 1 — Chat MVP**: web chat UI + backend loop + confirmation gates + token vault;
   Food vertical only, COD.
3. **Phase 2 — All verticals**: add Instamart + Dineout routing, order tracking push,
   coupons/offers surfacing.
4. **Phase 3 — Production**: apply to Builders Club with demo video; custom redirect URI
   whitelisting; rate-limit/SLA agreement; load + abuse testing.
5. **Phase 4 — Payments**: adopt agentic UPI (Razorpay/NPCI Reserve Pay) when available to
   us, replacing COD-only checkout; add spending-limit consent UX.

## 8. Open questions for Swiggy (raise during Builders Club onboarding)

- Timeline for **agentic UPI** on third-party (non-Claude-client) surfaces.
- **Order cancellation / support** tools on the roadmap?
- Exact **rate limits** per tier and per tool; webhook/push option for order status
  (vs. polling)?
- Instamart checkout parity (fully exposed end-to-end?) and Dineout paid bookings.
- Delegated OAuth specifics: token lifetimes, refresh policy, consent screen branding.
