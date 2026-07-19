import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ledger",
    short_name: "Ledger",
    description: "Personal budgets, expenses, and bill splitting",
    start_url: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`,
    display: "standalone",
    background_color: "#0b0b0b",
    theme_color: "#0b0b0b",
    icons: [
      {
        src: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/icon.svg`,
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
    // Receive shared payment SMS/UPI text straight into the capture flow.
    share_target: {
      action: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/capture/`,
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
  } as MetadataRoute.Manifest;
}
