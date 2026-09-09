export type Source = { id: string; title: string; content: string };
export const demoDocuments: Source[] = [
  {
    id: "sample-returns",
    title: "Returns & refunds",
    content:
      "Unused items can be returned within 30 days of delivery. Keep the original packaging and include your order number. Refunds are sent to the original payment method within 5–7 business days after the returned item is inspected. Shipping fees are non-refundable.",
  },
  {
    id: "sample-shipping",
    title: "Shipping & delivery",
    content:
      "Standard shipping takes 3–5 business days. Express shipping takes 1–2 business days. Orders over $50 qualify for free standard shipping. You will receive a tracking link by email when your order ships.",
  },
  {
    id: "sample-orders",
    title: "Changing an order",
    content:
      "To change or cancel an order, contact the support team with your order number within 2 hours of placing it. Once an order has shipped, it cannot be changed or canceled. You can return eligible items after delivery.",
  },
];
const stopWords = new Set(
  "a an the is are can i my me to of for how what do does in on and you your it with please tell about s".split(
    " ",
  ),
);
export function retrieveDemo(question: string, docs = demoDocuments): Source[] {
  const terms = [...new Set(question.toLowerCase().match(/[a-z0-9]+/g) ?? [])].filter(
    (t) => !stopWords.has(t),
  );
  return docs
    .map((doc) => ({
      doc,
      score: terms.reduce(
        (score, term) =>
          score + ((doc.title + " " + doc.content).toLowerCase().includes(term) ? 1 : 0),
        0,
      ),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((item) => item.doc);
}
export const unknownAnswer =
  "I couldn’t find an answer in the loaded documents. Try rephrasing your question or add a document that covers this topic.";
