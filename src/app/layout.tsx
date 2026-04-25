import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TableShifts Development",
  description: "Next.js redesign branch for TableShifts"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
