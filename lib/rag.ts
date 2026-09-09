import { unknownAnswer, type Source } from "./demo";

export type TokenUsage = { input: number; output: number; total: number };
export type AnswerMeta = {
  status: "answered" | "no_answer" | "conversation";
  reason: "low_score" | "no_documents" | "insufficient_evidence" | null;
  retrieval: { score: number | null; threshold: number | null };
  serverMs: number;
  generationCalled: boolean;
  tokens: TokenUsage | null;
};
export type Candidate = Source & { score: number };
export type Generation = { text: string; tokens: TokenUsage | null };

export function retrievalThreshold(value?: string) {
  if (!value?.trim()) return 0.5;
  const threshold = Number(value);
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1)
    throw new Error("MIN_RETRIEVAL_SCORE must be greater than 0 and at most 1");
  return threshold;
}

export function tokenUsage(usage?: {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
}): TokenUsage | null {
  if (!usage) return null;
  const values = [usage.input_tokens, usage.output_tokens, usage.total_tokens];
  if (values.some((v) => typeof v !== "number" || !Number.isFinite(v) || v < 0)) return null;
  return { input: usage.input_tokens!, output: usage.output_tokens!, total: usage.total_tokens! };
}

export async function answerFromRetrieval(
  candidates: Candidate[],
  threshold: number,
  generate: (sources: Source[]) => Promise<Generation>,
) {
  const ranked = candidates
    .filter((c) => Number.isFinite(c.score) && c.score >= -1 && c.score <= 1)
    .sort((a, b) => b.score - a.score);
  const retrieval = { score: ranked[0]?.score ?? null, threshold };
  const sources = ranked
    .filter((c) => c.score >= threshold)
    .slice(0, 4)
    .map(({ id, title, content }) => ({ id, title, content }));
  if (!sources.length) {
    return {
      answer: unknownAnswer,
      sources: [] as Source[],
      meta: {
        status: "no_answer" as const,
        reason: candidates.length ? ("low_score" as const) : ("no_documents" as const),
        retrieval,
        generationCalled: false,
        tokens: { input: 0, output: 0, total: 0 },
      },
    };
  }

  const generated = await generate(sources);
  const text = generated.text.trim();
  const citations = [...text.matchAll(/\[(\d+)\]/g)].map((match) => Number(match[1]));
  // A high retrieval score is not proof that the excerpts answer the question.
  // Require a cited response; the model can explicitly abstain even after retrieval.
  const unsupported =
    !text ||
    text.includes("NO_ANSWER") ||
    !citations.length ||
    citations.some((c) => c < 1 || c > sources.length);
  return {
    answer: unsupported ? unknownAnswer : text,
    sources: unsupported ? [] : sources,
    meta: {
      status: unsupported ? ("no_answer" as const) : ("answered" as const),
      reason: unsupported ? ("insufficient_evidence" as const) : null,
      retrieval,
      generationCalled: true,
      tokens: generated.tokens,
    },
  };
}
