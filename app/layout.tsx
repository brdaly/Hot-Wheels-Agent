import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Hot Wheels Super Analyst | Daly Ventures",
  description: "Evidence-led Hot Wheels identification, scoring, ranking, US price discipline, and collection intelligence.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
