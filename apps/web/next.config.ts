import { config } from "dotenv";
import type { NextConfig } from "next";

// Next.js solo autocarga .env desde la raíz de esta app; el monorepo
// mantiene un único .env en la raíz del repo (ver .env.example). No hace
// nada en producción (Vercel/Railway inyectan las env vars directamente).
config({ path: "../../.env" });

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
