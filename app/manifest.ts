import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ledger",
    short_name: "Ledger",
    description: "Personal budgets, expenses, and bill splitting",
    start_url: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`,
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      {
        src: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/icon.svg`,
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
