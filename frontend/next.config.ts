import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  // Desactiva la PWA en desarrollo para que no te guarde caché viejo mientras programas
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  /* Aquí dentro van tus configuraciones actuales de Next.js si tenías alguna */
};

export default withPWA(nextConfig as any);