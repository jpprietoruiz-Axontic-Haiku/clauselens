"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { CitationSource, ClauseLensUIMessage } from "@/lib/chat-types";
import { AnswerText } from "./answer-text";
import { CitationDialog } from "./citation-dialog";

function extractText(message: ClauseLensUIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function extractSources(message: ClauseLensUIMessage): CitationSource[] {
  const citationsPart = message.parts.find((part) => part.type === "data-citations");
  return citationsPart?.data.sources ?? [];
}

export function Chat() {
  const [input, setInput] = useState("");
  const [openSource, setOpenSource] = useState<CitationSource | null>(null);
  const conversationIdRef = useRef<string | undefined>(undefined);

  const { messages, sendMessage, status, error } = useChat<ClauseLensUIMessage>({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages: currentMessages }) => {
        const lastMessage = currentMessages[currentMessages.length - 1];
        const text = lastMessage ? extractText(lastMessage) : "";
        return { body: { conversationId: conversationIdRef.current, message: text } };
      },
    }),
    onData: (part) => {
      if (part.type === "data-conversation") {
        conversationIdRef.current = part.data.conversationId;
      }
    },
  });

  const isBusy = status === "submitted" || status === "streaming";
  const statusLabel = status === "submitted" ? "Buscando en el corpus…" : status === "streaming" ? "Redactando…" : null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isBusy) return;
    void sendMessage({ text: trimmed });
    setInput("");
  };

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 px-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-4 py-6">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Pregunta algo sobre el GDPR o el EU AI Act — las respuestas citan el artículo exacto.
            </p>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={
                message.role === "user"
                  ? "ml-auto max-w-[80%] rounded-lg bg-primary px-4 py-2 text-primary-foreground"
                  : "mr-auto max-w-[80%] rounded-lg bg-muted px-4 py-2"
              }
            >
              {message.role === "user" ? (
                <p className="whitespace-pre-wrap text-sm">{extractText(message)}</p>
              ) : (
                <AnswerText text={extractText(message)} sources={extractSources(message)} onCite={setOpenSource} />
              )}
            </div>
          ))}

          {statusLabel && <p className="text-xs text-muted-foreground">{statusLabel}</p>}
          {error && <p className="text-xs text-destructive">Ha ocurrido un error: {error.message}</p>}
        </div>
      </ScrollArea>

      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="mx-auto flex max-w-2xl gap-2">
          <Textarea
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSubmit(event);
              }
            }}
            placeholder="Escribe tu pregunta normativa…"
            disabled={isBusy}
            className="min-h-11 resize-none"
          />
          <Button type="submit" disabled={isBusy || input.trim().length === 0}>
            Enviar
          </Button>
        </div>
      </form>

      <CitationDialog
        source={openSource}
        onOpenChange={(open) => {
          if (!open) setOpenSource(null);
        }}
      />
    </div>
  );
}
