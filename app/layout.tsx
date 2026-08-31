import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./styles.css";

export const metadata: Metadata = {
  applicationName: "Hot Wheels Collector Intelligence",
  title: "Hot Wheels Collector Intelligence | Daly Ventures",
  description: "Verify-first Hot Wheels identification, evidence, collection fit, and US retail price discipline.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
