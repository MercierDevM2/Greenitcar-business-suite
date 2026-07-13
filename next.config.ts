import type { NextConfig } from "next";
// @ts-ignore
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  workboxOptions: {
    exclude: [/middleware-manifest\.json$/, /page_client-reference-manifest\.js$/],
  }
});

const nextConfig: NextConfig = {
  // 1. Force Vercel à l'indépendance de build et à l'unification des manifests
  output: "standalone",
  
  experimental: {
    // 2. Désactive la minification serveur pour empêcher la perte des fichiers lstat client-reference
    serverMinification: false,
  }
};

export default withPWA(nextConfig);
