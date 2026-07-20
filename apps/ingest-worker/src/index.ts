import { serve } from "@hono/node-server";
import { createDb, loadDbEnv } from "@clauselens/db";
import { createApp } from "./app.js";
import { loadEnv } from "./env.js";
import { createOpenAiEmbedder } from "./ingest/embed.js";

const env = loadEnv();
const { DATABASE_URL } = loadDbEnv();

const db = createDb(DATABASE_URL);
const embedder = createOpenAiEmbedder(env.OPENAI_API_KEY, env.EMBEDDING_MODEL);
const app = createApp({ db, embedder });

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(JSON.stringify({ level: "info", msg: "ingest-worker listening", port: info.port }));
});
