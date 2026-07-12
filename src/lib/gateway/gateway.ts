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

/**
 * SwiggyGateway abstracts the three Swiggy MCP servers (food / im / dineout)
 * behind one typed interface. Two implementations:
 *   - MockSwiggyGateway: in-process fixtures, used for local dev & demos
 *   - McpSwiggyGateway:  real JSON-RPC calls to mcp.swiggy.com with the
 *                        customer's OAuth bearer token
 * The agent's tools call ONLY this interface, so swapping mock → real is a
 * config change (SWIGGY_MODE=real), not an agent change.
 */
export interface SwiggyGateway {
  // shared
  getAddresses(): Promise<Address[]>;

  // food
  searchRestaurants(query: string, addressId: string): Promise<Restaurant[]>;
  getMenu(restaurantId: string): Promise<{ restaurant: Restaurant; items: MenuItem[] }>;
  addToFoodCart(restaurantId: string, itemId: string, qty: number, note?: string): Promise<Cart>;
  removeFromFoodCart(itemId: string): Promise<Cart>;
  getFoodCart(): Promise<Cart>;
  listFoodCoupons(): Promise<Coupon[]>;
  applyFoodCoupon(code: string): Promise<Cart>;
  placeFoodOrder(addressId: string): Promise<Order>;

  // instamart
  searchProducts(query: string, addressId: string): Promise<Product[]>;
  addToImCart(productId: string, qty: number): Promise<Cart>;
  removeFromImCart(productId: string): Promise<Cart>;
  getImCart(): Promise<Cart>;
  placeImOrder(addressId: string): Promise<Order>;

  // shared post-order
  trackOrder(orderId: string): Promise<Order>;

  // dineout
  searchDineout(query: string, area?: string): Promise<DineoutRestaurant[]>;
  getSlots(restaurantId: string, date: string, partySize: number): Promise<{ restaurant: DineoutRestaurant; slots: Slot[] }>;
  bookTable(restaurantId: string, date: string, time: string, partySize: number): Promise<Booking>;
}

export class GatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GatewayError";
  }
}
