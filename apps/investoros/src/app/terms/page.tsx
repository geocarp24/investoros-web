import type { Metadata } from "next";
import { readFile } from "node:fs/promises";
import path from "node:path";
import ReactMarkdown from "react-markdown";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "InvestorOS Terms of Service — your agreement with us",
};

export const revalidate = 3600;

async function loadContent(): Promise<string> {
  const filePath = path.join(process.cwd(), "src", "content", "legal", "terms.md");
  return readFile(filePath, "utf8");
}

export default async function TermsPage() {
  const markdown = await loadContent();
  return (
    <main className="min-h-screen bg-white text-[#0f172a]">
      <article className="max-w-3xl mx-auto px-6 py-16 legal-prose">
        <ReactMarkdown>{markdown}</ReactMarkdown>
        <footer className="mt-16 pt-8 border-t border-black/10 text-sm text-[#64748b]">
          <p>
            Questions? Email{" "}
            <a
              href="mailto:legal@investoros.tech"
              className="text-[#6366f1] underline underline-offset-2"
            >
              legal@investoros.tech
            </a>
            .
          </p>
          <p className="mt-2">
            <a href="/" className="text-[#6366f1] underline underline-offset-2">
              ← Back to InvestorOS
            </a>{" "}
            ·{" "}
            <a href="/privacy" className="text-[#6366f1] underline underline-offset-2">
              Privacy Policy
            </a>
          </p>
        </footer>
      </article>
    </main>
  );
}
