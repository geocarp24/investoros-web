import type { Metadata } from "next";
import { readFile } from "node:fs/promises";
import path from "node:path";
import ReactMarkdown from "react-markdown";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "InvestorOS Privacy Policy — how we collect, use, and protect your data",
};

export const revalidate = 3600;

async function loadContent(): Promise<string> {
  const filePath = path.join(process.cwd(), "src", "content", "legal", "privacy.md");
  return readFile(filePath, "utf8");
}

export default async function PrivacyPage() {
  const markdown = await loadContent();
  return (
    <main className="min-h-screen bg-white text-[#0f172a]">
      <article className="max-w-3xl mx-auto px-6 py-16 legal-prose">
        <ReactMarkdown>{markdown}</ReactMarkdown>
        <footer className="mt-16 pt-8 border-t border-black/10 text-sm text-[#64748b]">
          <p>
            Questions? Email{" "}
            <a
              href="mailto:privacy@investoros.tech"
              className="text-[#6366f1] underline underline-offset-2"
            >
              privacy@investoros.tech
            </a>
            .
          </p>
          <p className="mt-2">
            <a href="/" className="text-[#6366f1] underline underline-offset-2">
              ← Back to InvestorOS
            </a>{" "}
            ·{" "}
            <a href="/terms" className="text-[#6366f1] underline underline-offset-2">
              Terms of Service
            </a>
          </p>
        </footer>
      </article>
    </main>
  );
}
