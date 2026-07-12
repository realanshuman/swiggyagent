"use client";

export function Header({
  connected,
  mode,
  onConnect,
  onHistory,
}: {
  connected: boolean;
  mode: "mock" | "real";
  onConnect: () => void;
  onHistory: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-swiggy to-saffron text-lg text-white shadow-sm">
            🛵
          </span>
          <div className="leading-tight">
            <div className="text-lg font-black tracking-tight text-swiggy">SwiggyAgent</div>
            <div className="text-[11px] font-semibold text-slate2">Food · Instamart · Dineout</div>
          </div>
        </div>

        <button className="ml-2 hidden items-center gap-1 rounded-full border border-line px-3 py-1.5 text-sm font-semibold text-ink transition hover:border-swiggy sm:flex">
          📍 Indiranagar, Bengaluru <span className="text-slate2">▾</span>
        </button>

        <div className="ml-auto flex items-center gap-2">
          {mode === "mock" ? (
            <span
              className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-amber-800"
              title="Running against the built-in mock of Swiggy's MCP servers. Set SWIGGY_MODE=real for staging/production."
            >
              Mock
            </span>
          ) : null}
          <button
            onClick={onHistory}
            className="rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold transition hover:border-swiggy hover:text-swiggy"
          >
            🧾 Orders
          </button>
          {connected ? (
            <span className="flex items-center gap-1.5 rounded-full bg-rating/10 px-3 py-1.5 text-sm font-bold text-rating">
              <span className="h-2 w-2 rounded-full bg-rating" /> Swiggy linked
            </span>
          ) : (
            <button
              onClick={onConnect}
              className="rounded-full bg-swiggy px-4 py-1.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-orange-600 active:scale-95"
            >
              Connect Swiggy
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
