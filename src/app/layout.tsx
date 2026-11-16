import type { Metadata, Viewport } from "next";
import { Fredoka, Poppins } from "next/font/google";
import "./globals.css";

const fredoka = Fredoka({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "rafa sourdough & cookies",
  description: "Homemade, small-batch sourdough and cookies. Preorder this week's drop for pickup.",
  openGraph: { title: "rafa sourdough & cookies", images: ["/logo.png"] },
};

export const viewport: Viewport = { themeColor: "#FBF4EC" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fredoka.variable} ${poppins.variable}`}>
      <body>{children}</body>
    </html>
  );
}
