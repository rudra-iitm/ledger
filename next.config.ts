import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  ...(basePath ? { basePath } : {}),
  // Keep production builds out of the dev server's .next directory so
  // `next build` never corrupts a running `next dev`.
  ...(process.env.NODE_ENV === "production" ? { distDir: ".next-build" } : {}),
};

export default nextConfig;
