/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "node-telegram-bot-api"],
    serverActions: {
      bodySizeLimit: "21mb",
    },
  },
  webpack: (config) => {
    // jspdf browser-only: canvg, html2canvas are optional SVG deps — not needed
    config.resolve.alias = {
      ...config.resolve.alias,
      canvg: false,
      html2canvas: false,
      dompurify: false,
    };
    return config;
  },
};

export default nextConfig;
