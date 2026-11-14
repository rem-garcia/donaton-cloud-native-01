import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    /* config options here */

    // Necesario para contenedorizar con Docker
    // Ver mas en:
    // - https://docs.docker.com/guides/nextjs/containerize/
    // - https://nextjs.org/docs/pages/getting-started/deploying
    output: process.env.VERCEL ? undefined : "standalone"
};

export default nextConfig;
