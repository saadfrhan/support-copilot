"use client";

import type { AnswerMeta } from "@/lib/rag";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export type ReplyMetrics = AnswerMeta & { responseMs: number };

export function AnswerDetails({ meta }: { meta: ReplyMetrics }) {
  return (
    <div className="mt-3 space-y-2">
      {meta.status === "no_answer" && (
        <p className="text-sm font-medium text-amber-800">No answer found</p>
      )}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button
            variant="quiet"
            size="sm"
            className="h-auto justify-start whitespace-normal px-0 text-left text-sm"
          >
            {(meta.responseMs / 1000).toFixed(2)}s<span aria-hidden="true">·</span>
            {meta.tokens
              ? meta.generationCalled
                ? meta.tokens.input.toLocaleString() +
                  " in / " +
                  meta.tokens.output.toLocaleString() +
                  " out tokens"
                : "0 generation tokens"
              : "Token usage unavailable"}
            <span className="text-primary">Details</span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-2 rounded-md border bg-muted/30 p-3 text-sm leading-relaxed text-muted-foreground">
          {meta.retrieval.threshold !== null && (
            <p>
              Best retrieval score: {meta.retrieval.score?.toFixed(3) ?? "none"} · Required:{" "}
              {meta.retrieval.threshold.toFixed(3)}. This is similarity, not a probability that the
              answer is correct.
            </p>
          )}
          {meta.reason === "low_score" && (
            <p>No excerpt cleared the retrieval threshold. Answer generation was skipped.</p>
          )}
          {meta.reason === "no_documents" && (
            <p>No matching document was available. Add relevant text and try again.</p>
          )}
          {meta.reason === "insufficient_evidence" && (
            <p>The available text did not produce a supported, cited answer.</p>
          )}
          {meta.status === "conversation" && (
            <p>Conversational reply; no retrieval or AI generation was needed.</p>
          )}
          <p>
            Response time includes the network request. Server processing:{" "}
            {(meta.serverMs / 1000).toFixed(2)}s.
          </p>
          {meta.generationCalled && meta.tokens && (
            <p>
              Provider-reported generation usage: {meta.tokens.total.toLocaleString()} total tokens.
            </p>
          )}
          <p>
            Generation tokens are a usage indicator, not a bill. Query embeddings, document
            indexing, and retries are excluded. Charges depend on the model and API plan.
          </p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
