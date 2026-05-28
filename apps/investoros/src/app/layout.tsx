import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
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
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "#6366f1",
          colorBackground: "#09090f",
          colorInputBackground: "#16161f",
          colorInputText: "#f8f8ff",
          colorText: "#f8f8ff",
          colorTextSecondary: "#94a3b8",
          colorNeutral: "#94a3b8",
          borderRadius: "0.625rem",
          fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
        },
        elements: {
          card: "bg-[#111118] border border-white/10 shadow-2xl",
          formButtonPrimary:
            "bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 hover:opacity-90 transition-opacity",
        },
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <body className="min-h-screen antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
