import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { ANALYSIS_CONTRACT_VERSION, PhotoAnalysisSchema } from "./analysis-schema";
import { AGENT_PROMPT, AGENT_PROMPT_VERSION } from "./agent-prompt";

export const OPENAI_ADAPTER_VERSION = "responses-adapter-v2.0";

export async function analyzeCarEvidence(
  dataUrls: string[],
  query: string,
  market: "US",
  safetyIdentifier: string,
) {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 90_000,
    maxRetries: 1,
  });
  const evidenceMode = dataUrls.length
    ? `Visual evidence is attached.${query ? ` The collector supplied this search hint: "${query}". Treat it only as a lead and resolve conflicts in favor of visible evidence.` : ""}`
    : `No photograph is attached. Analyze the collector's typed search: "${query}".`;
  const model = process.env.OPENAI_MODEL ?? "gpt-5.6";
  const response = await client.responses.parse({
    model,
    instructions: AGENT_PROMPT,
    input: [{
      role: "user",
      content: [
        {
          type: "input_text",
          text: `${evidenceMode} Buyer market: ${market}/USD. Extract every distinct supported car. The app—not the model—will score, validate sources, check ownership and decide.`,
        },
        ...dataUrls.map((image_url) => ({ type: "input_image" as const, image_url, detail: "high" as const })),
      ],
    }],
    text: { format: zodTextFormat(PhotoAnalysisSchema, "hot_wheels_photo_analysis") },
    reasoning: { effort: "medium" },
    max_output_tokens: 6_500,
    safety_identifier: safetyIdentifier,
    store: false,
    metadata: {
      prompt_version: AGENT_PROMPT_VERSION,
      schema_version: ANALYSIS_CONTRACT_VERSION,
      adapter_version: OPENAI_ADAPTER_VERSION,
    },
  });
  if (!response.output_parsed) throw new Error("The model did not return a complete structured analysis.");
  return {
    analysis: response.output_parsed,
    requestId: response._request_id ?? null,
    usage: response.usage ?? null,
    runtime: {
      model,
      promptVersion: AGENT_PROMPT_VERSION,
      schemaVersion: ANALYSIS_CONTRACT_VERSION,
      adapterVersion: OPENAI_ADAPTER_VERSION,
    },
  };
}
