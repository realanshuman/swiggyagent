/**
 * End-to-end smoke test of the mock gateway — the exact flows the agent
 * drives. Run: npm run smoke
 */
import type { SwiggyGateway } from "../src/lib/gateway/gateway";
import { MockSwiggyGateway } from "../src/lib/gateway/mock";

function assert(cond: unknown, label: string): void {
  if (!cond) throw new Error(`SMOKE FAIL: ${label}`);
  console.log(`✓ ${label}`);
}

async function main() {
  const gw: SwiggyGateway = new MockSwiggyGateway();

  // --- Food: address → search → menu → cart → coupon → order → track
  const addresses = await gw.getAddresses();
  assert(addresses.length >= 2, `getAddresses → ${addresses.length} addresses`);
  const home = addresses[0];

  const restaurants = await gw.searchRestaurants("paneer roll", home.id);
  assert(restaurants.length > 0, `searchRestaurants('paneer roll') → ${restaurants.map((r) => r.name).join(", ")}`);
  const rolls = restaurants[0];

  const { items } = await gw.getMenu(rolls.id);
  assert(items.length > 0, `getMenu(${rolls.name}) → ${items.length} items`);
  const paneer = items.find((i) => i.name.includes("Paneer"))!;
  assert(paneer, "menu has a paneer item");

  let cart = await gw.addToFoodCart(rolls.id, paneer.id, 2, "Extra paneer");
  assert(cart.lines[0].qty === 2, `addToFoodCart qty=2 → itemTotal ₹${cart.bill.itemTotal}`);

  // single-restaurant constraint
  let blocked = false;
  try {
    await gw.addToFoodCart("r-biryani", "m-cbir", 1);
  } catch {
    blocked = true;
  }
  assert(blocked, "second-restaurant add is rejected (single-restaurant cart)");

  cart = await gw.applyFoodCoupon("WELCOME50");
  assert(cart.bill.discount > 0, `applyFoodCoupon(WELCOME50) → −₹${cart.bill.discount}`);

  const order = await gw.placeFoodOrder(home.id);
  assert(order.id.startsWith("FD-") && order.paymentMethod === "COD", `placeFoodOrder → ${order.id} (COD ₹${order.cart.bill.grandTotal})`);

  const tracked = await gw.trackOrder(order.id);
  assert(tracked.status === "placed" || tracked.status === "confirmed", `trackOrder → ${tracked.status}`);

  const emptied = await gw.getFoodCart();
  assert(emptied.lines.length === 0, "food cart resets after checkout");

  // --- Instamart: search → cart → order
  const products = await gw.searchProducts("milk eggs bread", home.id);
  assert(products.length >= 3, `searchProducts → ${products.slice(0, 3).map((p) => p.name).join(", ")}…`);
  await gw.addToImCart("p-milk", 2);
  await gw.addToImCart("p-eggs", 1);
  const imCart = await gw.addToImCart("p-bread", 1);
  assert(imCart.lines.length === 3, `instamart cart → ${imCart.lines.length} lines, ₹${imCart.bill.grandTotal}`);

  let oosBlocked = false;
  try {
    await gw.addToImCart("p-rice", 1);
  } catch {
    oosBlocked = true;
  }
  assert(oosBlocked, "out-of-stock product is rejected");

  const imOrder = await gw.placeImOrder(home.id);
  assert(imOrder.id.startsWith("IM-"), `placeImOrder → ${imOrder.id} (COD ₹${imOrder.cart.bill.grandTotal})`);

  // --- Dineout: search → slots → book
  const dineout = await gw.searchDineout("brewery", "Indiranagar");
  assert(dineout.length > 0, `searchDineout('brewery') → ${dineout.map((d) => d.name).join(", ")}`);
  const spot = dineout[0];
  const { slots } = await gw.getSlots(spot.id, "2026-07-12", 2);
  const free = slots.find((s) => s.available)!;
  assert(free, `getSlots → ${slots.filter((s) => s.available).length} open slots`);
  const booking = await gw.bookTable(spot.id, free.date, free.time, 2);
  assert(booking.status === "confirmed", `bookTable → ${booking.id} at ${booking.restaurantName} ${booking.time}`);

  const fullSlot = slots.find((s) => !s.available);
  if (fullSlot) {
    let slotBlocked = false;
    try {
      await gw.bookTable(spot.id, fullSlot.date, fullSlot.time, 2);
    } catch {
      slotBlocked = true;
    }
    assert(slotBlocked, "booking a full slot is rejected");
  }

  console.log("\nAll mock-gateway flows pass. 🎉");
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
