# Swiggy MCP — API & Capability Review

_Research date: July 2026. Compiled from Swiggy's official MCP server manifest, the Swiggy
Builders Club documentation and press coverage, and real-world integration reports.
See [Sources](#sources)._

---

## 1. What Swiggy exposes

Swiggy publishes **three official MCP (Model Context Protocol) servers**, one per vertical,
all speaking **streamable HTTP (JSON-RPC)** — so any MCP-compatible client, SDK, or agent
framework works without a bespoke SDK:

| Vertical | Server URL | What it covers |
|---|---|---|
| **Swiggy Food** | `https://mcp.swiggy.com/food` | Restaurant food delivery |
| **Instamart** | `https://mcp.swiggy.com/im` | Quick-commerce grocery delivery |
| **Dineout** | `https://mcp.swiggy.com/dineout` | Restaurant table reservations |

Public technical entry points:

- Manifest / setup repo: <https://github.com/Swiggy/swiggy-mcp-server-manifest>
- Developer portal ("Swiggy Builders Club"): <https://mcp.swiggy.com/builders/>
- Developer quickstart: <https://mcp.swiggy.com/builders/docs/start/developer/>
- Consumer setup guide (Claude / ChatGPT / Gemini): <https://mcp.swiggy.com/builders/docs/start/consumer/>

The Builders Club docs state the three servers expose **~35 tools in total** (the launch
announcement said 18+; an open-source integration built against the live servers counted
**13 Food + 8 Instamart + 7 Dineout = 28** at the time it was written — the catalogue is
growing). Full per-tool parameter docs, a canonical error catalogue, SLA, rate limits, and
versioning policy live behind the Builders Club docs portal.

## 2. Tool surface per vertical

Exact tool names/schemas are only enumerable after an authenticated `tools/list` call
(the docs portal and live servers are gated), but the officially documented capability
surface is:

### Swiggy Food (~13 tools)
- **Address**: fetch the user's saved delivery addresses (e.g. `get_addresses` — confirmed
  in the official quickstart), select active address.
- **Discovery**: search restaurants by cuisine, restaurant name, or dish; filtered by the
  delivery location.
- **Menu**: browse a restaurant's full menu with item pricing, variants, and customizations.
- **Cart**: add/remove items with customizations, view cart with bill breakdown.
- **Offers**: apply coupons / offers to the cart.
- **Checkout**: place the order — **Cash on Delivery only** via MCP today.
- **Tracking**: track live delivery status of the placed order.

The official "order food end-to-end" workflow chains **7 tools**: address → restaurant
search → menu → cart build → offer application → COD checkout → tracking.

### Instamart (~8 tools)
- **Discovery**: search grocery/household products by name, category, or brand.
- **Cart**: add/remove items, view cart with detailed cost breakdown (item total, delivery
  fee, taxes).
- **Checkout**: place the order with instant confirmation — **COD only**.
- **Tracking**: order status tracking.

Instamart is, per Swiggy, the first quick-commerce platform globally on MCP.

### Dineout (~7 tools)
- **Discovery**: find restaurants by location, cuisine, and preferences, with ratings and
  offers.
- **Details**: restaurant detail + menu browsing.
- **Availability**: check available time slots for a party size/date.
- **Booking**: reserve a table — **free (non-prepaid) bookings only** today.

## 3. Authentication & access model

### Consumer flow (individual users connecting their own account)
1. The MCP server is added to a client (Claude connectors, ChatGPT developer-mode MCP,
   Cursor/VS Code, or any MCP client).
2. On first tool use, the server initiates **OAuth 2.0**; the user logs in with their
   Swiggy account via **phone-number + OTP**, then consents.
3. The client holds a **bearer token** (with refresh) for subsequent JSON-RPC calls; the
   server resolves the user's identity, addresses, carts, and payment eligibility from the
   token.

Swiggy **whitelists OAuth redirect URIs**. Pre-approved ones include Claude
(`https://claude.ai/api/mcp/auth_callback`, `claude://claude.ai/settings/connectors`),
ChatGPT (`https://chatgpt.com/connector_platform_oauth_redirect`), VS Code, Postman, and
`localhost` variants for development. **Custom redirect URIs (i.e. your own web app's
callback) require contacting Swiggy for whitelisting** — this is the key gate for building
a customer-facing product.

### Developer / enterprise flow — Swiggy Builders Club (launched April 2026)
- **Invite-led access program** for developers, startups, and enterprises building agents
  on Swiggy's Food / Instamart / Dineout APIs.
- **Local development is free and permissionless**: the quickstart runs end-to-end on
  `localhost` against a **staging endpoint** without approval.
- **Production access requires application + review** (they ask for a demo video);
  production credentials are issued once the staging integration is validated.
- For multi-tenant platforms (our case — many customers on one app), Builders Club offers
  **delegated OAuth**, plus custom rate limits, SLAs, co-branding, and dedicated support
  for enterprise tiers.
- The program runs on AWS infrastructure (Amazon Bedrock is referenced for model access on
  Swiggy's side).
- Note: before Builders Club, the manifest repo said third-party app development was
  "not permitted pending security review" — Builders Club is now the sanctioned path.

## 4. Payments

| Channel | Status |
|---|---|
| **Cash on Delivery** | Live on Food & Instamart MCP checkout today. Orders are **non-cancellable once placed** — the official manifest warns clients to review the cart before checkout. |
| **Agentic UPI** | Announced Feb 2026 (Razorpay + NPCI at the India AI Impact Summit): **UPI Reserve Pay** enables one-time, consent-based authorization with a per-merchant spending cap, letting AI agents pay without repeated PIN prompts. **Swiggy is a launch partner** (alongside Zomato and Zepto), initially on Claude. Expect this to supersede the COD-only limitation. |
| Dineout | Free bookings only; no prepaid/deposit bookings via MCP yet. |

## 5. Known constraints & sharp edges (from the manifest + field reports)

1. **COD only** for Food/Instamart MCP orders (until agentic UPI rollout completes).
2. **Orders cannot be cancelled** after placement via the API — the agent must implement
   an explicit user-confirmation gate before checkout.
3. **Session conflict warning**: Swiggy's manifest says *"Do not open the Swiggy app while
   using these MCP integrations"* — concurrent app/MCP sessions can clobber carts.
4. **Uneven coverage in the wild** (Jan 2026 reports): menus of some large chains
   intermittently failed to load; Instamart checkout was not exposed end-to-end at launch.
   Treat every tool call as fallible and build retry/fallback UX.
5. **India-only**, tied to Swiggy's serviceable locations; results are address-scoped, so
   address selection must happen early in every flow.
6. **Rate limits & SLA** are tier-dependent and documented per-tool in the gated Builders
   Club docs; custom limits are negotiated at enterprise tier.
7. **No cancellation/refund/support tools** are exposed via MCP today — post-order issues
   still route to the Swiggy app/support.

## 6. Canonical end-to-end flows

**Food order**
`get addresses → confirm address → search restaurants → fetch menu → add items (with
customizations) → view cart & bill → apply coupon → [user confirms] → place COD order →
track delivery`

**Instamart order**
`confirm address → search products (name/brand/category) → build cart → review cost
breakdown → [user confirms] → COD checkout → track`

**Dineout booking**
`search restaurants (location/cuisine) → get details/menu/offers → check slot availability
(date, party size) → [user confirms] → book table → confirmation`

Every mutating step (cart add, checkout, booking) is a normal MCP `tools/call`; responses
return a `{ success, data }` envelope.

## 7. What this means for our product

Everything needed for a **customer-facing conversational ordering agent** exists today:
discovery, carts, offers, checkout, tracking, and reservations across all three verticals,
over a standard protocol with per-user OAuth. The two real dependencies on Swiggy are:

1. **Redirect-URI whitelisting / Builders Club production approval** for our own chat UI's
   OAuth callback (multi-tenant delegated OAuth).
2. **Agentic UPI enablement** if we want prepaid orders; otherwise we launch COD-only.

See [`agent-architecture.md`](./agent-architecture.md) for the proposed build.

---

## Sources

- [Swiggy MCP server manifest (official GitHub)](https://github.com/Swiggy/swiggy-mcp-server-manifest)
- [Swiggy Builders Club portal](https://mcp.swiggy.com/builders/) · [Developer quickstart](https://mcp.swiggy.com/builders/docs/start/developer/) · [Consumer setup](https://mcp.swiggy.com/builders/docs/start/consumer/) · [Docs home](https://mcp.swiggy.com/builders/docs/)
- [Swiggy press release — Builders Club launch](https://www.swiggy.com/corporate/press-release/swiggy-to-launch-builders-club-giving-developers-and-enterprises-access-to-its-ai-commerce-stack/) ([AWS mirror](https://press.aboutamazon.com/aws/2026/4/swiggy-to-launch-builders-club-giving-developers-and-enterprises-access-to-its-ai-commerce-stack))
- [MediaNama — real-world test of ordering via ChatGPT](https://www.medianama.com/2026/01/223-ordering-chatgpt-swiggy-services-working/)
- [Razorpay — Agentic payments for UPI on Claude](https://razorpay.com/blog/agentic-payments-and-npci/) · [Stellagent summary](https://stellagent.ai/insights/razorpay-npci-agentic-upi)
- [Swiggy voice AI agent (open-source reference integration)](https://github.com/DeepBhupatkar/swiggy-voice-ai-agent-videosdk-mcp)
- Coverage: [Business Standard](https://www.business-standard.com/companies/news/swiggy-enables-grocery-food-delivery-via-chatgpt-and-other-ai-tools-126012701092_1.html), [ImpactOnNet](https://www.impactonnet.com/more-from-impact/swiggy-integrates-food-dining-and-instamart-ordering-into-ai-chat-tools-13256.html), [Croma Unboxed](https://www.croma.com/unboxed/swiggy-integrates-mcp-food-orders-chatgpt-claude), [AI CERTs](https://www.aicerts.ai/news/consumer-ordering-automation-swiggy-opens-chatbot-food-ordering/), [Analytics India Magazine](https://analyticsindiamag.com/ai-news/swiggy-now-lets-you-order-via-chatgpt), [FoneArena](https://www.fonearena.com/blog/481152/swiggy-builders-club-features.html)
