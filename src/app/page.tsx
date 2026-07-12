"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, ConfirmCard, type Act } from "@/components/cards/Cards";
import { Composer, type Attachment } from "@/components/Composer";
import { Header } from "@/components/Header";
import { HistoryPanel } from "@/components/HistoryPanel";
import { postAndStream } from "@/lib/client/stream";
import { DEMO_THREAD } from "@/lib/client/demo";
import type { ChatEvent } from "@/lib/types";
import type { UiItem } from "@/lib/thread";

const uid = () => Math.random().toString(36).slice(2, 10);

const SUGGESTIONS = [
  "🍛 Order me a good veg biryani",
  "🌯 Paneer roll under ₹300 from a well-rated place",
  "🛒 Milk, eggs, bread aur maggi mangwa do",
  "🍽️ Book a table for 2 tonight around 8",
];

export default function Home() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"mock" | "real">("mock");
  const [thread, setThread] = useState<UiItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("demo") === "1") {
      setConnected(true);
      setThread(DEMO_THREAD);
      return;
    }
    fetch("/api/session")
      .then((r) => r.json())
      .then((d) => {
        setConnected(Boolean(d.connected));
        setMode(d.mode === "real" ? "real" : "mock");
      })
      .catch(() => setConnected(false));
  }, []);

  // Live order tracking pushes.
  useEffect(() => {
    if (!connected) return;
    const es = new EventSource("/api/orders/stream");
    es.onmessage = (msg) => {
      try {
        const e = JSON.parse(msg.data) as ChatEvent;
        if (e.type === "order_update") {
          setThread((prev) => {
            let found = false;
            const next = prev.map((item) => {
              if (item.role !== "agent") return item;
              const parts = item.parts.map((p) => {
                if (p.kind === "card" && p.card.kind === "order_status" && p.card.order.id === e.order.id) {
                  found = true;
                  return { ...p, card: { kind: "order_status" as const, order: e.order } };
                }
                return p;
              });
              return { ...item, parts };
            });
            const label =
              e.order.status === "out_for_delivery"
                ? `🛵 ${e.order.id} is out for delivery — ~${e.order.etaMinutes} min`
                : e.order.status === "delivered"
                  ? `🎉 ${e.order.id} delivered. Enjoy!`
                  : `👨‍🍳 ${e.order.id} is now ${e.order.status}`;
            return found ? [...next, { id: uid(), role: "notice", text: label }] : next;
          });
        }
      } catch {
        /* ignore malformed push */
      }
    };
    return () => es.close();
  }, [connected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread, status]);

  const applyEvent = useCallback((agentId: string, e: ChatEvent) => {
    if (e.type === "status") {
      setStatus(e.text);
      return;
    }
    if (e.type === "done") {
      setStatus(null);
      return;
    }
    setThread((prev) =>
      prev.map((item) => {
        if (item.id !== agentId || item.role !== "agent") return item;
        const parts = [...item.parts];
        if (e.type === "text_delta") {
          const last = parts[parts.length - 1];
          if (last?.kind === "text") parts[parts.length - 1] = { kind: "text", text: last.text + e.text };
          else parts.push({ kind: "text", text: e.text });
        } else if (e.type === "card") {
          parts.push({ kind: "card", card: e.card });
        } else if (e.type === "confirm_request") {
          parts.push({ kind: "confirm", confirmation: e.confirmation });
        } else if (e.type === "order_placed") {
          parts.push({ kind: "card", card: { kind: "order_status", order: e.order } });
        } else if (e.type === "error") {
          parts.push({ kind: "text", text: `⚠️ ${e.message}` });
        }
        return { ...item, parts };
      })
    );
  }, []);

  const runStream = useCallback(
    async (url: string, body: unknown) => {
      const agentId = uid();
      setThread((prev) => [...prev, { id: agentId, role: "agent", parts: [] }]);
      setBusy(true);
      try {
        await postAndStream(url, body, (e) => applyEvent(agentId, e));
      } catch (err) {
        const message =
          err instanceof Error && err.message === "connect_swiggy_first"
            ? "Connect your Swiggy account first."
            : "Something went wrong — try again.";
        setThread((prev) => [...prev, { id: uid(), role: "notice", text: `⚠️ ${message}` }]);
      } finally {
        setBusy(false);
        setStatus(null);
      }
    },
    [applyEvent]
  );

  const send = useCallback(
    (text: string, images: Attachment[]) => {
      if (busy) return;
      setThread((prev) => [
        ...prev,
        { id: uid(), role: "user", text, images: images.map((i) => i.previewUrl) },
      ]);
      void runStream("/api/chat", {
        message: text,
        images: images.map((i) => ({ mediaType: i.mediaType, dataBase64: i.dataBase64 })),
      });
    },
    [busy, runStream]
  );

  const act: Act = useCallback((text) => send(text, []), [send]);

  const resolveConfirm = useCallback(
    (confirmationId: string, approve: boolean) => {
      if (busy) return;
      setThread((prev) =>
        prev.map((item) =>
          item.role === "agent"
            ? {
                ...item,
                parts: item.parts.map((p) =>
                  p.kind === "confirm" && p.confirmation.id === confirmationId
                    ? { ...p, resolved: approve ? ("approved" as const) : ("declined" as const) }
                    : p
                ),
              }
            : item
        )
      );
      void runStream("/api/confirm", { confirmationId, approve });
    },
    [busy, runStream]
  );

  const connect = useCallback(async () => {
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "connect" }),
    });
    if (res.status === 409) {
      const d = await res.json();
      if (d.redirect) window.location.href = d.redirect;
      return;
    }
    const d = await res.json();
    setConnected(Boolean(d.connected));
  }, []);

  return (
    <div className="flex h-dvh flex-col">
      <Header
        connected={Boolean(connected)}
        mode={mode}
        onConnect={connect}
        onHistory={() => setHistoryOpen(true)}
      />

      <main className="mx-auto flex w-full max-w-3xl grow flex-col overflow-y-auto px-4 pb-4">
        {connected === null ? (
          <div className="flex grow items-center justify-center text-slate2">Loading…</div>
        ) : !connected ? (
          <Hero onConnect={connect} />
        ) : (
          <>
            {thread.length === 0 ? <EmptyState onPick={(s) => send(s, [])} /> : null}
            <div className="space-y-4 pt-4">
              {thread.map((item) => (
                <Message key={item.id} item={item} act={act} busy={busy} onResolve={resolveConfirm} />
              ))}
              {status ? (
                <div className="flex items-center gap-2 pl-1 text-sm font-semibold text-slate2">
                  <TypingDots />
                  {status}
                </div>
              ) : busy ? (
                <div className="pl-1">
                  <TypingDots />
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>
          </>
        )}
      </main>

      {connected ? <Composer disabled={busy} onSend={send} /> : null}
      <HistoryPanel open={historyOpen} onClose={() => setHistoryOpen(false)} onReorder={(id) => act(`Reorder my order ${id}`)} />
    </div>
  );
}

function Message({
  item,
  act,
  busy,
  onResolve,
}: {
  item: UiItem;
  act: Act;
  busy: boolean;
  onResolve: (id: string, approve: boolean) => void;
}) {
  if (item.role === "notice") {
    return (
      <div className="mx-auto w-fit rounded-full border border-line bg-white px-4 py-1.5 text-xs font-semibold text-slate2 shadow-sm">
        {item.text}
      </div>
    );
  }
  if (item.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] space-y-2">
          {item.images.length > 0 ? (
            <div className="flex justify-end gap-2">
              {item.images.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt="attachment" className="h-24 w-24 rounded-xl border border-line object-cover" />
              ))}
            </div>
          ) : null}
          {item.text ? (
            <div className="rounded-2xl rounded-br-md bg-gradient-to-br from-swiggy to-saffron px-4 py-2.5 text-[15px] font-medium text-white shadow-sm">
              {item.text}
            </div>
          ) : null}
        </div>
      </div>
    );
  }
  if (item.parts.length === 0) return null;
  return (
    <div className="flex justify-start">
      <div className="w-full max-w-[95%] space-y-3 sm:max-w-[88%]">
        {item.parts.map((p, i) => {
          if (p.kind === "text") {
            return (
              <div key={i} className="w-fit max-w-full whitespace-pre-wrap rounded-2xl rounded-bl-md border border-line bg-white px-4 py-2.5 text-[15px] shadow-card">
                {p.text}
              </div>
            );
          }
          if (p.kind === "card") return <Card key={i} card={p.card} act={act} busy={busy} />;
          return (
            <ConfirmCard
              key={i}
              confirmation={p.confirmation}
              resolved={p.resolved}
              busy={busy}
              onResolve={(approve) => onResolve(p.confirmation.id, approve)}
            />
          );
        })}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-typing rounded-full bg-swiggy"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="flex grow flex-col items-center justify-center gap-4 py-10 text-center">
      <div className="text-5xl">🍊</div>
      <h1 className="text-2xl font-black tracking-tight">
        What are we craving <span className="text-swiggy">today?</span>
      </h1>
      <p className="max-w-md text-sm text-slate2">
        Ask in English or Hinglish, speak with the mic, or snap a photo of a dish / your grocery list — I&apos;ll handle
        the rest: search, cart, offers, checkout and live tracking.
      </p>
      <div className="flex max-w-lg flex-wrap items-center justify-center gap-2 pt-1">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => onPick(s)} className="chip">
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function Hero({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex grow flex-col items-center justify-center gap-6 py-10 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-swiggy to-saffron text-4xl text-white shadow-pop">
        🛵
      </span>
      <div>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          Chat. Order. <span className="text-swiggy">Done.</span>
        </h1>
        <p className="mx-auto mt-2 max-w-md text-slate2">
          One agent for all of Swiggy — food delivery, Instamart groceries and Dineout tables. Link your Swiggy account
          and just say what you want.
        </p>
      </div>
      <div className="grid w-full max-w-lg grid-cols-3 gap-3 text-sm">
        <div className="rounded-card border border-line bg-white p-3 shadow-card">🍛<div className="mt-1 font-bold">Food</div><div className="text-xs text-slate2">search → cart → COD</div></div>
        <div className="rounded-card border border-line bg-white p-3 shadow-card">🛒<div className="mt-1 font-bold">Instamart</div><div className="text-xs text-slate2">groceries in minutes</div></div>
        <div className="rounded-card border border-line bg-white p-3 shadow-card">🍽️<div className="mt-1 font-bold">Dineout</div><div className="text-xs text-slate2">free table bookings</div></div>
      </div>
      <button
        onClick={onConnect}
        className="rounded-xl bg-swiggy px-8 py-3 text-base font-extrabold text-white shadow-pop transition hover:bg-orange-600 active:scale-95"
      >
        Connect Swiggy account
      </button>
      <p className="max-w-sm text-xs text-slate2/80">
        You authenticate with Swiggy directly (OTP) — we never see your password. Orders are COD and non-cancellable
        once confirmed.
      </p>
    </div>
  );
}
