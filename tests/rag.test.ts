import test from "node:test";
import assert from "node:assert/strict";
import { answerFromRetrieval, retrievalThreshold, tokenUsage } from "../lib/rag";
const candidate = {
  id: "returns",
  title: "Returns",
  content: "Unused items can be returned within 30 days.",
  score: 0.8,
};
const tokens = { input: 100, output: 20, total: 120 };

test("low retrieval scores skip generation and expose the fallback decision", async () => {
  let calls = 0;
  const result = await answerFromRetrieval([{ ...candidate, score: 0.49 }], 0.5, async () => {
    calls++;
    return { text: "Invented answer [1]", tokens };
  });
  assert.equal(calls, 0);
  assert.equal(result.meta.status, "no_answer");
  assert.equal(result.meta.reason, "low_score");
  assert.equal(result.meta.retrieval.score, 0.49);
  assert.deepEqual(result.sources, []);
  assert.equal(result.meta.tokens?.total, 0);
});
test("missing or invalid scores cannot trigger generation", async () => {
  for (const candidates of [
    [],
    [{ ...candidate, score: NaN }],
    [{ ...candidate, score: Infinity }],
  ]) {
    const result = await answerFromRetrieval(candidates, 0.5, async () => {
      throw new Error("Must not generate");
    });
    assert.equal(result.meta.status, "no_answer");
  }
});
test("threshold boundary is inclusive and below-threshold context is excluded", async () => {
  const result = await answerFromRetrieval(
    [
      { ...candidate, score: 0.5 },
      { ...candidate, id: "bad", score: 0.2 },
    ],
    0.5,
    async (sources) => {
      assert.equal(sources.length, 1);
      return { text: "You have 30 days. [1]", tokens };
    },
  );
  assert.equal(result.meta.status, "answered");
  assert.deepEqual(result.meta.tokens, tokens);
});
test("strong retrieval still permits abstention and rejects missing or invalid citations", async () => {
  for (const text of [
    "NO_ANSWER",
    "",
    "The answer is 42.",
    "You have 30 days. [2]",
    "Answer [0]",
  ]) {
    const result = await answerFromRetrieval([candidate], 0.5, async () => ({ text, tokens }));
    assert.equal(result.meta.status, "no_answer");
    assert.equal(result.meta.reason, "insufficient_evidence");
    assert.equal(result.meta.generationCalled, true);
    assert.deepEqual(result.sources, []);
    assert.deepEqual(result.meta.tokens, tokens);
  }
});
test("usage is not fabricated when provider metadata is absent", () => {
  assert.equal(tokenUsage(), null);
  assert.equal(tokenUsage({ input_tokens: 10 }), null);
  assert.deepEqual(tokenUsage({ input_tokens: 100, output_tokens: 20, total_tokens: 130 }), {
    input: 100,
    output: 20,
    total: 130,
  });
});
test("threshold configuration rejects unsafe or invalid values", () => {
  assert.equal(retrievalThreshold(), 0.5);
  assert.equal(retrievalThreshold("0.7"), 0.7);
  for (const value of ["0", "-1", "2", "NaN", "invalid"])
    assert.throws(() => retrievalThreshold(value));
});
