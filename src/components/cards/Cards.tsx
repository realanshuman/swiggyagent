"use client";

import type {
  Address,
  Booking,
  Cart,
  CardPayload,
  ConfirmationRequest,
  DineoutRestaurant,
  MenuItem,
  Order,
  Product,
  Restaurant,
  Slot,
} from "@/lib/types";
import { RatingBadge, VegMark, rupee } from "./marks";

/** All cards call `act(text)` to speak to the agent — the chat stays the single source of truth. */
export type Act = (text: string) => void;

export function Card({ card, act, busy }: { card: CardPayload; act: Act; busy: boolean }) {
  switch (card.kind) {
    case "addresses":
      return <AddressesCard addresses={card.addresses} act={act} busy={busy} />;
    case "restaurants":
      return <RestaurantsCard restaurants={card.restaurants} act={act} busy={busy} />;
    case "menu":
      return <MenuCard restaurantName={card.restaurantName} items={card.items} act={act} busy={busy} />;
    case "products":
      return <ProductsCard products={card.products} act={act} busy={busy} />;
    case "cart":
      return <CartCard cart={card.cart} act={act} busy={busy} />;
    case "dineout":
      return <DineoutCard restaurants={card.restaurants} act={act} busy={busy} />;
    case "slots":
      return <SlotsCard {...card} act={act} busy={busy} />;
    case "booking":
      return <BookingCard booking={card.booking} />;
    case "order_status":
      return <OrderStatusCard order={card.order} act={act} busy={busy} />;
  }
}

const shell = "w-full rounded-card bg-white shadow-card border border-line overflow-hidden animate-slideup";

function AddressesCard({ addresses, act, busy }: { addresses: Address[]; act: Act; busy: boolean }) {
  return (
    <div className={shell}>
      <div className="px-4 pt-3 pb-1 text-xs font-bold uppercase tracking-wider text-slate2">Deliver to</div>
      <div className="divide-y divide-line">
        {addresses.map((a) => (
          <button
            key={a.id}
            disabled={busy}
            onClick={() => act(`Deliver to my ${a.label} address`)}
            className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-orange-50 disabled:opacity-60"
          >
            <span className="mt-0.5 text-lg">{a.label === "Home" ? "🏠" : a.label === "Work" ? "💼" : "📍"}</span>
            <span>
              <span className="block font-bold">{a.label}</span>
              <span className="block text-sm text-slate2">
                {a.line}, {a.area}, {a.city}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function RestaurantsCard({ restaurants, act, busy }: { restaurants: Restaurant[]; act: Act; busy: boolean }) {
  return (
    <div className="grid w-full gap-3 sm:grid-cols-2">
      {restaurants.map((r) => (
        <div key={r.id} className={shell}>
          <div className="relative flex h-24 items-center justify-center bg-gradient-to-br from-saffron/20 via-orange-50 to-amber-100 text-5xl">
            {r.imageEmoji}
            {r.offer ? (
              <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-ink/80 to-transparent px-3 pb-1 pt-4 text-sm font-extrabold uppercase tracking-wide text-white">
                {r.offer}
              </span>
            ) : null}
          </div>
          <div className="space-y-1 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-base font-bold">{r.name}</span>
              <RatingBadge rating={r.rating} />
            </div>
            <div className="truncate text-sm text-slate2">{r.cuisines.join(", ")}</div>
            <div className="flex items-center justify-between text-sm text-slate2">
              <span>
                {r.etaMinutes} mins · {rupee(r.priceForTwo)} for two
              </span>
              <span className="truncate pl-2">{r.area}</span>
            </div>
            <button disabled={busy} onClick={() => act(`Show me the menu of ${r.name}`)} className="btn-add mt-1 w-full">
              View menu
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function MenuCard({
  restaurantName,
  items,
  act,
  busy,
}: {
  restaurantName: string;
  items: MenuItem[];
  act: Act;
  busy: boolean;
}) {
  return (
    <div className={shell}>
      <div className="border-b border-line px-4 py-3">
        <div className="text-xs font-bold uppercase tracking-wider text-slate2">Menu</div>
        <div className="text-base font-bold">{restaurantName}</div>
      </div>
      <div className="divide-y divide-dashed divide-line">
        {items.map((m) => (
          <div key={m.id} className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <VegMark isVeg={m.isVeg} />
                {m.bestseller ? (
                  <span className="text-[11px] font-bold uppercase tracking-wide text-saffron">★ Bestseller</span>
                ) : null}
              </div>
              <div className="mt-0.5 font-bold">{m.name}</div>
              <div className="text-sm font-semibold text-ink/80">{rupee(m.price)}</div>
              {m.rating ? <RatingBadge rating={m.rating} /> : null}
              {m.description ? <p className="mt-1 line-clamp-2 text-sm text-slate2">{m.description}</p> : null}
            </div>
            <div className="flex flex-col items-center gap-1 pt-1">
              <button disabled={busy} onClick={() => act(`Add one ${m.name} from ${restaurantName} to my cart`)} className="btn-add">
                Add
              </button>
              {m.customizations?.length ? <span className="text-[10px] text-slate2">customisable</span> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductsCard({ products, act, busy }: { products: Product[]; act: Act; busy: boolean }) {
  return (
    <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
      {products.map((p) => {
        const off = p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;
        return (
          <div key={p.id} className={`${shell} relative flex flex-col`}>
            {off > 0 ? (
              <span className="absolute left-2 top-2 rounded-md bg-im px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                {off}% OFF
              </span>
            ) : null}
            <div className="flex h-16 items-center justify-center bg-violet-50 text-4xl">{p.imageEmoji}</div>
            <div className="flex grow flex-col gap-0.5 p-2.5">
              <span className="line-clamp-2 text-sm font-bold leading-tight">{p.name}</span>
              <span className="text-xs text-slate2">{p.quantityLabel} · ⏱ {p.etaMinutes} mins</span>
              <div className="mt-auto flex items-center justify-between pt-1">
                <span className="text-sm font-extrabold">
                  {rupee(p.price)}{" "}
                  {p.mrp > p.price ? <s className="text-xs font-normal text-slate2">{rupee(p.mrp)}</s> : null}
                </span>
                {p.inStock ? (
                  <button disabled={busy} onClick={() => act(`Add one ${p.name} (${p.quantityLabel}) to my Instamart cart`)} className="btn-add !px-3">
                    Add
                  </button>
                ) : (
                  <span className="text-[11px] font-bold uppercase text-slate2">Sold out</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CartCard({ cart, act, busy }: { cart: Cart; act: Act; busy: boolean }) {
  const b = cart.bill;
  const isFood = cart.vertical === "food";
  if (cart.lines.length === 0) {
    return <div className={`${shell} px-4 py-3 text-sm text-slate2`}>Your {isFood ? "food" : "Instamart"} cart is empty.</div>;
  }
  return (
    <div className={shell}>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate2">
            {isFood ? "Food cart" : "Instamart cart"}
          </div>
          {cart.restaurantName ? <div className="font-bold">{cart.restaurantName}</div> : null}
        </div>
        <span className={`rounded-md px-2 py-1 text-xs font-extrabold text-white ${isFood ? "bg-swiggy" : "bg-im"}`}>
          {cart.lines.reduce((s, l) => s + l.qty, 0)} items
        </span>
      </div>
      <div className="divide-y divide-line">
        {cart.lines.map((l) => (
          <div key={l.itemId + (l.note ?? "")} className="flex items-center justify-between gap-2 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <VegMark isVeg={l.isVeg} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{l.name}</div>
                {l.note ? <div className="truncate text-xs text-slate2">{l.note}</div> : null}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-lg border border-line">
                <button
                  disabled={busy}
                  onClick={() => act(`Remove one ${l.name} from my ${isFood ? "food" : "Instamart"} cart`)}
                  className="px-2 py-0.5 font-bold text-rating disabled:opacity-50"
                  aria-label={`Remove one ${l.name}`}
                >
                  −
                </button>
                <span className="px-1 text-sm font-bold text-rating">{l.qty}</span>
                <button
                  disabled={busy}
                  onClick={() => act(`Add one more ${l.name} to my ${isFood ? "food" : "Instamart"} cart`)}
                  className="px-2 py-0.5 font-bold text-rating disabled:opacity-50"
                  aria-label={`Add one ${l.name}`}
                >
                  +
                </button>
              </div>
              <span className="w-14 text-right text-sm font-semibold">{rupee(l.unitPrice * l.qty)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-1 border-t border-line bg-cream/60 px-4 py-3 text-sm">
        <Row label="Item total" value={rupee(b.itemTotal)} />
        {b.discount > 0 ? (
          <Row label={`Coupon (${b.appliedCoupon})`} value={`−${rupee(b.discount)}`} className="text-rating" />
        ) : null}
        <Row label="Delivery fee" value={b.deliveryFee === 0 ? "FREE" : rupee(b.deliveryFee)} />
        <Row label="Platform fee" value={rupee(b.platformFee)} />
        <Row label="GST & charges" value={rupee(b.gst)} />
        <div className="flex items-center justify-between border-t border-dashed border-line pt-2 text-base font-extrabold">
          <span>To pay</span>
          <span>{rupee(b.grandTotal)}</span>
        </div>
      </div>
      <div className="flex gap-2 px-4 pb-3">
        {isFood && !b.appliedCoupon ? (
          <button disabled={busy} onClick={() => act("Any coupons I can apply?")} className="chip">
            🎟️ Check coupons
          </button>
        ) : null}
        <button
          disabled={busy}
          onClick={() => act(isFood ? "Place my food order" : "Place my Instamart order")}
          className="ml-auto rounded-lg bg-swiggy px-5 py-2 text-sm font-extrabold uppercase tracking-wide text-white shadow-sm transition hover:bg-orange-600 active:scale-95 disabled:opacity-60"
        >
          Checkout · COD
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={`flex items-center justify-between text-slate2 ${className}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function DineoutCard({ restaurants, act, busy }: { restaurants: DineoutRestaurant[]; act: Act; busy: boolean }) {
  return (
    <div className="grid w-full gap-3 sm:grid-cols-2">
      {restaurants.map((r) => (
        <div key={r.id} className={shell}>
          <div className="relative flex h-24 items-center justify-center bg-gradient-to-br from-dineout/10 via-slate-100 to-slate-200 text-5xl">
            {r.imageEmoji}
            {r.offer ? (
              <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-dineout/90 to-transparent px-3 pb-1 pt-4 text-xs font-extrabold uppercase tracking-wide text-white">
                {r.offer}
              </span>
            ) : null}
          </div>
          <div className="space-y-1 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-base font-bold">{r.name}</span>
              <RatingBadge rating={r.rating} />
            </div>
            <div className="truncate text-sm text-slate2">{r.cuisines.join(", ")}</div>
            <div className="text-sm text-slate2">
              {rupee(r.costForTwo)} for two · {r.area}
            </div>
            <button disabled={busy} onClick={() => act(`Check table availability at ${r.name}`)} className="btn-add mt-1 w-full">
              Check slots
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function SlotsCard({
  restaurantName,
  partySize,
  slots,
  act,
  busy,
}: {
  restaurantName: string;
  restaurantId: string;
  partySize: number;
  slots: Slot[];
  act: Act;
  busy: boolean;
}) {
  const date = slots[0]?.date ?? "";
  return (
    <div className={shell}>
      <div className="border-b border-line px-4 py-3">
        <div className="text-xs font-bold uppercase tracking-wider text-slate2">Available slots</div>
        <div className="font-bold">
          {restaurantName} · {date} · party of {partySize}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 p-4">
        {slots.map((s) => (
          <button
            key={s.time}
            disabled={busy || !s.available}
            onClick={() => act(`Book the ${s.time} slot at ${restaurantName} on ${s.date} for ${partySize}`)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-bold transition active:scale-95 ${
              s.available
                ? "border-dineout/30 bg-white text-dineout hover:border-dineout hover:bg-dineout hover:text-white"
                : "cursor-not-allowed border-line bg-cream text-slate2/50 line-through"
            }`}
          >
            {s.time}
          </button>
        ))}
      </div>
    </div>
  );
}

function BookingCard({ booking }: { booking: Booking }) {
  return (
    <div className={`${shell} !border-rating/40`}>
      <div className="flex items-center gap-3 bg-rating/10 px-4 py-3">
        <span className="text-2xl">✅</span>
        <div>
          <div className="font-extrabold text-rating">Table booked!</div>
          <div className="text-xs text-slate2">Booking ID {booking.id}</div>
        </div>
      </div>
      <div className="space-y-1 px-4 py-3 text-sm">
        <div className="font-bold">{booking.restaurantName}</div>
        <div className="text-slate2">
          {booking.date} at {booking.time} · party of {booking.partySize}
        </div>
        <div className="text-xs text-slate2">Free booking — pay at the restaurant. Show the booking ID on arrival.</div>
      </div>
    </div>
  );
}

const ORDER_STEPS: { key: Order["status"]; label: string; emoji: string }[] = [
  { key: "placed", label: "Placed", emoji: "🧾" },
  { key: "confirmed", label: "Confirmed", emoji: "👍" },
  { key: "preparing", label: "Preparing", emoji: "👨‍🍳" },
  { key: "out_for_delivery", label: "On the way", emoji: "🛵" },
  { key: "delivered", label: "Delivered", emoji: "🎉" },
];

export function OrderStatusCard({ order, act, busy }: { order: Order; act?: Act; busy?: boolean }) {
  const activeIdx = ORDER_STEPS.findIndex((s) => s.key === order.status);
  const isFood = order.vertical === "food";
  return (
    <div className={shell}>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate2">
            {isFood ? "Food order" : "Instamart order"} · {order.id}
          </div>
          <div className="font-bold">
            {order.status === "delivered"
              ? "Delivered — enjoy!"
              : `Arriving in ~${Math.max(order.etaMinutes, 1)} min`}
          </div>
        </div>
        <span className={`rounded-md px-2 py-1 text-xs font-extrabold text-white ${isFood ? "bg-swiggy" : "bg-im"}`}>
          COD {rupee(order.cart.bill.grandTotal)}
        </span>
      </div>
      <div className="flex items-center gap-1 px-4 py-4">
        {ORDER_STEPS.map((s, i) => (
          <div key={s.key} className="flex flex-1 items-center gap-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${
                  i <= activeIdx ? "bg-rating text-white" : "bg-cream text-slate2/60"
                }`}
              >
                {s.emoji}
              </span>
              <span className={`text-[10px] font-bold ${i <= activeIdx ? "text-rating" : "text-slate2/60"}`}>
                {s.label}
              </span>
            </div>
            {i < ORDER_STEPS.length - 1 ? (
              <div className={`mb-4 h-0.5 flex-1 rounded ${i < activeIdx ? "bg-rating" : "bg-line"}`} />
            ) : null}
          </div>
        ))}
      </div>
      <div className="border-t border-line px-4 py-2.5 text-xs text-slate2">
        {order.cart.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")} → {order.address.label}, {order.address.area}
      </div>
      {act && order.status !== "delivered" ? (
        <div className="px-4 pb-3">
          <button disabled={busy} onClick={() => act(`Track order ${order.id}`)} className="chip">
            🔄 Refresh status
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function ConfirmCard({
  confirmation,
  resolved,
  onResolve,
  busy,
}: {
  confirmation: ConfirmationRequest;
  resolved?: "approved" | "declined";
  onResolve: (approve: boolean) => void;
  busy: boolean;
}) {
  return (
    <div className={`${shell} !border-swiggy/50`}>
      <div className="bg-gradient-to-r from-swiggy to-saffron px-4 py-3 text-white">
        <div className="text-xs font-bold uppercase tracking-wider opacity-90">Action needed</div>
        <div className="text-lg font-extrabold">{confirmation.title}</div>
      </div>
      {confirmation.summaryLines.length > 0 ? (
        <ul className="space-y-1 px-4 py-3 text-sm">
          {confirmation.summaryLines.map((line, i) => (
            <li key={i} className="text-ink/90">
              {line}
            </li>
          ))}
        </ul>
      ) : null}
      {confirmation.totalLabel ? (
        <div className="px-4 pb-1 text-base font-extrabold">{confirmation.totalLabel}</div>
      ) : null}
      <div className="mx-4 my-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
        ⚠️ {confirmation.warning}
      </div>
      <div className="flex gap-2 px-4 pb-4 pt-1">
        {resolved ? (
          <span
            className={`rounded-lg px-4 py-2 text-sm font-extrabold ${
              resolved === "approved" ? "bg-rating/10 text-rating" : "bg-cream text-slate2"
            }`}
          >
            {resolved === "approved" ? "✓ Confirmed" : "✕ Cancelled"}
          </span>
        ) : (
          <>
            <button
              disabled={busy}
              onClick={() => onResolve(true)}
              className="flex-1 rounded-lg bg-swiggy px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide text-white shadow-sm transition hover:bg-orange-600 active:scale-95 disabled:opacity-60"
            >
              Confirm
            </button>
            <button
              disabled={busy}
              onClick={() => onResolve(false)}
              className="flex-1 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide text-slate2 transition hover:border-slate2 active:scale-95 disabled:opacity-60"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
