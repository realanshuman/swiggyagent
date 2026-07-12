import type {
  Address,
  Bill,
  Booking,
  Cart,
  CartLine,
  Coupon,
  DineoutRestaurant,
  MenuItem,
  Order,
  OrderStatus,
  Product,
  Restaurant,
  Slot,
} from "../types";
import { GatewayError, type SwiggyGateway } from "./gateway";
import { ADDRESSES, DINEOUT, MENUS, PRODUCTS, RESTAURANTS } from "./fixtures";

const COUPONS: Coupon[] = [
  { code: "WELCOME50", description: "50% off up to ₹100 on your first agent order" },
  { code: "FREEDEL", description: "Free delivery above ₹199" },
];

/** Mock order lifecycle: minutes elapsed since placement → status. */
const STATUS_TIMELINE: [number, OrderStatus][] = [
  [0, "placed"],
  [1, "confirmed"],
  [3, "preparing"],
  [8, "out_for_delivery"],
  [20, "delivered"],
];

function computeBill(lines: CartLine[], coupon?: string): Bill {
  const itemTotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const deliveryFee = itemTotal === 0 ? 0 : coupon === "FREEDEL" && itemTotal >= 199 ? 0 : itemTotal >= 500 ? 0 : 35;
  const platformFee = itemTotal === 0 ? 0 : 10;
  const discount = coupon === "WELCOME50" ? Math.min(100, Math.round(itemTotal * 0.5)) : 0;
  const gst = Math.round((itemTotal - discount) * 0.05);
  return {
    itemTotal,
    deliveryFee,
    platformFee,
    gst,
    discount,
    grandTotal: Math.max(0, itemTotal - discount + deliveryFee + platformFee + gst),
    appliedCoupon: coupon,
  };
}

function matchScore(haystack: string[], query: string): number {
  const words = query.toLowerCase().split(/[\s,]+/).filter((w) => w.length > 2);
  const text = haystack.join(" ").toLowerCase();
  if (words.length === 0) return 1;
  return words.reduce((s, w) => s + (text.includes(w) ? 1 : 0), 0);
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Stateful in-process mock of the three Swiggy MCP servers, scoped to one
 * user session. Mirrors documented behavior: address-scoped search, single-
 * restaurant food carts, COD-only checkout, non-cancellable orders, and a
 * time-driven delivery status lifecycle.
 */
export class MockSwiggyGateway implements SwiggyGateway {
  private foodLines: CartLine[] = [];
  private foodRestaurantId?: string;
  private foodCoupon?: string;
  private imLines: CartLine[] = [];
  private orders = new Map<string, Order>();
  private bookings = new Map<string, Booking>();
  private orderSeq = 1;

  async getAddresses(): Promise<Address[]> {
    await delay(120);
    return ADDRESSES;
  }

  // ---------------- Food ----------------

  async searchRestaurants(query: string): Promise<Restaurant[]> {
    await delay(250);
    const scored = RESTAURANTS.map((r) => ({
      r,
      score: matchScore([r.name, ...r.cuisines, r.area, ...(MENUS[r.id] ?? []).map((m) => m.name)], query),
    }));
    const hits = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score || b.r.rating - a.r.rating);
    return (hits.length ? hits : scored.sort((a, b) => b.r.rating - a.r.rating)).slice(0, 4).map((s) => s.r);
  }

  async getMenu(restaurantId: string) {
    await delay(200);
    const restaurant = RESTAURANTS.find((r) => r.id === restaurantId);
    const items = MENUS[restaurantId];
    if (!restaurant || !items) throw new GatewayError(`Unknown restaurant: ${restaurantId}`);
    return { restaurant, items };
  }

  async addToFoodCart(restaurantId: string, itemId: string, qty: number, note?: string): Promise<Cart> {
    await delay(150);
    const item = (MENUS[restaurantId] ?? []).find((m) => m.id === itemId);
    if (!item) throw new GatewayError(`Item ${itemId} not on the menu of ${restaurantId}`);
    if (this.foodRestaurantId && this.foodRestaurantId !== restaurantId && this.foodLines.length > 0) {
      throw new GatewayError(
        "Cart already has items from another restaurant. Swiggy food carts are single-restaurant — clear the cart or finish that order first."
      );
    }
    this.foodRestaurantId = restaurantId;
    const existing = this.foodLines.find((l) => l.itemId === itemId && l.note === note);
    if (existing) existing.qty += qty;
    else this.foodLines.push({ itemId, name: item.name, unitPrice: item.price, qty, isVeg: item.isVeg, note });
    return this.getFoodCart();
  }

  async removeFromFoodCart(itemId: string): Promise<Cart> {
    await delay(100);
    const line = this.foodLines.find((l) => l.itemId === itemId);
    if (line) {
      line.qty -= 1;
      if (line.qty <= 0) this.foodLines = this.foodLines.filter((l) => l !== line);
    }
    if (this.foodLines.length === 0) {
      this.foodRestaurantId = undefined;
      this.foodCoupon = undefined;
    }
    return this.getFoodCart();
  }

  async getFoodCart(): Promise<Cart> {
    const restaurant = RESTAURANTS.find((r) => r.id === this.foodRestaurantId);
    return {
      vertical: "food",
      restaurantId: this.foodRestaurantId,
      restaurantName: restaurant?.name,
      lines: structuredClone(this.foodLines),
      bill: computeBill(this.foodLines, this.foodCoupon),
    };
  }

  async listFoodCoupons(): Promise<Coupon[]> {
    await delay(100);
    return COUPONS;
  }

  async applyFoodCoupon(code: string): Promise<Cart> {
    await delay(150);
    if (!COUPONS.some((c) => c.code === code)) throw new GatewayError(`Coupon ${code} is not applicable`);
    this.foodCoupon = code;
    return this.getFoodCart();
  }

  async placeFoodOrder(addressId: string): Promise<Order> {
    await delay(400);
    if (this.foodLines.length === 0) throw new GatewayError("Food cart is empty");
    const cart = await this.getFoodCart();
    const order = this.createOrder("food", cart, addressId, 25 + Math.floor(Math.random() * 10));
    this.foodLines = [];
    this.foodRestaurantId = undefined;
    this.foodCoupon = undefined;
    return order;
  }

  // ---------------- Instamart ----------------

  async searchProducts(query: string): Promise<Product[]> {
    await delay(220);
    const scored = PRODUCTS.map((p) => ({ p, score: matchScore([p.name, p.brand, p.category], query) }));
    const hits = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
    return (hits.length ? hits : scored).slice(0, 6).map((s) => s.p);
  }

  async addToImCart(productId: string, qty: number): Promise<Cart> {
    await delay(120);
    const product = PRODUCTS.find((p) => p.id === productId);
    if (!product) throw new GatewayError(`Unknown product: ${productId}`);
    if (!product.inStock) throw new GatewayError(`${product.name} is out of stock at the selected address`);
    const existing = this.imLines.find((l) => l.itemId === productId);
    if (existing) existing.qty += qty;
    else this.imLines.push({ itemId: productId, name: `${product.name} (${product.quantityLabel})`, unitPrice: product.price, qty });
    return this.getImCart();
  }

  async removeFromImCart(productId: string): Promise<Cart> {
    await delay(100);
    const line = this.imLines.find((l) => l.itemId === productId);
    if (line) {
      line.qty -= 1;
      if (line.qty <= 0) this.imLines = this.imLines.filter((l) => l !== line);
    }
    return this.getImCart();
  }

  async getImCart(): Promise<Cart> {
    return { vertical: "instamart", lines: structuredClone(this.imLines), bill: computeBill(this.imLines) };
  }

  async placeImOrder(addressId: string): Promise<Order> {
    await delay(350);
    if (this.imLines.length === 0) throw new GatewayError("Instamart cart is empty");
    const cart = await this.getImCart();
    const order = this.createOrder("instamart", cart, addressId, 9 + Math.floor(Math.random() * 5));
    this.imLines = [];
    return order;
  }

  // ---------------- Tracking ----------------

  async trackOrder(orderId: string): Promise<Order> {
    await delay(150);
    const order = this.orders.get(orderId);
    if (!order) throw new GatewayError(`Unknown order: ${orderId}`);
    const elapsedMin = (Date.now() - order.placedAt) / 60_000;
    // Mock deliveries run on an accelerated clock (1 real min ≈ 4 timeline min)
    const accelerated = elapsedMin * 4;
    let status: OrderStatus = "placed";
    for (const [t, s] of STATUS_TIMELINE) if (accelerated >= t) status = s;
    order.status = status;
    order.etaMinutes = Math.max(0, Math.round(order.etaMinutes - elapsedMin));
    return structuredClone(order);
  }

  // ---------------- Dineout ----------------

  async searchDineout(query: string, area?: string): Promise<DineoutRestaurant[]> {
    await delay(230);
    const scored = DINEOUT.map((d) => ({
      d,
      score: matchScore([d.name, ...d.cuisines, d.area], [query, area ?? ""].join(" ")),
    }));
    const hits = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score || b.d.rating - a.d.rating);
    return (hits.length ? hits : scored.sort((a, b) => b.d.rating - a.d.rating)).slice(0, 4).map((s) => s.d);
  }

  async getSlots(restaurantId: string, date: string, partySize: number) {
    await delay(200);
    const restaurant = DINEOUT.find((d) => d.id === restaurantId);
    if (!restaurant) throw new GatewayError(`Unknown dineout restaurant: ${restaurantId}`);
    if (partySize > 12) throw new GatewayError("Parties above 12 need the restaurant's events desk");
    const slots: Slot[] = ["12:30", "13:00", "13:30", "19:00", "19:30", "20:00", "20:30", "21:00"].map((time, i) => ({
      time,
      date,
      available: (i + restaurantId.length + partySize) % 3 !== 0,
    }));
    return { restaurant, slots };
  }

  async bookTable(restaurantId: string, date: string, time: string, partySize: number): Promise<Booking> {
    await delay(400);
    const { restaurant, slots } = await this.getSlots(restaurantId, date, partySize);
    const slot = slots.find((s) => s.time === time);
    if (!slot) throw new GatewayError(`No ${time} slot on ${date}`);
    if (!slot.available) throw new GatewayError(`The ${time} slot on ${date} is full — pick another`);
    const booking: Booking = {
      id: `BKG-${1000 + this.bookings.size + 1}`,
      restaurantId,
      restaurantName: restaurant.name,
      date,
      time,
      partySize,
      status: "confirmed",
    };
    this.bookings.set(booking.id, booking);
    return booking;
  }

  // ---------------- internals ----------------

  private createOrder(vertical: "food" | "instamart", cart: Cart, addressId: string, etaMinutes: number): Order {
    const address = ADDRESSES.find((a) => a.id === addressId);
    if (!address) throw new GatewayError(`Unknown address: ${addressId}. Fetch addresses first.`);
    const order: Order = {
      id: `${vertical === "food" ? "FD" : "IM"}-${202600 + this.orderSeq++}`,
      vertical,
      placedAt: Date.now(),
      status: "placed",
      etaMinutes,
      address,
      cart,
      paymentMethod: "COD",
    };
    this.orders.set(order.id, order);
    return order;
  }
}
