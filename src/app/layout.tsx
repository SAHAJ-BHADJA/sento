import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "Sento — apply on autopilot",
  description:
    "Sento finds roles that fit you, tailors your résumé, and applies — pausing for you only when a human is truly needed.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
