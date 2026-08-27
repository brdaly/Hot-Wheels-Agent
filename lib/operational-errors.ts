export type PublicAnalysisError = {
  code: string;
  message: string;
  status: number;
};

type ProviderError = {
  status?: unknown;
  code?: unknown;
  type?: unknown;
  message?: unknown;
  name?: unknown;
};

export function classifyAnalysisError(error: unknown): PublicAnalysisError {
  const candidate = (error ?? {}) as ProviderError;
  const status = typeof candidate.status === "number" ? candidate.status : null;
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const name = typeof candidate.name === "string" ? candidate.name : "";

  if (status === 401 || name === "AuthenticationError") {
    return {
      code: "openai_authentication_failed",
      message: "OpenAI authentication failed. Replace OPENAI_API_KEY in Vercel and redeploy.",
      status: 503,
    };
  }

  if (status === 429 || name === "RateLimitError") {
    const quota = code === "insufficient_quota";
    return {
      code: quota ? "openai_quota_unavailable" : "openai_rate_limited",
      message: quota
        ? "OpenAI API billing or quota is unavailable. Check the API project billing settings and retry."
        : "The analysis service is temporarily rate limited. Wait briefly and retry.",
      status: quota ? 503 : 429,
    };
  }

  if (status === 404 || code === "model_not_found") {
    return {
      code: "openai_model_unavailable",
      message: "The configured OpenAI model is unavailable to this API project. Check OPENAI_MODEL in Vercel.",
      status: 503,
    };
  }

  if (status === 400) {
    return {
      code: "openai_request_rejected",
      message: "The model provider rejected the analysis request. Use the trace ID to inspect the Vercel log.",
      status: 502,
    };
  }

  if (name === "APIConnectionError" || name === "APIConnectionTimeoutError") {
    return {
      code: "openai_unreachable",
      message: "The analysis provider did not respond. Retry once; if it persists, inspect the Vercel log.",
      status: 503,
    };
  }

  return {
    code: "analysis_failed",
    message: "Unable to complete the analysis. Use the trace ID to inspect the Vercel log.",
    status: 500,
  };
}
