import {
  buildChatMessages,
  embedOne,
  hasSufficientBasis,
  hybridSearch,
  NO_BASIS_MESSAGE,
} from "@clauselens/core";
import { conversations, messages as messagesTable, type Citation, type Database } from "@clauselens/db";
import { createUIMessageStream, createUIMessageStreamResponse, streamText, toUIMessageStream } from "ai";
import { z } from "zod";
import type { CitationSource, ClauseLensUIMessage } from "@/lib/chat-types";
import { getChatModelInstance, getDb, getEmbedder } from "@/lib/deps";

// Vercel: maximum time allowed for the streaming response.
export const maxDuration = 30;

const chatRequestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1, "The message cannot be empty"),
});

async function createConversation(db: Database): Promise<string> {
  const [conversation] = await db.insert(conversations).values({}).returning({ id: conversations.id });
  if (!conversation) {
    throw new Error("Could not create the conversation.");
  }
  return conversation.id;
}

export async function POST(req: Request): Promise<Response> {
  const body: unknown = await req.json().catch(() => null);
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  const { message } = parsed.data;

  // Everything before opening the stream (creating the conversation, saving
  // the user's message, embedding, retrieving) can fail for "normal"
  // reasons (DB down, invalid API key): a JSON response with an explicit
  // error status is returned instead of letting Next.js serve its default
  // HTML error page, which the AI SDK client doesn't know how to parse.
  let db: Database;
  let conversationId: string;
  let retrieved: Awaited<ReturnType<typeof hybridSearch>>;
  try {
    db = getDb();
    conversationId = parsed.data.conversationId ?? (await createConversation(db));
    await db.insert(messagesTable).values({ conversationId, role: "user", content: message });

    const queryEmbedding = await embedOne(getEmbedder(), message);
    // "Searching the corpus": hybrid retrieval (vector + lexical) before
    // deciding whether there is enough basis to answer.
    retrieved = await hybridSearch(db, queryEmbedding, message, { topK: 5 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error preparing the response.";
    return Response.json({ error: "chat_prepare_failed", message: errorMessage }, { status: 500 });
  }

  const stream = createUIMessageStream<ClauseLensUIMessage>({
    onError: (error) => (error instanceof Error ? error.message : "Error generating the response."),
    execute: ({ writer }) => {
      writer.write({ type: "data-conversation", data: { conversationId } });

      if (!hasSufficientBasis(retrieved)) {
        writer.write({
          type: "data-citations",
          data: { citations: [] as Citation[], sources: [] as CitationSource[] },
        });
        writer.write({ type: "text-start", id: "answer" });
        writer.write({ type: "text-delta", id: "answer", delta: NO_BASIS_MESSAGE });
        writer.write({ type: "text-end", id: "answer" });

        // The LLM is not called: without enough basis, there's nothing to draft.
        void db.insert(messagesTable).values({
          conversationId,
          role: "assistant",
          content: NO_BASIS_MESSAGE,
          citations: [],
          retrievedChunkIds: [],
        });
        return;
      }

      const citations: Citation[] = retrieved.map((chunk) => ({
        chunkId: chunk.chunkId,
        articleRef: chunk.articleRef,
        page: chunk.page,
      }));
      const sources: CitationSource[] = retrieved.map((chunk) => ({
        chunkId: chunk.chunkId,
        documentId: chunk.documentId,
        documentTitle: chunk.documentTitle,
        sourceUrl: chunk.sourceUrl,
        articleRef: chunk.articleRef,
        page: chunk.page,
        content: chunk.content,
      }));
      writer.write({ type: "data-citations", data: { citations, sources } });

      // "Drafting": the model generates the response citing the retrieved context.
      const result = streamText({
        model: getChatModelInstance(),
        messages: buildChatMessages(message, retrieved),
        onEnd: async ({ text }) => {
          await db.insert(messagesTable).values({
            conversationId,
            role: "assistant",
            content: text,
            citations,
            retrievedChunkIds: retrieved.map((chunk) => chunk.chunkId),
          });
        },
      });

      writer.merge(toUIMessageStream({ stream: result.stream }));
    },
  });

  return createUIMessageStreamResponse({ stream });
}
