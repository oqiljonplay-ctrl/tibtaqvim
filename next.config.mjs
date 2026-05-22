/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "node-telegram-bot-api"],
    serverActions: {
      bodySizeLimit: "21mb",
    },
  },
};

export default nextConfig;
