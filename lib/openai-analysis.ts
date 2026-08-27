import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { PhotoAnalysisSchema } from "./analysis-schema";
import { AGENT_PROMPT } from "./agent-prompt";
export async function analyzeCarImages(dataUrls: string[], market: "US") {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 90_000, maxRetries: 2 });
  const response = await client.responses.parse({ model: process.env.OPENAI_MODEL ?? "gpt-5.6", instructions: AGENT_PROMPT,
    input: [{ role: "user", content: [{ type: "input_text", text: `Analyze and rank every distinct visible car. Buyer market: ${market}. Infer a case or mix only when multiple exact releases support it. Propose next targets, but never invent unseen chase markers.` }, ...dataUrls.map((image_url) => ({ type: "input_image" as const, image_url, detail: "high" as const }))] }],
    text: { format: zodTextFormat(PhotoAnalysisSchema, "hot_wheels_photo_analysis") }, store: false });
  if (!response.output_parsed) throw new Error("The model did not return a complete structured analysis.");
  return { analysis: response.output_parsed, requestId: response._request_id ?? null };
}
