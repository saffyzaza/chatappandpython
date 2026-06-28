import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdfjs-dist', 'pdf-parse', 'canvas', '@napi-rs/canvas'],
  experimental: {
    serverActions: {
      bodySizeLimit: '2gb',
    },
  },

  async rewrites() {
    // Internal rewrites → Route Handler at /api/python/[prefix]/[...path]
    // The handler reads PYTHON_API_URL at request time (works in Docker).
    return [
      { source: "/api/accident-chat/:path*",   destination: "/api/python/accident-chat/:path*" },
      { source: "/api/accident-policy/:path*", destination: "/api/python/accident-policy/:path*" },
      { source: "/api/db/:path*",              destination: "/api/python/db/:path*" },
      // ⚠️ ขาดอันนี้มาตลอด — proxy route (ALLOWED_PREFIXES) มี "obsidian" อยู่แล้ว
      // แต่ไม่มี rewrite จับให้ ทำให้หน้า /musyaend/obsidian ที่เรียก "/api/obsidian/..."
      // (relative path) ไม่ถูกส่งต่อไป backend เลย — ต้องเพิ่มให้ตรงกับ "db" ด้านบน
      { source: "/api/obsidian/:path*",        destination: "/api/python/obsidian/:path*" },
    ];
  },
};

export default nextConfig;
