import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

/**
 * LLM provider abstraction. The agent loop speaks Anthropic message shapes
 * (content blocks, tool_use / tool_result) as the canonical format; adapters
 * translate for other providers.
 *
 * Providers:
 *  - "anthropic" (default when ANTHROPIC_API_KEY is set): Claude via the
 *    official SDK. Best quality for this tool-heavy agent.
 *  - "openai": any OpenAI-compatible endpoint — lets the app run on free
 *    tiers: Google Gemini (AI Studio), Groq, OpenRouter. Configure with
 *    OPENAI_API_KEY + OPENAI_BASE_URL + OPENAI_MODEL (see .env.example).
 */

export interface LlmTurn {
  content: Anthropic.ContentBlock[];
  stopReason: "tool_use" | "end_turn";
}

/**
 * Provider-specific opaque metadata (e.g. Gemini thought signatures) stashed
 * on canonical content blocks so it can be replayed verbatim on later turns.
 * Ignored entirely by the Anthropic provider and the UI.
 */
interface WithExtra {
  __extra_content?: unknown;
  __msg_extra_content?: unknown;
}

export interface StreamTurnParams {
  system: string;
  messages: Anthropic.MessageParam[];
  tools: Anthropic.Tool[];
  maxTokens: number;
  onText: (delta: string) => void;
}

export interface LlmClient {
  streamTurn(params: StreamTurnParams): Promise<LlmTurn>;
}

export function resolveProvider(): "anthropic" | "openai" {
  const explicit = process.env.LLM_PROVIDER;
  if (explicit === "anthropic" || explicit === "openai") return explicit;
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "anthropic";
}

let _client: LlmClient | undefined;
export function llm(): LlmClient {
  if (_client) return _client;
  const provider = resolveProvider();
  if (provider === "openai") {
    if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_BASE_URL || !process.env.OPENAI_MODEL) {
      throw new Error(
        "OpenAI-compatible provider needs OPENAI_API_KEY, OPENAI_BASE_URL and OPENAI_MODEL in .env.local (see .env.example for Gemini/Groq/OpenRouter presets)."
      );
    }
    _client = new OpenAICompatLlm();
  } else {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        "No LLM configured — set ANTHROPIC_API_KEY, or use a free OpenAI-compatible provider via OPENAI_API_KEY/OPENAI_BASE_URL/OPENAI_MODEL (see .env.example)."
      );
    }
    _client = new AnthropicLlm();
  }
  return _client;
}

// ---------------------------------------------------------------- Anthropic

class AnthropicLlm implements LlmClient {
  private client = new Anthropic();
  private model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

  async streamTurn({ system, messages, tools, maxTokens, onText }: StreamTurnParams): Promise<LlmTurn> {
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: maxTokens,
      system,
      tools,
      messages,
    });
    stream.on("text", onText);
    const message = await stream.finalMessage();
    return {
      content: message.content,
      stopReason: message.stop_reason === "tool_use" ? "tool_use" : "end_turn",
    };
  }
}

// ------------------------------------------------------- OpenAI-compatible

class OpenAICompatLlm implements LlmClient {
  private client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
  });
  private model = process.env.OPENAI_MODEL!;

  async streamTurn(params: StreamTurnParams): Promise<LlmTurn> {
    try {
      return await this.runTurn(params);
    } catch (err) {
      if (err instanceof OpenAI.APIError) {
        const hint =
          err.status === 404
            ? ` — model "${this.model}" not found or retired; fix OPENAI_MODEL in .env.local (Gemini: use gemini-3.5-flash)`
            : err.status === 429
              ? " — free-tier rate limit hit; wait a minute and retry"
              : err.status === 401 || err.status === 403
                ? " — check OPENAI_API_KEY in .env.local"
                : "";
        throw new Error(`LLM error ${err.status ?? ""} from ${this.model}: ${err.message}${hint}`);
      }
      throw err;
    }
  }

  private async runTurn({ system, messages, tools, maxTokens, onText }: StreamTurnParams): Promise<LlmTurn> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: maxTokens,
      stream: true,
      messages: [{ role: "system", content: system }, ...toOpenAiMessages(messages)],
      tools: tools.map((t) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description ?? "",
          parameters: t.input_schema as Record<string, unknown>,
        },
      })),
    });

    let text = "";
    let finish: string | null = null;
    let msgExtra: unknown;
    const calls = new Map<number, { id: string; name: string; args: string; extra?: unknown }>();

    for await (const chunk of stream) {
      const choice = chunk.choices?.[0];
      if (!choice) continue;
      if (choice.delta?.content) {
        text += choice.delta.content;
        onText(choice.delta.content);
      }
      // Gemini 3.x attaches provider extras (thought signatures) that MUST be
      // echoed back on later requests, or tool-calling turns 400.
      const deltaExtra = (choice.delta as { extra_content?: unknown } | undefined)?.extra_content;
      if (deltaExtra) msgExtra = deltaExtra;
      for (const tc of choice.delta?.tool_calls ?? []) {
        const slot = calls.get(tc.index) ?? { id: "", name: "", args: "" };
        if (tc.id) slot.id = tc.id;
        if (tc.function?.name) slot.name += tc.function.name;
        if (tc.function?.arguments) slot.args += tc.function.arguments;
        const tcExtra = (tc as { extra_content?: unknown }).extra_content;
        if (tcExtra) slot.extra = tcExtra;
        calls.set(tc.index, slot);
      }
      if (choice.finish_reason) finish = choice.finish_reason;
    }

    const content: Anthropic.ContentBlock[] = [];
    if (text) {
      const textBlock = { type: "text", text, citations: null } as Anthropic.TextBlock;
      if (msgExtra) (textBlock as WithExtra).__msg_extra_content = msgExtra;
      content.push(textBlock);
    }
    let seq = 0;
    for (const call of calls.values()) {
      let input: unknown = {};
      try {
        input = call.args ? JSON.parse(call.args) : {};
      } catch {
        input = {};
      }
      const block = {
        type: "tool_use",
        id: call.id || `call_${Date.now()}_${seq++}`,
        name: call.name,
        input,
      } as Anthropic.ToolUseBlock;
      if (call.extra) (block as WithExtra).__extra_content = call.extra;
      else if (msgExtra && content.length === 0 && seq === 0) (block as WithExtra).__msg_extra_content = msgExtra;
      content.push(block);
    }

    return {
      content,
      stopReason: finish === "tool_calls" || calls.size > 0 ? "tool_use" : "end_turn",
    };
  }
}

/**
 * Anthropic-format history → OpenAI chat messages.
 * - assistant tool_use blocks → assistant.tool_calls
 * - user tool_result blocks → role:"tool" messages (must directly follow the
 *   assistant turn that requested them)
 * - user image blocks → image_url data URIs (supported by Gemini/OpenRouter
 *   vision models)
 * Exported for the smoke test.
 */
export function toOpenAiMessages(
  messages: Anthropic.MessageParam[]
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const out: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  for (const msg of messages) {
    if (typeof msg.content === "string") {
      out.push({ role: msg.role, content: msg.content });
      continue;
    }

    if (msg.role === "assistant") {
      let text = "";
      let msgExtra: unknown;
      const toolCalls: (OpenAI.Chat.ChatCompletionMessageToolCall & { extra_content?: unknown })[] = [];
      for (const block of msg.content) {
        const extras = block as WithExtra;
        if (extras.__msg_extra_content) msgExtra = extras.__msg_extra_content;
        if (block.type === "text") text += block.text;
        else if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id,
            type: "function",
            function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) },
            ...(extras.__extra_content ? { extra_content: extras.__extra_content } : {}),
          });
        }
      }
      out.push({
        role: "assistant",
        content: text || null,
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
        ...(msgExtra ? { extra_content: msgExtra } : {}),
      } as OpenAI.Chat.ChatCompletionMessageParam);
      continue;
    }

    // user turn: tool_results first (OpenAI requires them right after the
    // assistant tool_calls turn), then any text/image content
    const userParts: OpenAI.Chat.ChatCompletionContentPart[] = [];
    for (const block of msg.content) {
      if (block.type === "tool_result") {
        const body =
          typeof block.content === "string"
            ? block.content
            : (block.content ?? [])
                .map((c) => (c.type === "text" ? c.text : ""))
                .join("\n");
        out.push({
          role: "tool",
          tool_call_id: block.tool_use_id,
          content: block.is_error ? `ERROR: ${body}` : body,
        });
      } else if (block.type === "text") {
        userParts.push({ type: "text", text: block.text });
      } else if (block.type === "image" && block.source.type === "base64") {
        userParts.push({
          type: "image_url",
          image_url: { url: `data:${block.source.media_type};base64,${block.source.data}` },
        });
      }
    }
    if (userParts.length > 0) out.push({ role: "user", content: userParts });
  }

  return out;
}
