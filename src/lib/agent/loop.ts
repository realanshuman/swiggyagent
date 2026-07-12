import type Anthropic from "@anthropic-ai/sdk";
import { GatewayError } from "../gateway/gateway";
import { store, type PendingConfirmation, type Session } from "../store";
import type { ChatEvent, ConfirmationRequest, Order } from "../types";
import { llm } from "./llm";
import { buildSystemPrompt } from "./prompt";
import { AGENT_TOOLS, executeGatedTool, executeTool, GATED_TOOLS } from "./tools";

const MAX_TOOL_ROUNDS = 12;

export type Emit = (event: ChatEvent) => void;

/**
 * Runs one agent turn: streams Claude's response, executes tools against the
 * session gateway, and pushes ChatEvents to the client. If the model calls a
 * gated tool (checkout/booking), the turn pauses with a confirm_request and
 * resumes via resumeAfterConfirmation().
 */
export async function runAgentTurn(session: Session, emit: Emit): Promise<void> {
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const turn = await llm().streamTurn({
      system: buildSystemPrompt(new Date()),
      tools: AGENT_TOOLS,
      maxTokens: 2048,
      messages: session.messages,
      onText: (delta) => emit({ type: "text_delta", text: delta }),
    });

    // Persist the assistant turn exactly as produced.
    session.messages.push({ role: "assistant", content: turn.content });

    const toolUses = turn.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (turn.stopReason !== "tool_use" || toolUses.length === 0) {
      emit({ type: "done" });
      return;
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    let gated: Anthropic.ToolUseBlock | undefined;

    for (const toolUse of toolUses) {
      if (GATED_TOOLS.has(toolUse.name)) {
        if (!gated) {
          gated = toolUse;
        } else {
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: "Only one order/booking confirmation at a time. Ask the customer to confirm the first one, then retry this.",
            is_error: true,
          });
        }
        continue;
      }
      toolResults.push(await runTool(session, toolUse, emit));
    }

    if (gated) {
      const request = await buildConfirmationRequest(session, gated);
      const pending: PendingConfirmation = {
        request,
        toolUseId: gated.id,
        toolName: gated.name,
        toolInput: gated.input as Record<string, unknown>,
        messages: session.messages,
        createdAt: Date.now(),
      };
      // Stash already-executed sibling results so the resume can answer every tool_use block.
      (pending as PendingConfirmation & { siblingResults?: Anthropic.ToolResultBlockParam[] }).siblingResults =
        toolResults;
      session.pending.set(request.id, pending);
      emit({ type: "confirm_request", confirmation: request });
      emit({ type: "done" });
      return;
    }

    session.messages.push({ role: "user", content: toolResults });
  }

  emit({ type: "error", message: "I did too many steps in one go — please rephrase or continue from here." });
  emit({ type: "done" });
}

/** Continues the paused turn after the customer taps Confirm / Cancel. */
export async function resumeAfterConfirmation(
  session: Session,
  confirmationId: string,
  approve: boolean,
  emit: Emit
): Promise<void> {
  const pending = session.pending.get(confirmationId) as
    | (PendingConfirmation & { siblingResults?: Anthropic.ToolResultBlockParam[] })
    | undefined;
  if (!pending) {
    emit({ type: "error", message: "This confirmation has expired. Ask me to rebuild the order." });
    emit({ type: "done" });
    return;
  }
  session.pending.delete(confirmationId);

  const results: Anthropic.ToolResultBlockParam[] = [...(pending.siblingResults ?? [])];

  if (!approve) {
    results.push({
      type: "tool_result",
      tool_use_id: pending.toolUseId,
      content: JSON.stringify({ declined: true, note: "Customer declined via the Confirm dialog. Do not retry unasked." }),
    });
  } else {
    try {
      const outcome = await executeGatedTool(session, pending.toolName, pending.toolInput);
      if (pending.toolName === "place_food_order" || pending.toolName === "place_instamart_order") {
        const order = outcome.resultForModel as Order;
        store.trackOrder(session, order);
        emit({ type: "order_placed", order });
      } else if (outcome.card) {
        emit({ type: "card", card: outcome.card });
      }
      results.push({
        type: "tool_result",
        tool_use_id: pending.toolUseId,
        content: JSON.stringify(outcome.resultForModel),
      });
    } catch (err) {
      results.push({
        type: "tool_result",
        tool_use_id: pending.toolUseId,
        content: err instanceof GatewayError ? err.message : "Order placement failed. Try again.",
        is_error: true,
      });
    }
  }

  session.messages.push({ role: "user", content: results });
  await runAgentTurn(session, emit);
}

async function runTool(
  session: Session,
  toolUse: Anthropic.ToolUseBlock,
  emit: Emit
): Promise<Anthropic.ToolResultBlockParam> {
  try {
    const outcome = await executeTool(session, toolUse.name, toolUse.input as Record<string, unknown>);
    if (outcome.statusText) emit({ type: "status", text: outcome.statusText });
    if (outcome.card) emit({ type: "card", card: outcome.card });
    return {
      type: "tool_result",
      tool_use_id: toolUse.id,
      content: JSON.stringify(outcome.resultForModel),
    };
  } catch (err) {
    const message = err instanceof GatewayError ? err.message : `Tool ${toolUse.name} failed unexpectedly.`;
    return { type: "tool_result", tool_use_id: toolUse.id, content: message, is_error: true };
  }
}

async function buildConfirmationRequest(
  session: Session,
  toolUse: Anthropic.ToolUseBlock
): Promise<ConfirmationRequest> {
  const id = `cfm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const input = toolUse.input as Record<string, unknown>;
  if (toolUse.name === "book_table") {
    return {
      id,
      kind: "dineout_booking",
      title: "Confirm table booking",
      summaryLines: [
        `Date: ${input.date}  ·  Time: ${input.time}`,
        `Party of ${input.party_size}`,
        "Free booking — no payment needed",
      ],
      warning: "The restaurant holds your table for 15 minutes past the slot time.",
    };
  }

  const isFood = toolUse.name === "place_food_order";
  // Snapshot the real cart so the customer confirms exactly what will be placed.
  const cart = isFood ? await session.gateway.getFoodCart() : await session.gateway.getImCart();
  const addresses = await session.gateway.getAddresses();
  const address = addresses.find((a) => a.id === input.address_id);
  const summaryLines = [
    ...(cart.restaurantName ? [`From ${cart.restaurantName}`] : []),
    ...cart.lines.map((l) => `${l.qty} × ${l.name}${l.note ? ` (${l.note})` : ""} — ₹${l.unitPrice * l.qty}`),
    ...(cart.bill.discount > 0 ? [`Coupon ${cart.bill.appliedCoupon}: −₹${cart.bill.discount}`] : []),
    ...(address ? [`Deliver to ${address.label}: ${address.line}, ${address.area}`] : []),
  ];
  return {
    id,
    kind: isFood ? "food_order" : "instamart_order",
    title: isFood ? "Confirm food order" : "Confirm Instamart order",
    summaryLines,
    totalLabel: `₹${cart.bill.grandTotal} · Cash on Delivery`,
    warning: "COD order — it CANNOT be cancelled once placed.",
  };
}
