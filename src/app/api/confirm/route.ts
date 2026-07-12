import { resumeAfterConfirmation } from "@/lib/agent/loop";
import { getSessionId } from "@/lib/session-cookie";
import { sseResponse } from "@/lib/sse";
import { store } from "@/lib/store";
import type { ConfirmRequestBody } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The checkout gate. Gated tools (place order / book table) are ONLY executed
 * from here — after the customer explicitly tapped Confirm in the UI.
 */
export async function POST(req: Request): Promise<Response> {
  const sessionId = await getSessionId();
  const session = store.getOrCreate(sessionId);

  if (!session.swiggyConnected) {
    return Response.json({ error: "connect_swiggy_first" }, { status: 401 });
  }
  if (session.turnActive) {
    return Response.json({ error: "turn_in_progress" }, { status: 409 });
  }

  let body: ConfirmRequestBody;
  try {
    body = (await req.json()) as ConfirmRequestBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.confirmationId) {
    return Response.json({ error: "missing_confirmation_id" }, { status: 400 });
  }

  session.turnActive = true;
  return sseResponse(async (emit) => {
    try {
      await resumeAfterConfirmation(session, body.confirmationId, Boolean(body.approve), emit);
    } finally {
      session.turnActive = false;
    }
  });
}
