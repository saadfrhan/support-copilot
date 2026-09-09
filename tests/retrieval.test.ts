import test from "node:test";
import assert from "node:assert/strict";
import { retrieveDemo } from "../lib/demo";

test("refund questions retrieve the return policy first", () => {
  assert.equal(retrieveDemo("What is your refund policy?")[0]?.id, "sample-returns");
});
test("unrelated questions have no sources", () => {
  assert.deepEqual(retrieveDemo("quantum astrophysics"), []);
});
test("empty queries and empty document lists return no sources", () => {
  assert.deepEqual(retrieveDemo(""), []);
  assert.deepEqual(retrieveDemo("refund", []), []);
});
test("custom documents are searched without leaking sample data", () => {
  const docs = [
    {
      id: "custom",
      title: "Museum hours",
      content: "The museum opens at 10 AM on weekends and closes at 6 PM.",
    },
  ];
  assert.equal(retrieveDemo("museum", docs)[0]?.content, docs[0].content);
  assert.deepEqual(retrieveDemo("refund", docs), []);
});
