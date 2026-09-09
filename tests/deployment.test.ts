import test from "node:test";
import assert from "node:assert/strict";
import { deploymentErrors, documentWritesEnabled } from "../lib/deployment";

const valid = {
  GOOGLE_API_KEY: "test-key",
  DATABASE_URL: "postgresql://user:secret@ep-test-pooler.region.aws.neon.tech/db?sslmode=require",
  DATABASE_URL_UNPOOLED: "postgresql://user:secret@ep-test.region.aws.neon.tech/db?sslmode=require",
  GEMINI_MODEL: "test-chat",
  EMBEDDING_MODEL: "test-embedding",
};
test("deployment validates pooled Neon URLs, TLS, and settings", () => {
  assert.deepEqual(deploymentErrors(valid), []);
  assert.ok(
    deploymentErrors({ ...valid, DATABASE_URL: valid.DATABASE_URL_UNPOOLED }).some((x) =>
      x.includes("pooled"),
    ),
  );
  assert.ok(
    deploymentErrors({
      ...valid,
      DATABASE_URL: valid.DATABASE_URL.replace("?sslmode=require", ""),
    }).some((x) => x.includes("TLS")),
  );
  assert.ok(deploymentErrors({ ...valid, MIN_RETRIEVAL_SCORE: "NaN" }).length);
  assert.ok(
    deploymentErrors({ ...valid, DATABASE_URL: "postgresql://user:secret@localhost/db" }).length,
  );
});
test("errors never include credential values", () => {
  const errors = deploymentErrors({ ...valid, DATABASE_URL: "secret-invalid-credential" });
  assert.ok(errors.length);
  assert.ok(!errors.join(" ").includes("secret-invalid-credential"));
});
test("Vercel document editing fails closed without affecting local uploads", () => {
  assert.equal(documentWritesEnabled({}), true);
  assert.equal(documentWritesEnabled({ VERCEL: "1" }), false);
  assert.equal(documentWritesEnabled({ VERCEL: "1", ALLOW_DOCUMENT_WRITES: "false" }), false);
  assert.equal(documentWritesEnabled({ VERCEL: "1", ALLOW_DOCUMENT_WRITES: "yes" }), false);
  assert.equal(documentWritesEnabled({ VERCEL: "1", ALLOW_DOCUMENT_WRITES: "true" }), true);
});
