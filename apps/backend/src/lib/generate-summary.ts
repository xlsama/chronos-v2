import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { env } from "../env";
import { logger } from "./logger";
import { buildMultimodalParts } from "./attachment-parts";

type Attachment = { type: "image" | "file"; url: string; name: string; mimeType: string };

const openai = createOpenAI({
  apiKey: env.OPENAI_API_KEY,
  baseURL: env.OPENAI_BASE_URL,
});

export async function generateIncidentSummary(
  content: string,
  attachments: Attachment[] | null,
): Promise<string | null> {
  try {
    const userContent = await buildMultimodalParts(content, attachments);

    logger.info({ model: env.OPENAI_MODEL_MINI, content: content.slice(0, 200) }, 'Summary request');

    const { text } = await generateText({
      model: openai.chat(env.OPENAI_MODEL_MINI),
      system:
        "你是一个运维告警摘要生成器。根据告警内容（可能包含文本、图片、文件），用一句简洁的中文概括核心问题。要求：不超过50字，直接描述问题本身，不要加前缀。",
      messages: [{ role: "user", content: userContent }],
      maxOutputTokens: 100,
    });

    logger.info({ text }, 'Summary response');

    return text.trim() || null;
  } catch (err) {
    logger.warn({ err }, "Failed to generate incident summary");
    return null;
  }
}
