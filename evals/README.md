# Agent evaluation contract

The golden set tests identity restraint, multi-car recall, chase-claim precision, case-inference precision, and deterministic score stability. CI covers deterministic logic; model evals run in a staging OpenAI project with pinned model/config and human-reviewed image fixtures. A release blocks when chase false positives increase, exact-release accuracy falls, or the same structured observation changes score.

Recommended metrics: exact casting accuracy, exact release accuracy, visible-car recall, chase precision, unsupported-claim count, schema success rate, p95 latency and cost per analysis. Store trace IDs, never raw customer photos by default.
