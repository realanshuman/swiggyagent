import type Anthropic from "@anthropic-ai/sdk";
import { runAgentTurn } from "@/lib/agent/loop";
import { getSessionId } from "@/lib/session-cookie";
import { sseResponse } from "@/lib/sse";
import { store } from "@/lib/store";
import type { ChatRequestBody } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(req: Request): Promise<Response> {
  const sessionId = await getSessionId();
  const session = store.getOrCreate(sessionId);

  if (!session.swiggyConnected) {
    return Response.json({ error: "connect_swiggy_first" }, { status: 401 });
  }
  if (session.turnActive) {
    return Response.json({ error: "turn_in_progress" }, { status: 409 });
  }

  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const text = (body.message ?? "").trim();
  const images = (body.images ?? []).slice(0, 4);
  if (!text && images.length === 0) {
    return Response.json({ error: "empty_message" }, { status: 400 });
  }

  const content: Anthropic.ContentBlockParam[] = [];
  for (const img of images) {
    if (!ALLOWED_IMAGE_TYPES.has(img.mediaType)) continue;
    if (Buffer.byteLength(img.dataBase64, "base64") > MAX_IMAGE_BYTES) continue;
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: img.mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
        data: img.dataBase64,
      },
    });
  }
  content.push({ type: "text", text: text || "(image attached — act on it)" });

  session.messages.push({ role: "user", content });
  session.turnActive = true;

  return sseResponse(async (emit) => {
    try {
      await runAgentTurn(session, emit);
    } finally {
      session.turnActive = false;
    }
  });
}
