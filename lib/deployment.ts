type Environment = Record<string, string | undefined>;

export function documentWritesEnabled(env: Environment = process.env) {
  return (
    env.ALLOW_DOCUMENT_WRITES === "true" ||
    (env.VERCEL !== "1" && env.ALLOW_DOCUMENT_WRITES !== "false")
  );
}

export function deploymentErrors(env: Environment): string[] {
  const errors: string[] = [];
  if (!env.GOOGLE_API_KEY?.trim()) errors.push("GOOGLE_API_KEY is required.");
  for (const key of ["DATABASE_URL", "DATABASE_URL_UNPOOLED"] as const) {
    const value = env[key];
    if (!value) {
      errors.push(key + " is required.");
      continue;
    }
    try {
      const url = new URL(value);
      if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error();
      if (!url.hostname.endsWith(".neon.tech")) errors.push(key + " must point to Neon.");
      if (!["require", "verify-full"].includes(url.searchParams.get("sslmode") ?? ""))
        errors.push(key + " must require TLS (sslmode=require or verify-full).");
      if (key === "DATABASE_URL" && !url.hostname.includes("-pooler."))
        errors.push("DATABASE_URL must use the pooled Neon endpoint.");
      if (key === "DATABASE_URL_UNPOOLED" && url.hostname.includes("-pooler."))
        errors.push("DATABASE_URL_UNPOOLED must use the direct Neon endpoint.");
    } catch {
      errors.push(key + " must be a valid PostgreSQL URL.");
    }
  }
  if (!env.GEMINI_MODEL?.trim()) errors.push("GEMINI_MODEL must be explicitly configured.");
  if (!env.EMBEDDING_MODEL?.trim()) errors.push("EMBEDDING_MODEL must be explicitly configured.");
  const score = Number(env.MIN_RETRIEVAL_SCORE ?? "0.5");
  if (!Number.isFinite(score) || score <= 0 || score > 1)
    errors.push("MIN_RETRIEVAL_SCORE must be greater than 0 and at most 1.");
  if (env.ALLOW_DOCUMENT_WRITES && !["true", "false"].includes(env.ALLOW_DOCUMENT_WRITES))
    errors.push("ALLOW_DOCUMENT_WRITES must be true or false.");
  return errors;
}
