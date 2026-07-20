import type { Citation } from "@clauselens/db";
import type { UIMessage } from "ai";

/** Fragmento fuente que sustenta una cita — lo que la UI necesita para "abrir" la cita. */
export interface CitationSource {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  sourceUrl: string;
  articleRef: string | null;
  page: number | null;
  content: string;
}

export interface CitationsPayload {
  citations: Citation[];
  sources: CitationSource[];
}

export interface ConversationPayload {
  conversationId: string;
}

/** UIMessage con los data parts propios de ClauseLens tipados de punta a punta
 * (servidor: createUIMessageStream<ClauseLensUIMessage>; cliente: useChat<ClauseLensUIMessage>). */
export type ClauseLensUIMessage = UIMessage<
  never,
  {
    conversation: ConversationPayload;
    citations: CitationsPayload;
  }
>;
