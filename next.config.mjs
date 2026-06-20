/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lxqimithjjabhnldcugc.supabase.co" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
    ],
  },
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
