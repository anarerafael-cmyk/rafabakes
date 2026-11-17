import type { Metadata, Viewport } from "next";
import { Fredoka, Poppins } from "next/font/google";
import "./globals.css";

const fredoka = Fredoka({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "https://rafabakes.com"),
  title: "rafa sourdough & cookies",
  description: "Fresh sourdough & cookies, baked in small batches. Preorder this week's drop.",
  // The preview picture comes from src/app/opengraph-image.png, the tab icon from src/app/icon.png.
  openGraph: {
    title: "rafa sourdough & cookies",
    description: "Fresh sourdough & cookies, baked in small batches. Preorder this week's drop.",
    siteName: "rafa bakes",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#FBF4EC" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fredoka.variable} ${poppins.variable}`}>
      <body>{children}</body>
    </html>
  );
}
