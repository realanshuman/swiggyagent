// ---------- Domain types (shared by mock + real Swiggy MCP gateways) ----------

export type Vertical = "food" | "instamart" | "dineout";

export interface Address {
  id: string;
  label: string; // "Home", "Work"…
  line: string;
  area: string;
  city: string;
}

export interface Restaurant {
  id: string;
  name: string;
  cuisines: string[];
  rating: number;
  ratingCount: string; // "10K+"
  etaMinutes: number;
  priceForTwo: number; // ₹
  offer?: string;
  area: string;
  imageEmoji: string; // stand-in for CDN imagery in mock mode
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  description?: string;
  price: number; // ₹
  isVeg: boolean;
  rating?: number;
  bestseller?: boolean;
  customizations?: { name: string; options: { label: string; delta: number }[] }[];
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  quantityLabel: string; // "500 g", "1 L"
  price: number;
  mrp: number;
  category: string;
  etaMinutes: number;
  imageEmoji: string;
  inStock: boolean;
}

export interface CartLine {
  itemId: string;
  name: string;
  unitPrice: number;
  qty: number;
  isVeg?: boolean;
  note?: string; // chosen customizations, freeform
}

export interface Bill {
  itemTotal: number;
  deliveryFee: number;
  platformFee: number;
  gst: number;
  discount: number;
  grandTotal: number;
  appliedCoupon?: string;
}

export interface Cart {
  vertical: Extract<Vertical, "food" | "instamart">;
  restaurantId?: string;
  restaurantName?: string;
  lines: CartLine[];
  bill: Bill;
}

export type OrderStatus =
  | "placed"
  | "confirmed"
  | "preparing"
  | "out_for_delivery"
  | "delivered";

export interface Order {
  id: string;
  vertical: Extract<Vertical, "food" | "instamart">;
  placedAt: number; // epoch ms
  status: OrderStatus;
  etaMinutes: number;
  address: Address;
  cart: Cart;
  paymentMethod: "COD";
}

export interface DineoutRestaurant {
  id: string;
  name: string;
  cuisines: string[];
  rating: number;
  costForTwo: number;
  area: string;
  offer?: string;
  imageEmoji: string;
}

export interface Slot {
  time: string; // "19:30"
  date: string; // "2026-07-12"
  available: boolean;
}

export interface Booking {
  id: string;
  restaurantId: string;
  restaurantName: string;
  date: string;
  time: string;
  partySize: number;
  status: "confirmed";
}

export interface Coupon {
  code: string;
  description: string;
}

// ---------- Chat event protocol (server → client over SSE) ----------

export type CardPayload =
  | { kind: "addresses"; addresses: Address[] }
  | { kind: "restaurants"; restaurants: Restaurant[] }
  | { kind: "menu"; restaurantName: string; items: MenuItem[] }
  | { kind: "products"; products: Product[] }
  | { kind: "cart"; cart: Cart }
  | { kind: "dineout"; restaurants: DineoutRestaurant[] }
  | { kind: "slots"; restaurantName: string; restaurantId: string; partySize: number; slots: Slot[] }
  | { kind: "booking"; booking: Booking }
  | { kind: "order_status"; order: Order };

export interface ConfirmationRequest {
  id: string;
  kind: "food_order" | "instamart_order" | "dineout_booking";
  title: string;
  summaryLines: string[];
  totalLabel?: string; // "₹ 517 · Cash on Delivery"
  warning: string;
}

export type ChatEvent =
  | { type: "status"; text: string } // "Searching restaurants…"
  | { type: "text_delta"; text: string }
  | { type: "card"; card: CardPayload }
  | { type: "confirm_request"; confirmation: ConfirmationRequest }
  | { type: "order_placed"; order: Order }
  | { type: "order_update"; order: Order } // live tracking push
  | { type: "connected"; connected: boolean } // swiggy account state
  | { type: "error"; message: string }
  | { type: "done" };

// ---------- Client → server ----------

export interface ChatRequestBody {
  message: string;
  images?: { mediaType: string; dataBase64: string }[];
}

export interface ConfirmRequestBody {
  confirmationId: string;
  approve: boolean;
}
