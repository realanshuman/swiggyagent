import type { UiItem } from "@/lib/thread";

/**
 * Seed thread for `/?demo=1` — renders every card type without needing the
 * agent or an API key. Used for design review and screenshots only.
 */
export const DEMO_THREAD: UiItem[] = [
  { id: "d1", role: "user", text: "Get me a paneer roll under ₹300 from a well-rated place", images: [] },
  {
    id: "d2",
    role: "agent",
    parts: [
      {
        kind: "card",
        card: {
          kind: "addresses",
          addresses: [
            { id: "addr-home", label: "Home", line: "221, 4th Cross, HAL 2nd Stage", area: "Indiranagar", city: "Bengaluru" },
            { id: "addr-work", label: "Work", line: "WeWork Galaxy, 43 Residency Rd", area: "Ashok Nagar", city: "Bengaluru" },
          ],
        },
      },
      { kind: "text", text: "Which address should I deliver to?" },
    ],
  },
  { id: "d3", role: "user", text: "Home", images: [] },
  {
    id: "d4",
    role: "agent",
    parts: [
      {
        kind: "card",
        card: {
          kind: "restaurants",
          restaurants: [
            { id: "r-rolls", name: "Kolkata Roll Express", cuisines: ["Rolls", "Kathi"], rating: 4.4, ratingCount: "12K+", etaMinutes: 22, priceForTwo: 300, offer: "50% OFF up to ₹100", area: "Indiranagar", imageEmoji: "🌯" },
            { id: "r-healthy", name: "Salad Days", cuisines: ["Healthy", "Bowls"], rating: 4.4, ratingCount: "3K+", etaMinutes: 24, priceForTwo: 450, offer: "20% OFF", area: "Indiranagar", imageEmoji: "🥗" },
          ],
        },
      },
      { kind: "text", text: "Kolkata Roll Express has a ₹189 Paneer Tikka Roll rated 4.5 — want me to add it?" },
    ],
  },
  { id: "d5", role: "user", text: "Haan, add karo and apply the best coupon", images: [] },
  {
    id: "d6",
    role: "agent",
    parts: [
      {
        kind: "card",
        card: {
          kind: "cart",
          cart: {
            vertical: "food",
            restaurantId: "r-rolls",
            restaurantName: "Kolkata Roll Express",
            lines: [{ itemId: "m-ptr", name: "Paneer Tikka Roll", unitPrice: 189, qty: 1, isVeg: true }],
            bill: { itemTotal: 189, deliveryFee: 35, platformFee: 10, gst: 5, discount: 95, grandTotal: 144, appliedCoupon: "WELCOME50" },
          },
        },
      },
      {
        kind: "confirm",
        confirmation: {
          id: "cfm-demo",
          kind: "food_order",
          title: "Confirm food order",
          summaryLines: ["From Kolkata Roll Express", "1 × Paneer Tikka Roll — ₹189", "Coupon WELCOME50: −₹95", "Deliver to Home: 221, 4th Cross, Indiranagar"],
          totalLabel: "₹144 · Cash on Delivery",
          warning: "COD order — it CANNOT be cancelled once placed.",
        },
        resolved: "approved",
      },
      {
        kind: "card",
        card: {
          kind: "order_status",
          order: {
            id: "FD-202601",
            vertical: "food",
            placedAt: Date.now() - 4 * 60_000,
            status: "out_for_delivery",
            etaMinutes: 12,
            address: { id: "addr-home", label: "Home", line: "221, 4th Cross", area: "Indiranagar", city: "Bengaluru" },
            cart: {
              vertical: "food",
              restaurantName: "Kolkata Roll Express",
              lines: [{ itemId: "m-ptr", name: "Paneer Tikka Roll", unitPrice: 189, qty: 1, isVeg: true }],
              bill: { itemTotal: 189, deliveryFee: 35, platformFee: 10, gst: 5, discount: 95, grandTotal: 144, appliedCoupon: "WELCOME50" },
            },
            paymentMethod: "COD",
          },
        },
      },
      { kind: "text", text: "Order placed! 🛵 Rahul has picked it up — arriving in ~12 minutes." },
    ],
  },
  { id: "d7", role: "notice", text: "🛵 FD-202601 is out for delivery — ~12 min" },
];
