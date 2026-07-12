import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type {
  Address,
  Booking,
  Cart,
  Coupon,
  DineoutRestaurant,
  MenuItem,
  Order,
  Product,
  Restaurant,
  Slot,
} from "../types";
import { GatewayError, type SwiggyGateway } from "./gateway";

export interface SwiggyMcpConfig {
  foodUrl: string; // https://mcp.swiggy.com/food (or staging equivalent)
  imUrl: string; // https://mcp.swiggy.com/im
  dineoutUrl: string; // https://mcp.swiggy.com/dineout
  accessToken: string; // per-user OAuth bearer token
}

/**
 * Swiggy's public docs describe capabilities but the canonical tool names are
 * only visible via an authenticated `tools/list`. Run `npm run discover-tools`
 * once against staging, then correct this map (or override any entry via the
 * SWIGGY_TOOLMAP_JSON env var) — nothing else in the app needs to change.
 */
export const DEFAULT_TOOL_MAP = {
  food_get_addresses: "get_addresses",
  food_search_restaurants: "search_restaurants",
  food_get_menu: "get_menu",
  food_add_to_cart: "add_to_cart",
  food_remove_from_cart: "remove_from_cart",
  food_get_cart: "get_cart",
  food_list_coupons: "get_coupons",
  food_apply_coupon: "apply_coupon",
  food_place_order: "place_order",
  food_track_order: "track_order",
  im_search_products: "search_products",
  im_add_to_cart: "add_to_cart",
  im_remove_from_cart: "remove_from_cart",
  im_get_cart: "get_cart",
  im_place_order: "place_order",
  im_track_order: "track_order",
  do_search_restaurants: "search_restaurants",
  do_get_slots: "get_slot_availability",
  do_book_table: "book_table",
} as const;

export type ToolMap = Record<keyof typeof DEFAULT_TOOL_MAP, string>;

type ServerKey = "food" | "im" | "dineout";

/**
 * Real gateway: one MCP client per Swiggy server, authenticated with the
 * customer's bearer token. Response shapes from Swiggy are normalized into
 * our domain types in one place (`pick`/mappers below) so schema drift on
 * Swiggy's side stays contained to this file.
 */
export class McpSwiggyGateway implements SwiggyGateway {
  private clients = new Map<ServerKey, Client>();
  private toolMap: ToolMap;

  constructor(private config: SwiggyMcpConfig, toolMapOverride?: Partial<ToolMap>) {
    const envOverride = process.env.SWIGGY_TOOLMAP_JSON ? JSON.parse(process.env.SWIGGY_TOOLMAP_JSON) : {};
    this.toolMap = { ...DEFAULT_TOOL_MAP, ...envOverride, ...toolMapOverride };
  }

  private async client(server: ServerKey): Promise<Client> {
    const existing = this.clients.get(server);
    if (existing) return existing;
    const url = server === "food" ? this.config.foodUrl : server === "im" ? this.config.imUrl : this.config.dineoutUrl;
    const transport = new StreamableHTTPClientTransport(new URL(url), {
      requestInit: { headers: { Authorization: `Bearer ${this.config.accessToken}` } },
    });
    const client = new Client({ name: "swiggyagent", version: "0.1.0" });
    await client.connect(transport);
    this.clients.set(server, client);
    return client;
  }

  private async call<T = unknown>(server: ServerKey, mapKey: keyof ToolMap, args: Record<string, unknown>): Promise<T> {
    const client = await this.client(server);
    const result = await client.callTool({ name: this.toolMap[mapKey], arguments: args });
    if (result.isError) {
      const text = (result.content as { type: string; text?: string }[] | undefined)
        ?.map((c) => c.text ?? "")
        .join(" ");
      throw new GatewayError(text || `Swiggy ${String(mapKey)} failed`);
    }
    // Swiggy returns { success, data } envelopes; prefer structuredContent, fall back to text JSON.
    const structured = (result as { structuredContent?: unknown }).structuredContent;
    if (structured) return unwrap(structured) as T;
    const text = (result.content as { type: string; text?: string }[] | undefined)?.find((c) => c.type === "text")?.text;
    if (!text) throw new GatewayError(`Empty response from Swiggy ${String(mapKey)}`);
    try {
      return unwrap(JSON.parse(text)) as T;
    } catch {
      return text as unknown as T;
    }
  }

  async close(): Promise<void> {
    await Promise.allSettled([...this.clients.values()].map((c) => c.close()));
    this.clients.clear();
  }

  // The mappers below are written against the documented response shapes and
  // MUST be revalidated against real payloads during the Phase-0 staging spike.

  async getAddresses(): Promise<Address[]> {
    const data = await this.call<Record<string, unknown>[]>("food", "food_get_addresses", {});
    return asArray(data).map((a) => ({
      id: str(a, "id", "address_id"),
      label: str(a, "label", "annotation", "tag") || "Saved address",
      line: str(a, "line", "address", "address_line"),
      area: str(a, "area", "locality"),
      city: str(a, "city"),
    }));
  }

  async searchRestaurants(query: string, addressId: string): Promise<Restaurant[]> {
    const data = await this.call("food", "food_search_restaurants", { query, address_id: addressId });
    return asArray(data).map(mapRestaurant);
  }

  async getMenu(restaurantId: string) {
    const data = await this.call<Record<string, unknown>>("food", "food_get_menu", { restaurant_id: restaurantId });
    const obj = data as Record<string, unknown>;
    const restaurant = mapRestaurant((obj.restaurant as Record<string, unknown>) ?? obj);
    const items = asArray(obj.items ?? obj.menu).map((m) => mapMenuItem(m, restaurantId));
    return { restaurant, items };
  }

  async addToFoodCart(restaurantId: string, itemId: string, qty: number, note?: string): Promise<Cart> {
    const data = await this.call("food", "food_add_to_cart", {
      restaurant_id: restaurantId,
      item_id: itemId,
      quantity: qty,
      ...(note ? { customization: note } : {}),
    });
    return mapCart(data, "food");
  }

  async removeFromFoodCart(itemId: string): Promise<Cart> {
    return mapCart(await this.call("food", "food_remove_from_cart", { item_id: itemId }), "food");
  }

  async getFoodCart(): Promise<Cart> {
    return mapCart(await this.call("food", "food_get_cart", {}), "food");
  }

  async listFoodCoupons(): Promise<Coupon[]> {
    const data = await this.call("food", "food_list_coupons", {});
    return asArray(data).map((c) => ({ code: str(c, "code", "coupon_code"), description: str(c, "description", "title") }));
  }

  async applyFoodCoupon(code: string): Promise<Cart> {
    return mapCart(await this.call("food", "food_apply_coupon", { code }), "food");
  }

  async placeFoodOrder(addressId: string): Promise<Order> {
    const data = await this.call("food", "food_place_order", { address_id: addressId, payment_method: "COD" });
    return mapOrder(data, "food");
  }

  async searchProducts(query: string, addressId: string): Promise<Product[]> {
    const data = await this.call("im", "im_search_products", { query, address_id: addressId });
    return asArray(data).map((p) => ({
      id: str(p, "id", "product_id"),
      name: str(p, "name"),
      brand: str(p, "brand"),
      quantityLabel: str(p, "quantity", "unit", "quantity_label"),
      price: num(p, "price", "offer_price"),
      mrp: num(p, "mrp", "price"),
      category: str(p, "category"),
      etaMinutes: num(p, "eta_minutes", "sla") || 10,
      imageEmoji: "🛒",
      inStock: (p as Record<string, unknown>).in_stock !== false,
    }));
  }

  async addToImCart(productId: string, qty: number): Promise<Cart> {
    return mapCart(await this.call("im", "im_add_to_cart", { product_id: productId, quantity: qty }), "instamart");
  }

  async removeFromImCart(productId: string): Promise<Cart> {
    return mapCart(await this.call("im", "im_remove_from_cart", { product_id: productId }), "instamart");
  }

  async getImCart(): Promise<Cart> {
    return mapCart(await this.call("im", "im_get_cart", {}), "instamart");
  }

  async placeImOrder(addressId: string): Promise<Order> {
    const data = await this.call("im", "im_place_order", { address_id: addressId, payment_method: "COD" });
    return mapOrder(data, "instamart");
  }

  async trackOrder(orderId: string): Promise<Order> {
    const server: ServerKey = orderId.startsWith("IM") ? "im" : "food";
    const data = await this.call(server, server === "im" ? "im_track_order" : "food_track_order", { order_id: orderId });
    return mapOrder(data, server === "im" ? "instamart" : "food");
  }

  async searchDineout(query: string, area?: string): Promise<DineoutRestaurant[]> {
    const data = await this.call("dineout", "do_search_restaurants", { query, ...(area ? { area } : {}) });
    return asArray(data).map((d) => ({
      id: str(d, "id", "restaurant_id"),
      name: str(d, "name"),
      cuisines: (d.cuisines as string[]) ?? [],
      rating: num(d, "rating"),
      costForTwo: num(d, "cost_for_two", "costForTwo"),
      area: str(d, "area", "locality"),
      offer: str(d, "offer") || undefined,
      imageEmoji: "🍽️",
    }));
  }

  async getSlots(restaurantId: string, date: string, partySize: number) {
    const data = await this.call<Record<string, unknown>>("dineout", "do_get_slots", {
      restaurant_id: restaurantId,
      date,
      party_size: partySize,
    });
    const obj = data as Record<string, unknown>;
    const restaurants = await this.searchDineout(str(obj, "restaurant_name") || restaurantId);
    const restaurant = restaurants[0] ?? {
      id: restaurantId, name: restaurantId, cuisines: [], rating: 0, costForTwo: 0, area: "", imageEmoji: "🍽️",
    };
    const slots: Slot[] = asArray(obj.slots ?? obj).map((s) => ({
      time: str(s, "time", "slot"),
      date: str(s, "date") || date,
      available: (s as Record<string, unknown>).available !== false,
    }));
    return { restaurant, slots };
  }

  async bookTable(restaurantId: string, date: string, time: string, partySize: number): Promise<Booking> {
    const data = await this.call<Record<string, unknown>>("dineout", "do_book_table", {
      restaurant_id: restaurantId,
      date,
      time,
      party_size: partySize,
    });
    const obj = data as Record<string, unknown>;
    return {
      id: str(obj, "booking_id", "id"),
      restaurantId,
      restaurantName: str(obj, "restaurant_name", "name") || restaurantId,
      date: str(obj, "date") || date,
      time: str(obj, "time") || time,
      partySize: num(obj, "party_size") || partySize,
      status: "confirmed",
    };
  }
}

// ---------- response normalization helpers ----------

function unwrap(payload: unknown): unknown {
  if (payload && typeof payload === "object" && "data" in (payload as object)) {
    const p = payload as { success?: boolean; data: unknown; error?: { message?: string } | string };
    if (p.success === false) {
      const msg = typeof p.error === "string" ? p.error : p.error?.message;
      throw new GatewayError(msg || "Swiggy returned success=false");
    }
    return p.data;
  }
  return payload;
}

function asArray(v: unknown): Record<string, unknown>[] {
  if (Array.isArray(v)) return v as Record<string, unknown>[];
  if (v && typeof v === "object") {
    for (const key of ["restaurants", "items", "products", "results", "list", "addresses"]) {
      const inner = (v as Record<string, unknown>)[key];
      if (Array.isArray(inner)) return inner as Record<string, unknown>[];
    }
  }
  return [];
}

function str(o: unknown, ...keys: string[]): string {
  const rec = (o ?? {}) as Record<string, unknown>;
  for (const k of keys) if (typeof rec[k] === "string" && rec[k]) return rec[k] as string;
  for (const k of keys) if (typeof rec[k] === "number") return String(rec[k]);
  return "";
}

function num(o: unknown, ...keys: string[]): number {
  const rec = (o ?? {}) as Record<string, unknown>;
  for (const k of keys) {
    if (typeof rec[k] === "number") return rec[k] as number;
    if (typeof rec[k] === "string" && !Number.isNaN(Number(rec[k]))) return Number(rec[k]);
  }
  return 0;
}

function mapRestaurant(r: Record<string, unknown>): Restaurant {
  return {
    id: str(r, "id", "restaurant_id"),
    name: str(r, "name"),
    cuisines: (r.cuisines as string[]) ?? [],
    rating: num(r, "rating", "avg_rating"),
    ratingCount: str(r, "rating_count", "total_ratings"),
    etaMinutes: num(r, "eta_minutes", "sla", "delivery_time"),
    priceForTwo: num(r, "price_for_two", "cost_for_two"),
    offer: str(r, "offer", "offer_text") || undefined,
    area: str(r, "area", "locality"),
    imageEmoji: "🍽️",
  };
}

function mapMenuItem(m: Record<string, unknown>, restaurantId: string): MenuItem {
  return {
    id: str(m, "id", "item_id"),
    restaurantId,
    name: str(m, "name"),
    description: str(m, "description") || undefined,
    price: num(m, "price"),
    isVeg: (m as Record<string, unknown>).is_veg !== false && (m as Record<string, unknown>).isVeg !== false,
    rating: num(m, "rating") || undefined,
    bestseller: Boolean((m as Record<string, unknown>).bestseller),
  };
}

function mapCart(data: unknown, vertical: "food" | "instamart"): Cart {
  const obj = (data ?? {}) as Record<string, unknown>;
  const lines = asArray(obj.lines ?? obj.items ?? obj.cart_items).map((l) => ({
    itemId: str(l, "item_id", "product_id", "id"),
    name: str(l, "name"),
    unitPrice: num(l, "unit_price", "price"),
    qty: num(l, "qty", "quantity") || 1,
    isVeg: (l as Record<string, unknown>).is_veg as boolean | undefined,
    note: str(l, "customization", "note") || undefined,
  }));
  const bill = (obj.bill ?? obj) as Record<string, unknown>;
  return {
    vertical,
    restaurantId: str(obj, "restaurant_id") || undefined,
    restaurantName: str(obj, "restaurant_name") || undefined,
    lines,
    bill: {
      itemTotal: num(bill, "item_total", "subtotal"),
      deliveryFee: num(bill, "delivery_fee"),
      platformFee: num(bill, "platform_fee"),
      gst: num(bill, "gst", "taxes"),
      discount: num(bill, "discount"),
      grandTotal: num(bill, "grand_total", "total", "to_pay"),
      appliedCoupon: str(bill, "applied_coupon", "coupon") || undefined,
    },
  };
}

function mapOrder(data: unknown, vertical: "food" | "instamart"): Order {
  const obj = (data ?? {}) as Record<string, unknown>;
  const statusRaw = str(obj, "status").toLowerCase().replace(/\s+/g, "_");
  const status = (["placed", "confirmed", "preparing", "out_for_delivery", "delivered"] as const).includes(
    statusRaw as never
  )
    ? (statusRaw as Order["status"])
    : "placed";
  return {
    id: str(obj, "order_id", "id"),
    vertical,
    placedAt: num(obj, "placed_at") || Date.now(),
    status,
    etaMinutes: num(obj, "eta_minutes", "sla"),
    address: {
      id: str(obj.address, "id"),
      label: str(obj.address, "label"),
      line: str(obj.address, "line", "address"),
      area: str(obj.address, "area"),
      city: str(obj.address, "city"),
    },
    cart: mapCart(obj.cart ?? obj, vertical),
    paymentMethod: "COD",
  };
}
