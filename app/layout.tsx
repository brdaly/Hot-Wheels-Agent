import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Hot Wheels Frontier Analyst",
  description: "Evidence-led Hot Wheels identification, scoring, ranking, and collection intelligence.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
