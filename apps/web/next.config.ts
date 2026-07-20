import { config } from "dotenv";
import type { NextConfig } from "next";

// Next.js only auto-loads .env from this app's own root; the monorepo
// keeps a single .env at the repo root (see .env.example). This is a
// no-op in production (Vercel/Railway inject env vars directly).
config({ path: "../../.env" });

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
