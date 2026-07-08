/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['pdfjs-dist', 'pdf-parse', 'canvas', '@napi-rs/canvas'],
  experimental: {
    serverActions: {
      bodySizeLimit: '2gb',
    },
  },
  async rewrites() {
    return [
      { source: "/api/accident-chat/:path*",   destination: "/api/python/accident-chat/:path*" },
      { source: "/api/accident-policy/:path*", destination: "/api/python/accident-policy/:path*" },
      { source: "/api/db/:path*",              destination: "/api/python/db/:path*" },
      { source: "/api/obsidian/:path*",        destination: "/api/python/obsidian/:path*" },
    ];
  },
};

export default nextConfig;
