import type { ChatEvent } from "./types";

/**
 * Wraps a producer callback into an SSE Response. The producer receives an
 * emit function; the stream closes when the producer settles.
 */
export function sseResponse(producer: (emit: (e: ChatEvent) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const emit = (e: ChatEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          closed = true;
        }
      };
      try {
        await producer(emit);
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : "Something went wrong" });
        emit({ type: "done" });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
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
