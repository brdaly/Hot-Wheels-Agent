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
      message: "The analysis service is temporarily unavailable.",
      status: 503,
    };
  }

  if (status === 429 || name === "RateLimitError") {
    const quota = code === "insufficient_quota";
    return {
      code: quota ? "openai_quota_unavailable" : "openai_rate_limited",
      message: quota
        ? "Analysis capacity is temporarily unavailable."
        : "The analysis service is busy. Wait briefly and retry.",
      status: quota ? 503 : 429,
    };
  }

  if (status === 404 || code === "model_not_found") {
    return {
      code: "openai_model_unavailable",
      message: "The analysis service is temporarily unavailable.",
      status: 503,
    };
  }

  if (status === 400) {
    return {
      code: "openai_request_rejected",
      message: "The supplied evidence could not be processed. Try a smaller or clearer image.",
      status: 502,
    };
  }

  if (name === "APIConnectionError" || name === "APIConnectionTimeoutError") {
    return {
      code: "openai_unreachable",
      message: "The analysis service did not respond. Wait briefly and retry.",
      status: 503,
    };
  }

  return {
    code: "analysis_failed",
    message: "Unable to complete the analysis. Please retry with the trace ID available for support.",
    status: 500,
  };
}
