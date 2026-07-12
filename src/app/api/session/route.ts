import { getSessionId } from "@/lib/session-cookie";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Session status + mock-mode connect/disconnect. */
export async function GET(): Promise<Response> {
  const session = store.getOrCreate(await getSessionId());
  return Response.json({
    connected: session.swiggyConnected,
    mode: process.env.SWIGGY_MODE === "real" ? "real" : "mock",
    orders: session.orders.length,
  });
}

export async function POST(req: Request): Promise<Response> {
  const session = store.getOrCreate(await getSessionId());
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };

  if (action === "disconnect") {
    store.disconnectSwiggy(session);
    return Response.json({ connected: false });
  }

  if (action === "connect") {
    if (process.env.SWIGGY_MODE === "real") {
      // Real mode goes through OAuth — the client should navigate to /api/auth/swiggy/login.
      return Response.json({ redirect: "/api/auth/swiggy/login" }, { status: 409 });
    }
    // Mock mode: simulate a linked Swiggy account instantly.
    store.connectSwiggy(session);
    return Response.json({ connected: true });
  }

  return Response.json({ error: "unknown_action" }, { status: 400 });
}
