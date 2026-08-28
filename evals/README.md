# Agent evaluation contract

`golden-photo-analysis.jsonl` is the governed scenario contract. CI validates its shape, unique IDs, hard-negative coverage, and safety expectations. It does not pretend that text descriptions are real vision fixtures.

Live model evaluation requires rights-cleared, human-reviewed images stored outside the public repository with a manifest containing fixture ID, SHA-256, rights/consent status, expected visible cars, exact release evidence, and review date. Run those evals only in a staging OpenAI project with the release model/config pinned; store trace IDs and aggregate metrics, not raw customer photos.

Release metrics: exact casting accuracy, exact release accuracy, visible-car recall, chase precision, unsupported-claim count, schema success rate, deterministic score stability, p95 latency, and cost per analysis. Block a release on any chase false-positive regression, exact-release accuracy drop, schema failure increase, or score change from the same validated observation without an intentional version bump.
