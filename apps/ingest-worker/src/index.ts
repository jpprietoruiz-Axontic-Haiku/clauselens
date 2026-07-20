import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { loadEnv } from "./env.js";

const env = loadEnv();

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(JSON.stringify({ level: "info", msg: "ingest-worker listening", port: info.port }));
});
