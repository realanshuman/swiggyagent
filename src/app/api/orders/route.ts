import { getSessionId } from "@/lib/session-cookie";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Order + booking history for the History panel. */
export async function GET(): Promise<Response> {
  const session = store.getOrCreate(await getSessionId());
  return Response.json({ orders: session.orders, bookings: session.bookings });
}
