import type { NextConfig } from "next";

const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
      : null;
  } catch {
    return null;
  }
})();

const config: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: supabaseHost
      ? [
          { protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" },
          { protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/sign/**" },
        ]
      : [],
  },
  async headers() {
    return [
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600" }],
      },
    ];
  },
};

export default config;
