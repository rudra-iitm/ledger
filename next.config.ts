import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// Must derive identically to scripts/write-version.mjs — the app compares
// this baked-in id against the deployed version.json to detect updates.
const buildId = (process.env.GITHUB_SHA ?? "").slice(0, 7) || "dev";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BUILD_ID: buildId },
  ...(basePath ? { basePath } : {}),
};

export default nextConfig;
