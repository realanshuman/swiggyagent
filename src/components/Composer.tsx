"use client";

import { useRef, useState } from "react";
import { useSpeech } from "@/lib/client/useSpeech";

export interface Attachment {
  mediaType: string;
  dataBase64: string;
  previewUrl: string;
  name: string;
}

const MAX_ATTACHMENTS = 4;

export function Composer({
  disabled,
  onSend,
}: {
  disabled: boolean;
  onSend: (text: string, images: Attachment[]) => void;
}) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const { listening, supported, toggle } = useSpeech((t) => setText((prev) => (prev ? `${prev} ${t}` : t)));

  const send = () => {
    const trimmed = text.trim();
    if ((!trimmed && attachments.length === 0) || disabled) return;
    onSend(trimmed, attachments);
    setText("");
    setAttachments([]);
  };

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const next: Attachment[] = [];
    for (const file of Array.from(files).slice(0, MAX_ATTACHMENTS - attachments.length)) {
      if (!file.type.startsWith("image/")) continue;
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const [meta, dataBase64] = dataUrl.split(",", 2);
      const mediaType = meta.slice(5, meta.indexOf(";"));
      next.push({ mediaType, dataBase64, previewUrl: dataUrl, name: file.name });
    }
    setAttachments((prev) => [...prev, ...next].slice(0, MAX_ATTACHMENTS));
  };

  return (
    <div className="border-t border-line bg-white px-4 pb-4 pt-3">
      <div className="mx-auto max-w-3xl">
        {attachments.length > 0 ? (
          <div className="mb-2 flex gap-2">
            {attachments.map((a, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.previewUrl} alt={a.name} className="h-14 w-14 rounded-lg border border-line object-cover" />
                <button
                  onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[10px] font-bold text-white"
                  aria-label={`Remove ${a.name}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex items-end gap-2 rounded-2xl border border-line bg-cream/50 p-2 focus-within:border-swiggy">
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={disabled}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl text-slate2 transition hover:bg-white hover:text-swiggy disabled:opacity-50"
            title="Attach a photo — a dish, a grocery list, a menu"
          >
            📷
          </button>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={listening ? "Listening…" : "Ask for food, groceries, or a table… (English / Hinglish)"}
            className="max-h-32 min-h-[40px] w-full resize-none bg-transparent px-1 py-2 text-[15px] outline-none placeholder:text-slate2/70"
          />
          {supported ? (
            <button
              onClick={toggle}
              disabled={disabled}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl transition disabled:opacity-50 ${
                listening ? "animate-pulse bg-red-100 text-red-600" : "text-slate2 hover:bg-white hover:text-swiggy"
              }`}
              title="Speak instead of typing"
            >
              🎤
            </button>
          ) : null}
          <button
            onClick={send}
            disabled={disabled || (!text.trim() && attachments.length === 0)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-swiggy text-lg text-white shadow-sm transition hover:bg-orange-600 active:scale-95 disabled:opacity-40"
            aria-label="Send"
          >
            ➤
          </button>
        </div>
        <p className="mt-1.5 text-center text-[11px] text-slate2/80">
          Orders are Cash on Delivery and can&apos;t be cancelled once you confirm.
        </p>
      </div>
    </div>
  );
}
