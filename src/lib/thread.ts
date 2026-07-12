import type { CardPayload, ConfirmationRequest } from "./types";

/** Client-side chat thread model (what the UI renders). */

export type Part =
  | { kind: "text"; text: string }
  | { kind: "card"; card: CardPayload }
  | { kind: "confirm"; confirmation: ConfirmationRequest; resolved?: "approved" | "declined" };

export type UiItem =
  | { id: string; role: "user"; text: string; images: string[] }
  | { id: string; role: "agent"; parts: Part[] }
  | { id: string; role: "notice"; text: string };
