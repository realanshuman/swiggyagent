"use client";

import { useEffect, useState } from "react";
import type { Order } from "@/lib/types";
import { rupee } from "./cards/marks";

const STATUS_LABEL: Record<Order["status"], string> = {
  placed: "Placed",
  confirmed: "Confirmed",
  preparing: "Preparing",
  out_for_delivery: "On the way",
  delivered: "Delivered",
};

export function HistoryPanel({
  open,
  onClose,
  onReorder,
}: {
  open: boolean;
  onClose: () => void;
  onReorder: (orderId: string) => void;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [bookings, setBookings] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/orders")
      .then((r) => r.json())
      .then((d) => {
        setOrders(d.orders ?? []);
        setBookings(d.bookings ?? []);
      })
      .catch(() => {});
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30" role="dialog" aria-label="Order history">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-sm overflow-y-auto bg-white shadow-pop animate-slideup">
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-white px-4 py-3">
          <h2 className="text-lg font-extrabold">Your orders</h2>
          <button onClick={onClose} className="rounded-full px-2 py-1 text-slate2 hover:bg-cream" aria-label="Close">
            ✕
          </button>
        </div>

        {orders.length === 0 && bookings.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate2">
            Nothing yet — your orders and bookings placed through the agent will show up here.
          </p>
        ) : null}

        <div className="space-y-3 p-4">
          {orders.map((o) => (
            <div key={o.id} className="rounded-card border border-line p-3 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate2">
                  {o.vertical === "food" ? "🍛 Food" : "🛒 Instamart"} · {o.id}
                </span>
                <span
                  className={`rounded-md px-2 py-0.5 text-[11px] font-extrabold ${
                    o.status === "delivered" ? "bg-rating/10 text-rating" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {STATUS_LABEL[o.status]}
                </span>
              </div>
              <div className="mt-1.5 text-sm">{o.cart.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}</div>
              <div className="mt-1 text-xs text-slate2">
                {new Date(o.placedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} ·{" "}
                {rupee(o.cart.bill.grandTotal)} · COD
              </div>
              <button
                onClick={() => {
                  onReorder(o.id);
                  onClose();
                }}
                className="btn-add mt-2 w-full"
              >
                Reorder
              </button>
            </div>
          ))}

          {bookings.length > 0 ? (
            <>
              <h3 className="pt-2 text-xs font-bold uppercase tracking-wider text-slate2">Table bookings</h3>
              {bookings.map((b) => (
                <div key={b.id} className="rounded-card border border-line p-3 text-sm shadow-card">
                  🍽️ {b.label}
                  <div className="mt-0.5 text-xs text-slate2">Booking ID {b.id}</div>
                </div>
              ))}
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
