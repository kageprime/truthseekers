import fs from "node:fs";
import path from "node:path";

const IMAGE_DIR = process.env.ENCARTA_IMAGE_DIR || path.join(process.cwd(), "public", "images");
const DO_AI_URL = process.env.DO_AI_URL || "https://inference.do-ai.run/v1/images/generations";
const MODEL_ACCESS_KEY = process.env.MODEL_ACCESS_KEY || "";

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  caption: string;
}

interface DOAIResponse {
  created: number;
  data: Array<{ b64_json: string }>;
  usage: { total_tokens: number };
}

export async function generateImage(
  prompt: string,
  options?: {
    id?: string;
    caption?: string;
    size?: "1024x1024" | "1792x1024" | "1024x1792";
  }
): Promise<GeneratedImage | null> {
  if (!MODEL_ACCESS_KEY) {
    console.warn("MODEL_ACCESS_KEY not configured — skipping image generation");
    return null;
  }

  try {
    const response = await fetch(DO_AI_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MODEL_ACCESS_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "stable-diffusion-3.5-large",
        prompt,
        n: 1,
        size: options?.size || "1024x1024",
        quality: "auto",
        response_format: "b64_json",
        output_format: "png",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`DO AI inference failed (${response.status}): ${errorText}`);
      return null;
    }

    const data: DOAIResponse = await response.json() as DOAIResponse;
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) return null;

    const id = options?.id || `img-${Date.now()}`;
    const localPath = path.join(IMAGE_DIR, `${id}.png`);

    try {
      await fs.promises.access(IMAGE_DIR);
    } catch {
      await fs.promises.mkdir(IMAGE_DIR, { recursive: true });
    }

    const buffer = Buffer.from(b64, "base64");
    await fs.promises.writeFile(localPath, buffer);

    return {
      id,
      url: `/images/${id}.png`,
      prompt,
      caption: options?.caption || "",
    };
  } catch (error) {
    console.error("Image generation failed:", error);
    return null;
  }
}

export interface GeneratedVideo {
  id: string;
  url: string;
  prompt: string;
  caption: string;
}

export async function generateVideo(
  prompt: string,
  options?: {
    id?: string;
    caption?: string;
  }
): Promise<GeneratedVideo | null> {
  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey) {
    console.warn("TOGETHER_API_KEY not configured — skipping video generation");
    return null;
  }

  try {
    const response = await fetch("https://api.together.xyz/v2/videos", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "Wan-AI/Wan2.2-T2V-A14B",
        prompt,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Together AI video generation failed (${response.status}): ${errorText}`);
      return null;
    }

    const data = await response.json();
    const videoUrl = data?.data?.[0]?.url || data?.output?.url || data?.url;
    if (!videoUrl) {
      console.error("No video URL in response:", JSON.stringify(data).slice(0, 500));
      return null;
    }

    return {
      id: options?.id || `vid-${Date.now()}`,
      url: videoUrl,
      prompt,
      caption: options?.caption || "",
    };
  } catch (error) {
    console.error("Video generation failed:", error);
    return null;
  }
}

export async function generateImagesBatch(
  items: { prompt: string; id: string; caption?: string }[]
): Promise<GeneratedImage[]> {
  const results: GeneratedImage[] = [];

  for (const item of items) {
    const result = await generateImage(item.prompt, {
      id: item.id,
      caption: item.caption,
    });
    if (result) results.push(result);
  }

  return results;
}
