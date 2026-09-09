// Only whole-message conversational intents bypass document retrieval.
// Mixed messages such as "Hi, what is your refund policy?" still use RAG.
export function conversationalReply(question: string): string | null {
  const text = question
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[!?.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const greeting = /^(hi|hello|hey|hiya|good morning|good afternoon|good evening)( there)?$/;
  if (greeting.test(text)) {
    return "Hi! I’m your support assistant. I can help you find answers in your company’s documents and FAQs. What would you like help with?";
  }
  const request = text.replace(/^(hi|hello|hey)( there)? /, "");
  if (
    /^(how can you help( me)?|what can you (do( for me)?|help( me)? with)|what do you do|who are you|can you help( me)?|help( me)?|what are your capabilities)$/.test(
      request,
    )
  ) {
    return "I can answer questions using your company’s documents and FAQs, explain the information I find, and show the sources behind my answers. Tell me what you need help with. If the information isn’t in the knowledge base, I’ll let you know.";
  }
  if (/^(thanks|thank you|thanks a lot|thank you very much|cheers)$/.test(text)) {
    return "You’re welcome! Let me know if you have another question.";
  }
  return null;
}
