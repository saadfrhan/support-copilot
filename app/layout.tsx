import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "RAG demo — Chat with your documents",
  description: "Add documents, ask a question, and inspect the sources behind the answer.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
