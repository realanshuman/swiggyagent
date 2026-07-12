import { getSessionId } from "@/lib/session-cookie";
import { store } from "@/lib/store";
import type { ChatEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Long-lived SSE stream that pushes live order-status updates
 * (order_update events) from the background tracker into the chat UI.
 */
export async function GET(req: Request): Promise<Response> {
  const session = store.getOrCreate(await getSessionId());
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const onEvent = (e: ChatEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          cleanup();
        }
      };
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          cleanup();
        }
      }, 25_000);
      const cleanup = () => {
        clearInterval(heartbeat);
        session.bus.off("event", onEvent);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      session.bus.on("event", onEvent);
      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
