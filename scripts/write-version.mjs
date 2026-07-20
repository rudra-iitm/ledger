/**
 * Writes public/version.json before `next build`. The deployed id must match
 * NEXT_PUBLIC_BUILD_ID (next.config.ts derives it the same way) — the PWA
 * polls this file to detect that a newer build is live.
 */
import { writeFileSync } from "node:fs";

const id = (process.env.GITHUB_SHA ?? "").slice(0, 7) || "dev";
writeFileSync(
  new URL("../public/version.json", import.meta.url),
  `${JSON.stringify({ id })}\n`,
);
console.log(`version.json → ${id}`);
