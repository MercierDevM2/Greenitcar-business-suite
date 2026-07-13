import type { NextConfig } from "next";
// @ts-ignore
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  // Regroupement des options Workbox pour éviter l'erreur de type
  workboxOptions: {
    exclude: [/middleware-manifest\.json$/, /page_client-reference-manifest\.js$/],
  }
});

const nextConfig: NextConfig = {
  //Config...
};

export default withPWA(nextConfig);
