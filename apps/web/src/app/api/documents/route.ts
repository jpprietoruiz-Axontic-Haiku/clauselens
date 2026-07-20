import { documents } from "@clauselens/db";
import { asc } from "drizzle-orm";
import { getDb } from "@/lib/deps";

export async function GET(): Promise<Response> {
  const db = getDb();
  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      sourceUrl: documents.sourceUrl,
      jurisdiction: documents.jurisdiction,
      version: documents.version,
      ingestedAt: documents.ingestedAt,
    })
    .from(documents)
    .orderBy(asc(documents.title));

  return Response.json({ documents: rows });
}
