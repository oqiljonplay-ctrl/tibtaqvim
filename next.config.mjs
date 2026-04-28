/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "node-telegram-bot-api"],
  },
};

export default nextConfig;
