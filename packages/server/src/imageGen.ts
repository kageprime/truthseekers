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

const DO_VIDEO_URL = "https://inference.do-ai.run/v1/video/generations";

interface DOVideoJob {
  id: string;
  status: string;
  output?: { url?: string } | null;
  error?: string | null;
}

export async function generateVideo(
  prompt: string,
  options?: {
    id?: string;
    caption?: string;
  }
): Promise<GeneratedVideo | null> {
  if (!MODEL_ACCESS_KEY) {
    console.warn("MODEL_ACCESS_KEY not configured — skipping video generation");
    return null;
  }

  try {
    const submitRes = await fetch(DO_VIDEO_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MODEL_ACCESS_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "wan2.2-t2v-a14b",
        prompt,
        size: "1280x720",
        fps: 16,
      }),
    });

    if (!submitRes.ok) {
      const errorText = await submitRes.text();
      console.error(`DO video submission failed (${submitRes.status}): ${errorText}`);
      return null;
    }

    const job: DOVideoJob = await submitRes.json() as DOVideoJob;
    const jobId = job.id;
    if (!jobId) {
      console.error("No job ID in DO video response:", JSON.stringify(job).slice(0, 500));
      return null;
    }

    // Poll for completion (up to ~3 minutes)
    const pollUrl = `${DO_VIDEO_URL}/${jobId}`;
    const deadline = Date.now() + 180_000;
    let result: DOVideoJob | null = null;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 5_000));
      const pollRes = await fetch(pollUrl, {
        headers: { Authorization: `Bearer ${MODEL_ACCESS_KEY}` },
      });
      if (!pollRes.ok) {
        console.error(`DO video poll failed (${pollRes.status}): ${await pollRes.text()}`);
        return null;
      }
      result = await pollRes.json() as DOVideoJob;
      if (result.status === "completed") break;
      if (result.status === "failed") {
        console.error("DO video generation failed:", result.error || "unknown error");
        return null;
      }
    }

    if (!result || result.status !== "completed") {
      console.error("DO video generation timed out");
      return null;
    }

    // Download video content
    const contentUrl = result.output?.url || `https://inference.do-ai.run/v1/videos/${jobId}/content`;
    const contentRes = await fetch(contentUrl, {
      headers: { Authorization: `Bearer ${MODEL_ACCESS_KEY}` },
    });
    if (!contentRes.ok) {
      console.error(`DO video download failed (${contentRes.status})`);
      return null;
    }

    const id = options?.id || `vid-${Date.now()}`;
    const videoDir = path.join(process.cwd(), "public", "videos");
    try { await fs.promises.access(videoDir); } catch { await fs.promises.mkdir(videoDir, { recursive: true }); }
    const localPath = path.join(videoDir, `${id}.mp4`);
    const buffer = Buffer.from(await contentRes.arrayBuffer());
    await fs.promises.writeFile(localPath, buffer);

    return {
      id,
      url: `/videos/${id}.mp4`,
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
