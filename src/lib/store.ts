import type Anthropic from "@anthropic-ai/sdk";
import { EventEmitter } from "node:events";
import { MockSwiggyGateway } from "./gateway/mock";
import { McpSwiggyGateway } from "./gateway/mcp";
import type { SwiggyGateway } from "./gateway/gateway";
import type { ChatEvent, ConfirmationRequest, Order } from "./types";

export interface PendingConfirmation {
  request: ConfirmationRequest;
  toolUseId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  /** Conversation snapshot up to and including the assistant turn that asked. */
  messages: Anthropic.MessageParam[];
  createdAt: number;
}

export interface Session {
  id: string;
  swiggyConnected: boolean;
  swiggyAccessToken?: string;
  gateway: SwiggyGateway;
  /** Anthropic-format conversation history. */
  messages: Anthropic.MessageParam[];
  pending: Map<string, PendingConfirmation>;
  orders: Order[];
  bookings: { id: string; label: string; at: number }[];
  /** Live event bus for tracking pushes (order_update events). */
  bus: EventEmitter;
  trackedOrderIds: Set<string>;
  turnActive: boolean;
}

const TRACK_POLL_MS = 10_000;

/**
 * In-memory store, module-level singleton (survives route reloads via
 * globalThis in dev). MVP scope — swap for Postgres/Redis before production.
 */
class Store {
  private sessions = new Map<string, Session>();
  private pollTimer?: NodeJS.Timeout;

  getOrCreate(sessionId: string): Session {
    let s = this.sessions.get(sessionId);
    if (!s) {
      s = {
        id: sessionId,
        swiggyConnected: false,
        gateway: this.buildGateway(undefined),
        messages: [],
        pending: new Map(),
        orders: [],
        bookings: [],
        bus: new EventEmitter().setMaxListeners(50),
        trackedOrderIds: new Set(),
        turnActive: false,
      };
      this.sessions.set(sessionId, s);
    }
    return s;
  }

  connectSwiggy(session: Session, accessToken?: string): void {
    session.swiggyConnected = true;
    session.swiggyAccessToken = accessToken;
    session.gateway = this.buildGateway(accessToken);
  }

  disconnectSwiggy(session: Session): void {
    session.swiggyConnected = false;
    session.swiggyAccessToken = undefined;
    session.gateway = this.buildGateway(undefined);
    session.messages = [];
    session.pending.clear();
  }

  private buildGateway(accessToken?: string): SwiggyGateway {
    if (process.env.SWIGGY_MODE === "real" && accessToken) {
      return new McpSwiggyGateway({
        foodUrl: process.env.SWIGGY_FOOD_URL ?? "https://mcp.swiggy.com/food",
        imUrl: process.env.SWIGGY_IM_URL ?? "https://mcp.swiggy.com/im",
        dineoutUrl: process.env.SWIGGY_DINEOUT_URL ?? "https://mcp.swiggy.com/dineout",
        accessToken,
      });
    }
    return new MockSwiggyGateway();
  }

  /** Register an order for background tracking pushes. */
  trackOrder(session: Session, order: Order): void {
    session.orders.unshift(order);
    session.trackedOrderIds.add(order.id);
    this.ensurePoller();
  }

  private ensurePoller(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(async () => {
      let anyActive = false;
      for (const session of this.sessions.values()) {
        for (const orderId of session.trackedOrderIds) {
          anyActive = true;
          try {
            const fresh = await session.gateway.trackOrder(orderId);
            const idx = session.orders.findIndex((o) => o.id === orderId);
            const prevStatus = idx >= 0 ? session.orders[idx].status : undefined;
            if (idx >= 0) session.orders[idx] = fresh;
            if (fresh.status !== prevStatus) {
              const event: ChatEvent = { type: "order_update", order: fresh };
              session.bus.emit("event", event);
            }
            if (fresh.status === "delivered") session.trackedOrderIds.delete(orderId);
          } catch {
            // transient tracking failures are fine; next tick retries
          }
        }
      }
      if (!anyActive && this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = undefined;
      }
    }, TRACK_POLL_MS);
  }
}

// Survive Next.js dev-mode module reloads.
const g = globalThis as unknown as { __swiggyagentStore?: Store };
export const store: Store = g.__swiggyagentStore ?? (g.__swiggyagentStore = new Store());
