import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "InvestorOS — The Operating System for Real Estate Investors",
    template: "%s · InvestorOS",
  },
  description:
    "Lead capture, CRM, AI receptionist, deal analysis, social media, and skip tracing — bilingual, automated, and built for real estate investors.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://investoros.tech"
  ),
  openGraph: {
    title: "InvestorOS",
    description: "The Operating System for Real Estate Investors",
    url: "/",
    siteName: "InvestorOS",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
