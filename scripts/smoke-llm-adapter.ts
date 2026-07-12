/**
 * Smoke test for the OpenAI-compatible adapter's message conversion —
 * verifies an Anthropic-format agent history (text, images, tool_use,
 * tool_result) maps to a valid OpenAI chat transcript. Run: npx tsx scripts/smoke-llm-adapter.ts
 */
import type Anthropic from "@anthropic-ai/sdk";
import { toOpenAiMessages } from "../src/lib/agent/llm";

function assert(cond: unknown, label: string): void {
  if (!cond) throw new Error(`SMOKE FAIL: ${label}`);
  console.log(`✓ ${label}`);
}

const history: Anthropic.MessageParam[] = [
  {
    role: "user",
    content: [
      { type: "image", source: { type: "base64", media_type: "image/png", data: "aGVsbG8=" } },
      { type: "text", text: "Order what's on this grocery list" },
    ],
  },
  {
    role: "assistant",
    content: [
      { type: "text", text: "Let me check your addresses first.", citations: null },
      { type: "tool_use", id: "call_1", name: "get_addresses", input: {} },
    ] as Anthropic.ContentBlock[],
  },
  {
    role: "user",
    content: [
      { type: "tool_result", tool_use_id: "call_1", content: JSON.stringify([{ id: "addr-home", label: "Home" }]) },
    ],
  },
  { role: "assistant", content: "Which address should I deliver to?" },
  { role: "user", content: "Home" },
];

const out = toOpenAiMessages(history);

assert(out.length === 5, `5 OpenAI messages produced (got ${out.length})`);

const m0 = out[0];
assert(m0.role === "user" && Array.isArray(m0.content), "turn 1 is a user message with parts");
const parts = m0.content as { type: string; image_url?: { url: string } }[];
assert(parts.some((p) => p.type === "image_url" && p.image_url!.url.startsWith("data:image/png;base64,")), "image became a data-URI image_url part");
assert(parts.some((p) => p.type === "text"), "text part preserved alongside image");

const m1 = out[1] as { role: string; content: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] };
assert(m1.role === "assistant" && m1.tool_calls?.length === 1, "assistant turn carries tool_calls");
assert(m1.tool_calls![0].id === "call_1" && m1.tool_calls![0].function.name === "get_addresses", "tool call id/name mapped");
assert(JSON.parse(m1.tool_calls![0].function.arguments) !== null, "tool call arguments are valid JSON");

const m2 = out[2] as { role: string; tool_call_id?: string };
assert(m2.role === "tool" && m2.tool_call_id === "call_1", "tool_result became role:tool with matching id, placed right after the assistant turn");

assert(out[3].role === "assistant" && out[3].content === "Which address should I deliver to?", "plain assistant text preserved");
assert(out[4].role === "user" && out[4].content === "Home", "plain user text preserved");

console.log("\nOpenAI-compat adapter conversion passes. 🎉");
