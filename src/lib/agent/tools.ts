import type Anthropic from "@anthropic-ai/sdk";
import type { Session } from "../store";
import type { CardPayload } from "../types";

/**
 * Tools exposed to Claude. They map 1:1 onto SwiggyGateway methods — the
 * model never talks to Swiggy directly, so mock/real is invisible to it.
 *
 * GATED_TOOLS are never auto-executed: the loop pauses and the customer must
 * press Confirm in the UI (orders are COD and non-cancellable on Swiggy).
 */
export const GATED_TOOLS = new Set(["place_food_order", "place_instamart_order", "book_table"]);

export const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_addresses",
    description:
      "Get the customer's saved Swiggy delivery addresses. Call this before any food/instamart search so results are scoped to the right location.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "search_restaurants",
    description: "Search Swiggy Food restaurants by dish, cuisine, or restaurant name, scoped to a delivery address.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Dish, cuisine or restaurant name, e.g. 'paneer roll'" },
        address_id: { type: "string", description: "Delivery address id from get_addresses" },
      },
      required: ["query", "address_id"],
    },
  },
  {
    name: "get_menu",
    description: "Fetch a restaurant's menu with prices, veg/non-veg marks and customizations.",
    input_schema: {
      type: "object",
      properties: { restaurant_id: { type: "string" } },
      required: ["restaurant_id"],
    },
  },
  {
    name: "add_to_food_cart",
    description: "Add a menu item to the food cart. Food carts are single-restaurant.",
    input_schema: {
      type: "object",
      properties: {
        restaurant_id: { type: "string" },
        item_id: { type: "string" },
        qty: { type: "integer", minimum: 1 },
        note: { type: "string", description: "Chosen customizations, e.g. 'Extra paneer'" },
      },
      required: ["restaurant_id", "item_id", "qty"],
    },
  },
  {
    name: "remove_from_food_cart",
    description: "Decrement one unit of an item from the food cart.",
    input_schema: { type: "object", properties: { item_id: { type: "string" } }, required: ["item_id"] },
  },
  {
    name: "get_food_cart",
    description: "Show the current food cart with the full bill breakdown.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "list_food_coupons",
    description: "List coupons applicable to the current food cart.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "apply_food_coupon",
    description: "Apply a coupon code to the food cart.",
    input_schema: { type: "object", properties: { code: { type: "string" } }, required: ["code"] },
  },
  {
    name: "place_food_order",
    description:
      "Place the food order as Cash on Delivery. REQUIRES explicit customer confirmation via the UI — calling this pauses for a Confirm button, it never places the order directly.",
    input_schema: {
      type: "object",
      properties: { address_id: { type: "string" } },
      required: ["address_id"],
    },
  },
  {
    name: "search_products",
    description: "Search Swiggy Instamart grocery/household products by name, brand or category.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        address_id: { type: "string", description: "Delivery address id from get_addresses" },
      },
      required: ["query", "address_id"],
    },
  },
  {
    name: "add_to_instamart_cart",
    description: "Add a product to the Instamart cart.",
    input_schema: {
      type: "object",
      properties: { product_id: { type: "string" }, qty: { type: "integer", minimum: 1 } },
      required: ["product_id", "qty"],
    },
  },
  {
    name: "remove_from_instamart_cart",
    description: "Decrement one unit of a product from the Instamart cart.",
    input_schema: { type: "object", properties: { product_id: { type: "string" } }, required: ["product_id"] },
  },
  {
    name: "get_instamart_cart",
    description: "Show the current Instamart cart with the cost breakdown.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "place_instamart_order",
    description:
      "Place the Instamart order as Cash on Delivery. REQUIRES explicit customer confirmation via the UI — calling this pauses for a Confirm button.",
    input_schema: {
      type: "object",
      properties: { address_id: { type: "string" } },
      required: ["address_id"],
    },
  },
  {
    name: "track_order",
    description: "Get live status of a placed order (food or instamart).",
    input_schema: { type: "object", properties: { order_id: { type: "string" } }, required: ["order_id"] },
  },
  {
    name: "search_dineout",
    description: "Find Dineout restaurants for table reservations by cuisine, name, vibe or area.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" }, area: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "get_slots",
    description: "Check available reservation time slots for a restaurant, date and party size.",
    input_schema: {
      type: "object",
      properties: {
        restaurant_id: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
        party_size: { type: "integer", minimum: 1 },
      },
      required: ["restaurant_id", "date", "party_size"],
    },
  },
  {
    name: "book_table",
    description:
      "Book a table (free booking). REQUIRES explicit customer confirmation via the UI — calling this pauses for a Confirm button.",
    input_schema: {
      type: "object",
      properties: {
        restaurant_id: { type: "string" },
        date: { type: "string" },
        time: { type: "string" },
        party_size: { type: "integer", minimum: 1 },
      },
      required: ["restaurant_id", "date", "time", "party_size"],
    },
  },
  {
    name: "get_order_history",
    description: "List orders and bookings the customer placed through this agent, most recent first. Use for 'reorder my last order' style requests.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
];

export interface ToolOutcome {
  /** Compact JSON returned to the model. */
  resultForModel: unknown;
  /** Rich card pushed to the chat UI, if this tool produces one. */
  card?: CardPayload;
  /** Human-readable activity label, e.g. "Searching restaurants…". */
  statusText?: string;
}

/** Executes a non-gated tool against the session's gateway. */
export async function executeTool(
  session: Session,
  name: string,
  input: Record<string, unknown>
): Promise<ToolOutcome> {
  const gw = session.gateway;
  switch (name) {
    case "get_addresses": {
      const addresses = await gw.getAddresses();
      return { resultForModel: addresses, card: { kind: "addresses", addresses }, statusText: "Fetching your addresses…" };
    }
    case "search_restaurants": {
      const restaurants = await gw.searchRestaurants(String(input.query), String(input.address_id));
      return {
        resultForModel: restaurants.map(({ imageEmoji: _e, ...r }) => r),
        card: { kind: "restaurants", restaurants },
        statusText: "Searching restaurants…",
      };
    }
    case "get_menu": {
      const { restaurant, items } = await gw.getMenu(String(input.restaurant_id));
      return {
        resultForModel: { restaurant: restaurant.name, items },
        card: { kind: "menu", restaurantName: restaurant.name, items },
        statusText: `Opening ${restaurant.name}'s menu…`,
      };
    }
    case "add_to_food_cart": {
      const cart = await gw.addToFoodCart(
        String(input.restaurant_id),
        String(input.item_id),
        Number(input.qty),
        input.note ? String(input.note) : undefined
      );
      return { resultForModel: cart, card: { kind: "cart", cart }, statusText: "Adding to cart…" };
    }
    case "remove_from_food_cart": {
      const cart = await gw.removeFromFoodCart(String(input.item_id));
      return { resultForModel: cart, card: { kind: "cart", cart }, statusText: "Updating cart…" };
    }
    case "get_food_cart": {
      const cart = await gw.getFoodCart();
      return { resultForModel: cart, card: { kind: "cart", cart } };
    }
    case "list_food_coupons":
      return { resultForModel: await gw.listFoodCoupons(), statusText: "Checking offers…" };
    case "apply_food_coupon": {
      const cart = await gw.applyFoodCoupon(String(input.code));
      return { resultForModel: cart, card: { kind: "cart", cart }, statusText: "Applying coupon…" };
    }
    case "search_products": {
      const products = await gw.searchProducts(String(input.query), String(input.address_id));
      return {
        resultForModel: products.map(({ imageEmoji: _e, ...p }) => p),
        card: { kind: "products", products },
        statusText: "Searching Instamart…",
      };
    }
    case "add_to_instamart_cart": {
      const cart = await gw.addToImCart(String(input.product_id), Number(input.qty));
      return { resultForModel: cart, card: { kind: "cart", cart }, statusText: "Adding to cart…" };
    }
    case "remove_from_instamart_cart": {
      const cart = await gw.removeFromImCart(String(input.product_id));
      return { resultForModel: cart, card: { kind: "cart", cart }, statusText: "Updating cart…" };
    }
    case "get_instamart_cart": {
      const cart = await gw.getImCart();
      return { resultForModel: cart, card: { kind: "cart", cart } };
    }
    case "track_order": {
      const order = await gw.trackOrder(String(input.order_id));
      const idx = session.orders.findIndex((o) => o.id === order.id);
      if (idx >= 0) session.orders[idx] = order;
      return { resultForModel: order, card: { kind: "order_status", order }, statusText: "Tracking your order…" };
    }
    case "search_dineout": {
      const restaurants = await gw.searchDineout(String(input.query), input.area ? String(input.area) : undefined);
      return {
        resultForModel: restaurants.map(({ imageEmoji: _e, ...r }) => r),
        card: { kind: "dineout", restaurants },
        statusText: "Finding places to dine…",
      };
    }
    case "get_slots": {
      const { restaurant, slots } = await gw.getSlots(
        String(input.restaurant_id),
        String(input.date),
        Number(input.party_size)
      );
      return {
        resultForModel: { restaurant: restaurant.name, slots },
        card: {
          kind: "slots",
          restaurantName: restaurant.name,
          restaurantId: restaurant.id,
          partySize: Number(input.party_size),
          slots,
        },
        statusText: "Checking table availability…",
      };
    }
    case "get_order_history": {
      return {
        resultForModel: {
          orders: session.orders.map((o) => ({
            id: o.id,
            vertical: o.vertical,
            status: o.status,
            grandTotal: o.cart.bill.grandTotal,
            items: o.cart.lines.map((l) => `${l.qty}× ${l.name}`),
            placedAt: new Date(o.placedAt).toISOString(),
          })),
          bookings: session.bookings.map((b) => b.label),
        },
      };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/** Executes a gated tool AFTER the customer pressed Confirm. */
export async function executeGatedTool(
  session: Session,
  name: string,
  input: Record<string, unknown>
): Promise<ToolOutcome> {
  const gw = session.gateway;
  switch (name) {
    case "place_food_order": {
      const order = await gw.placeFoodOrder(String(input.address_id));
      return { resultForModel: order, card: { kind: "order_status", order } };
    }
    case "place_instamart_order": {
      const order = await gw.placeImOrder(String(input.address_id));
      return { resultForModel: order, card: { kind: "order_status", order } };
    }
    case "book_table": {
      const booking = await gw.bookTable(
        String(input.restaurant_id),
        String(input.date),
        String(input.time),
        Number(input.party_size)
      );
      session.bookings.unshift({
        id: booking.id,
        label: `${booking.restaurantName} — ${booking.date} ${booking.time}, party of ${booking.partySize}`,
        at: Date.now(),
      });
      return { resultForModel: booking, card: { kind: "booking", booking } };
    }
    default:
      throw new Error(`Not a gated tool: ${name}`);
  }
}
