import type { Citation } from "@clauselens/db";
import type { UIMessage } from "ai";

/** Source fragment backing a citation — what the UI needs to "open" the citation. */
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

/** UIMessage with ClauseLens's own data parts typed end to end
 * (server: createUIMessageStream<ClauseLensUIMessage>; client: useChat<ClauseLensUIMessage>). */
export type ClauseLensUIMessage = UIMessage<
  never,
  {
    conversation: ConversationPayload;
    citations: CitationsPayload;
  }
>;
