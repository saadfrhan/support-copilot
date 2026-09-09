"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUp,
  Check,
  FileText,
  LoaderCircle,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { demoDocuments, type Source } from "@/lib/demo";
import { AnswerDetails, type ReplyMetrics } from "@/components/answer-details";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  meta?: ReplyMetrics;
};
type Status = {
  mode: "demo" | "live";
  google: boolean;
  database: boolean;
  documentWrites?: boolean;
};

export default function Home() {
  const [status, setStatus] = useState<Status | null>(null);
  const [documents, setDocuments] = useState<Source[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [notice, setNotice] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const sending = useRef(false);
  const mutating = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const chatInput = useRef<HTMLInputElement>(null);

  async function loadDocuments() {
    const response = await fetch("/api/documents");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setDocuments(data.documents);
  }

  async function checkConnection() {
    setError("");
    try {
      const response = await fetch("/api/status");
      if (!response.ok) throw new Error("Could not check the connection.");
      const data: Status = await response.json();
      setStatus(data);
      if (data.mode === "live") await loadDocuments();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect to the app.");
    }
  }

  useEffect(() => {
    void checkConnection();
  }, []);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, busy]);

  async function storeDocument(doc: { title: string; content: string }) {
    const response = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(doc),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data as Source;
  }

  async function addDocument(e: FormEvent) {
    e.preventDefault();
    await saveDocument(title.trim() || "Untitled document", content);
  }

  async function saveDocument(documentTitle: string, documentContent: string) {
    if (!status || mutating.current) return;
    mutating.current = true;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (documentContent.trim().length < 20 || documentContent.length > 100000)
        throw new Error("Add between 20 and 100,000 characters of text.");
      if (status.mode === "demo" && documents.length >= 6)
        throw new Error("The local preview supports up to 6 documents. Remove one to add another.");
      const doc =
        status.mode === "live"
          ? await storeDocument({ title: documentTitle, content: documentContent })
          : { id: crypto.randomUUID(), title: documentTitle, content: documentContent.trim() };
      setDocuments((d) => [...d, doc]);
      setAdding(false);
      setTitle("");
      setContent("");
      setNotice("Document added. Ask a question about it.");
      chatInput.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add the document.");
    } finally {
      mutating.current = false;
      setSaving(false);
    }
  }

  async function loadSample() {
    if (!status || mutating.current) return;
    mutating.current = true;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const missing = demoDocuments.filter(
        (sample) =>
          !documents.some((d) => d.title === sample.title && d.content === sample.content),
      );
      if (status.mode === "demo" && documents.length + missing.length > 6)
        throw new Error("Remove some documents first. The local preview supports 6 documents.");
      for (const sample of missing) {
        const doc = status.mode === "live" ? await storeDocument(sample) : sample;
        setDocuments((d) => [...d, doc]);
      }
      setNotice("Sample FAQ loaded. Try “What is the return policy?”");
      chatInput.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the sample.");
    } finally {
      mutating.current = false;
      setSaving(false);
    }
  }

  async function removeDocument(doc: Source) {
    if (mutating.current || sending.current) return;
    mutating.current = true;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (status?.mode === "live") {
        const response = await fetch("/api/documents?id=" + encodeURIComponent(doc.id), {
          method: "DELETE",
        });
        if (!response.ok) throw new Error((await response.json()).error);
      }
      setDocuments((d) => d.filter((item) => item.id !== doc.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove the document.");
    } finally {
      mutating.current = false;
      setSaving(false);
    }
  }

  async function ask(value = question) {
    const text = value.trim();
    if (!text || sending.current || !status) return;
    const requestStarted = performance.now();
    sending.current = true;
    setBusy(true);
    setError("");
    setQuestion("");
    const previous = messages
      .slice(-6)
      .map(({ role, content }) => ({ role, content: content.slice(0, 4000) }));
    setMessages((m) => [...m, { role: "user", content: text }]);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text,
          history: previous,
          ...(status.mode === "demo" ? { documents } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: data.answer,
          sources: data.sources,
          meta: data.meta
            ? { ...data.meta, responseMs: Math.round(performance.now() - requestStarted) }
            : undefined,
        },
      ]);
    } catch (e) {
      setMessages((m) => m.slice(0, -1));
      setQuestion(text);
      setError(e instanceof Error ? e.message : "Could not send the question. Try again.");
    } finally {
      sending.current = false;
      setBusy(false);
      chatInput.current?.focus();
    }
  }

  const measuredReplies = messages.flatMap((m) => (m.meta ? [m.meta] : []));
  const averageResponseMs = measuredReplies.length
    ? measuredReplies.reduce((total, meta) => total + meta.responseMs, 0) / measuredReplies.length
    : null;

  const canEdit = status?.documentWrites !== false;

  const sampleLoaded = demoDocuments.every((sample) =>
    documents.some((d) => d.title === sample.title && d.content === sample.content),
  );
  const suggestions = sampleLoaded
    ? ["What is the return policy?", "How long does shipping take?", "Can I cancel an order?"]
    : ["How can you help me?"];

  return (
    <main className="demo">
      <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Chat with your documents
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            {canEdit
              ? "Upload a document. Ask anything about it."
              : "Ask questions. Check the sources behind each answer."}
          </p>
        </div>
        <Button
          variant="quiet"
          size="sm"
          onClick={() => setShowSetup((s) => !s)}
          aria-expanded={showSetup}
        >
          <span
            className={
              status?.mode === "live" && status.database
                ? "size-2 rounded-full bg-green-700"
                : "size-2 rounded-full bg-amber-700"
            }
          />
          {status
            ? status.mode === "live"
              ? status.database
                ? "AI mode"
                : "Database needs setup"
              : "Local preview"
            : "Checking connection…"}
        </Button>
      </header>

      <Collapsible open={showSetup} onOpenChange={setShowSetup}>
        <CollapsibleContent>
          <Card className="mb-5 gap-4">
            <CardHeader>
              <CardTitle>Connection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                {status?.mode === "live"
                  ? "Gemini answers questions using the documents stored in PostgreSQL."
                  : "Local preview finds matching text without generating AI answers."}
              </p>
              <p>
                For Gemini answers, set <code>GOOGLE_API_KEY</code> and <code>DATABASE_URL</code> in{" "}
                <code>.env.local</code>, start the database, then restart the app.
              </p>
              <code className="block rounded-md bg-muted p-3 break-words">
                podman compose up -d db &amp;&amp; npm run db:setup
              </code>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  Gemini key: {status?.google ? "set" : "missing"} · Database:{" "}
                  {status?.database ? "ready" : "not ready"}
                </span>
                <Button variant="outline" size="sm" onClick={checkConnection}>
                  Check again
                </Button>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {error && (
        <Alert variant="destructive" className="mb-5 flex items-center justify-between gap-4">
          <AlertDescription className="text-destructive">{error}</AlertDescription>
          <Button variant="quiet" size="sm" onClick={() => setError("")}>
            Dismiss
          </Button>
        </Alert>
      )}

      <div className="columns">
        <Card className="documents gap-0 py-5">
          <CardContent className="space-y-4 px-5">
            {canEdit ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={!status || saving || busy || !canEdit}
                  onClick={() => fileInput.current?.click()}
                >
                  <Upload /> {saving ? "Adding…" : "Upload file"}
                </Button>
                <Button
                  variant="outline"
                  disabled={!status || saving || busy || !canEdit}
                  onClick={() => setAdding((a) => !a)}
                  aria-expanded={adding}
                >
                  <Plus /> Paste text
                </Button>
                <Button
                  variant="quiet"
                  className="justify-start px-0"
                  onClick={loadSample}
                  disabled={!status || saving || busy || sampleLoaded || !canEdit}
                >
                  {saving ? (
                    <LoaderCircle className="animate-spin" />
                  ) : sampleLoaded ? (
                    <Check />
                  ) : (
                    <FileText />
                  )}
                  {sampleLoaded
                    ? "Sample FAQ loaded"
                    : saving
                      ? "Adding documents…"
                      : "Load sample FAQ"}
                </Button>
              </div>
            ) : (
              <p className="text-base font-medium">Demo documents</p>
            )}
            <Input
              ref={fileInput}
              className="hidden"
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              aria-label="Upload a document"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                if (!/.(txt|md)$/i.test(file.name)) {
                  setError("Choose a .txt or .md file.");
                  return;
                }
                if (file.size > 100000) {
                  setError("Choose a file under 100 KB.");
                  return;
                }
                try {
                  await saveDocument(
                    file.name.replace(/.(txt|md)$/i, "").slice(0, 160),
                    await file.text(),
                  );
                } catch {
                  setError("Could not read the file. Try pasting its text instead.");
                }
              }}
            />
            <p className="text-sm text-muted-foreground">
              {canEdit
                ? ".txt or .md · up to 100 KB"
                : "Ask questions about the preloaded documents."}
            </p>

            <Collapsible open={adding} onOpenChange={setAdding}>
              <CollapsibleContent>
                <form className="space-y-4 border-t pt-4" onSubmit={addDocument}>
                  <div className="space-y-2">
                    <Label htmlFor="title">
                      Title <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="title"
                      maxLength={160}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Product FAQ"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="content">Document text</Label>
                    <Textarea
                      id="content"
                      required
                      minLength={20}
                      maxLength={100000}
                      rows={7}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Paste your document here…"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={saving || busy}>
                      {saving ? "Adding…" : "Add document"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saving}
                      onClick={() => setAdding(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CollapsibleContent>
            </Collapsible>

            {documents.length > 0 && (
              <Collapsible
                open={showDocuments}
                onOpenChange={setShowDocuments}
                className="border-t pt-3"
              >
                <CollapsibleTrigger asChild>
                  <Button variant="quiet" className="w-full justify-start px-0">
                    <FileText /> {documents.length}{" "}
                    {documents.length === 1 ? "document" : "documents"} ready
                    <span className="ml-auto text-primary">{showDocuments ? "Hide" : "View"}</span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  {documents.map((doc) => (
                    <div className="document flex items-start gap-2 border-t py-2" key={doc.id}>
                      <Collapsible className="min-w-0 flex-1">
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="quiet"
                            className="h-auto min-h-9 w-full justify-start whitespace-normal px-0 text-left text-foreground"
                          >
                            <FileText />
                            <span className="break-words">{doc.title}</span>
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="whitespace-pre-wrap break-words py-3 text-base leading-relaxed">
                          {doc.content}
                        </CollapsibleContent>
                      </Collapsible>
                      <Button
                        variant="quiet"
                        size="icon"
                        aria-label={"Remove " + doc.title}
                        disabled={saving || busy}
                        onClick={() => removeDocument(doc)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}
            {notice && (
              <Alert role="status" className="border-green-200 bg-green-50 text-green-900">
                <Check />
                <AlertDescription className="text-green-900">{notice}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card className="chat gap-0 overflow-hidden py-0">
          <CardHeader className="flex flex-row items-center justify-between border-b px-5 py-4">
            <CardTitle>Chat</CardTitle>
            <Button
              variant="quiet"
              size="sm"
              onClick={() => {
                setMessages([]);
                setError("");
                setQuestion("");
              }}
              disabled={busy || !messages.length}
            >
              <RotateCcw /> Clear chat
            </Button>
          </CardHeader>
          <CardContent className="chat-content px-0">
            {!messages.length ? (
              <div className="m-auto w-full px-6 py-8 text-center">
                <h2 className="text-xl font-medium">
                  {documents.length ? "What would you like to know?" : "Try it with a document."}
                </h2>
                <p className="mx-auto mt-3 max-w-sm text-base leading-relaxed text-muted-foreground">
                  {documents.length
                    ? "Type a question below, or try one of these."
                    : "Upload a file, or click Load sample FAQ to try an example."}
                </p>
                {documents.length > 0 && (
                  <div className="mx-auto mt-6 flex max-w-xs flex-col gap-2">
                    {suggestions.map((s) => (
                      <Button
                        variant="outline"
                        className="h-auto min-h-10 justify-between whitespace-normal text-left"
                        key={s}
                        onClick={() => ask(s)}
                        disabled={busy || saving}
                      >
                        {s}
                        <span aria-hidden="true">↗</span>
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="messages p-5" aria-live="polite">
                {messages.map((m, i) => (
                  <article className={"message mb-6 " + m.role} key={i}>
                    <strong className="block text-sm font-medium text-muted-foreground">
                      {m.role === "user" ? "You" : "Assistant"}
                    </strong>
                    <p
                      className={
                        "mt-2 whitespace-pre-wrap break-words text-base leading-relaxed " +
                        (m.role === "user" ? "inline-block rounded-lg bg-muted px-3 py-2" : "")
                      }
                    >
                      {m.content}
                    </p>
                    {m.meta && <AnswerDetails meta={m.meta} />}
                    {!!m.sources?.length && (
                      <div className="sources mt-3 space-y-2">
                        <small className="text-sm text-muted-foreground">
                          Sources · click to read
                        </small>
                        {m.sources.map((source, index) => (
                          <Collapsible key={index} className="rounded-md border">
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="quiet"
                                className="h-auto min-h-10 w-full justify-start whitespace-normal text-left text-primary"
                              >
                                <FileText />[{index + 1}] {source.title}
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="whitespace-pre-wrap break-words px-3 pb-3 text-base leading-relaxed">
                              {source.content}
                            </CollapsibleContent>
                          </Collapsible>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
            {busy && (
              <div
                className="flex items-center gap-2 px-5 pb-5 text-sm text-muted-foreground"
                role="status"
              >
                <LoaderCircle className="size-4 animate-spin" />
                Finding an answer…
              </div>
            )}
            <div ref={end} />
          </CardContent>
          <CardFooter className="block px-4 py-4">
            {averageResponseMs !== null && (
              <p className="mb-3 text-sm text-muted-foreground" aria-label="Average response time">
                Avg response: {(averageResponseMs / 1000).toFixed(2)}s · {measuredReplies.length}{" "}
                {measuredReplies.length === 1 ? "reply" : "replies"} this chat
              </p>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void ask();
              }}
            >
              <Input
                ref={chatInput}
                aria-label="Ask a question"
                className="h-11 min-w-0 flex-1 text-base md:text-base"
                placeholder={
                  documents.length ? "Ask about your documents…" : "Say hello, or add a document…"
                }
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={2000}
              />
              <Button
                className="h-11"
                type="submit"
                aria-label="Send question"
                disabled={!status || busy || saving || !question.trim()}
              >
                {busy ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <>
                    Send <ArrowUp />
                  </>
                )}
              </Button>
            </form>
            <p className="mt-3 text-sm text-muted-foreground">
              {status?.mode === "live"
                ? "Gemini answers using your documents. Check its sources."
                : "Local preview · text matching, no AI calls."}
            </p>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
