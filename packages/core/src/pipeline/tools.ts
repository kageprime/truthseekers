import { sendPrompt, webSearch } from "../llm.js";
import type { ToolDefinition } from "../models.js";
import type { ToolExecutor } from "../agent/types.js";
import type { AgentEvent, ResearchResult, ArticleOutline, ArticleContent, VerificationResult, MediaGenerationResult } from "../types.js";
import {
  VERITAS_PREAMBLE, PLINY_SUFFIX,
  RESEARCHER_INSTRUCTIONS, OUTLINER_INSTRUCTIONS, WRITER_INSTRUCTIONS,
  VERIFIER_INSTRUCTIONS, MEDIA_GENERATOR_INSTRUCTIONS,
} from "../prompts/index.js";

type Persona = "veritas" | "pliny";

function systemPrompt(persona: Persona, phaseInstructions: string): string {
  let prompt = VERITAS_PREAMBLE + "\n\n" + phaseInstructions;
  if (persona === "pliny") prompt += PLINY_SUFFIX;
  return prompt;
}

export const PIPELINE_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "research_topic",
      description: "Research a topic using web search and LLM synthesis. Returns structured facts, sources, and a summary.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "The topic to research" },
          persona: { type: "string", enum: ["veritas", "pliny"], description: "Writing persona" },
        },
        required: ["topic"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "outline_article",
      description: "Create a section outline for an encyclopedia article based on research data.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "Article topic" },
          summary: { type: "string", description: "Research summary" },
          sections: { type: "string", description: "JSON array of suggested section ids" },
        },
        required: ["topic", "summary"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_draft",
      description: "Write the full content of an encyclopedia article section by section.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "Article topic" },
          researchSummary: { type: "string", description: "Research summary text" },
          outlineJson: { type: "string", description: "JSON outline with sections" },
          persona: { type: "string", enum: ["veritas", "pliny"] },
        },
        required: ["topic", "researchSummary", "outlineJson"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "verify_article",
      description: "Cross-check article claims against research data. Returns correctness score and issues.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "Article topic" },
          researchSummary: { type: "string", description: "Research facts text" },
          articleSections: { type: "string", description: "JSON of written sections" },
        },
        required: ["topic", "researchSummary", "articleSections"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "correct_article",
      description: "Apply corrections to an article based on verification results.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string" },
          correctionsJson: { type: "string", description: "JSON of corrections to apply" },
          articleJson: { type: "string", description: "JSON of current article content" },
        },
        required: ["topic", "correctionsJson", "articleJson"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_media",
      description: "Generate DALL-E image prompts and mermaid diagram code for article sections.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "Article topic" },
          outlineJson: { type: "string", description: "Outline with suggested media" },
          articleJson: { type: "string", description: "Full article content" },
        },
        required: ["topic", "outlineJson", "articleJson"],
      },
    },
  },
];

const JSON_SCHEMA = (schema: Record<string, unknown>) => ({
  type: "json_schema" as const,
  json_schema: { name: "output", strict: true, schema },
});

export const PIPELINE_TOOL_EXECUTORS: Record<string, ToolExecutor> = {
  research_topic: async (args) => {
    const topic = args.topic;
    const persona: Persona = args.persona || "veritas";

    const searchResults = await webSearch(topic);
    const searchContext = searchResults.length > 0
      ? searchResults.map((r, i) => `[${i + 1}] ${r.title}\n    URL: ${r.url}\n    ${r.snippet.slice(0, 500)}`).join("\n\n")
      : "No web search results available.";

    const response = await sendPrompt(
      [
        { role: "system", content: systemPrompt(persona, RESEARCHER_INSTRUCTIONS) },
        { role: "user", content: `Research topic: "${topic}"\n\nWEB SEARCH RESULTS:\n${searchContext}\n\nBased on the search results above and your knowledge, produce a structured research summary.\n\nOutput valid JSON with this exact schema:\n{\n  "summary": "string — comprehensive summary of findings",\n  "facts": [{ "key": "string", "value": "string", "source": "string URL" }],\n  "sources": [{ "title": "string", "url": "string", "relevance": "string" }],\n  "relatedTopics": ["string"],\n  "suppression": ["string — any evidence of suppression, or empty array"]\n}\n\nNo text outside the JSON object.` }
      ],
      {
        model: "gemma-4-31B-it",
        reasoningEffort: "high",
        maxTokens: 32768,
        schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            facts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  key: { type: "string" },
                  value: { type: "string" },
                  source: { type: "string" },
                },
                required: ["key", "value", "source"],
                additionalProperties: false,
              },
            },
            sources: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  url: { type: "string" },
                  relevance: { type: "string" },
                },
                required: ["title", "url", "relevance"],
                additionalProperties: false,
              },
            },
            relatedTopics: { type: "array", items: { type: "string" } },
            suppression: { type: "array", items: { type: "string" } },
          },
          required: ["summary", "facts", "sources", "relatedTopics", "suppression"],
          additionalProperties: false,
        },
      }
    );

    return {
      result: response.text,
      data: response.structuredOutput as Record<string, unknown> || { summary: response.text },
    };
  },

  outline_article: async (args) => {
    const response = await sendPrompt(
      [
        { role: "user", content: `Create an outline for an encyclopedia article about: "${args.topic}".\n\nResearch Summary: ${args.summary || "N/A"}\n\nInclude 3-8 logical sections. For contested topics, add "Competing Interpretations" and "Suppressed Evidence" sections. Suggest timeline events, media, and categories.\n\nOutput valid JSON with this exact schema:\n{\n  "sections": [{ "id": "string (hyphenated)", "title": "string", "key_points": ["string"] }],\n  "categories": ["string"],\n  "suggestedMedia": [{ "section": "string (section id)", "type": "string", "description": "string" }],\n  "timelineEvents": [{ "year": "string", "title": "string", "description": "string" }]\n}\n\nNo text outside the JSON object.` }
      ],
      {
        schema: {
          type: "object",
          properties: {
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                  key_points: { type: "array", items: { type: "string" } },
                },
                required: ["id", "title", "key_points"],
                additionalProperties: false,
              },
            },
            categories: { type: "array", items: { type: "string" } },
            suggestedMedia: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  section: { type: "string" },
                  type: { type: "string" },
                  description: { type: "string" },
                },
                required: ["section", "type", "description"],
                additionalProperties: false,
              },
            },
            timelineEvents: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  year: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                },
                required: ["year", "title", "description"],
                additionalProperties: false,
              },
            },
          },
          required: ["sections", "categories", "suggestedMedia", "timelineEvents"],
          additionalProperties: false,
        },
      }
    );

    return { result: response.text, data: response.structuredOutput as Record<string, unknown> || {} };
  },

  write_draft: async (args) => {
    const persona: Persona = args.persona || "veritas";
    const response = await sendPrompt(
      [
        { role: "user", content: `Write an encyclopedia article about: "${args.topic}".\n\nRESEARCH FACTS:\n${args.researchSummary || "none"}\n\nOUTLINE:\n${args.outlineJson || "none"}\n\nWrite each section in clear, engaging markdown (2-5 paragraphs). Cite sources. Include cross-references. Name suppression where applicable.\n${persona === "pliny" ? "Pliny mode: be sharp, witty, irreverent but evidence-grounded." : "VERITAS mode: stern, scholarly, unflinching."}\n\nOutput valid JSON with this exact schema:\n{\n  "title": "string — article title",\n  "abstract": "string — 2-3 sentence summary",\n  "sections": [{ "id": "string", "title": "string", "content": "string (markdown)", "media": [] }],\n  "timeline": [{ "year": "string", "title": "string", "description": "string" }],\n  "categories": ["string"],\n  "crossrefs": [{ "id": "string", "title": "string", "relationship": "string" }],\n  "citations": [{ "title": "string", "url": "string", "relevance": "string" }],\n  "threedScenes": []\n}\n\nNo text outside the JSON object.` }
      ],
      {
        model: "gemma-4-31B-it",
        reasoningEffort: "high",
        maxTokens: 32768,
        schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            abstract: { type: "string" },
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                  content: { type: "string" },
                  media: { type: "array", items: { type: "object" } },
                },
                required: ["id", "title", "content"],
                additionalProperties: false,
              },
            },
            timeline: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  year: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                },
                required: ["year", "title", "description"],
              },
            },
            categories: { type: "array", items: { type: "string" } },
            crossrefs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                  relationship: { type: "string" },
                },
                required: ["id", "title", "relationship"],
              },
            },
            citations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  url: { type: "string" },
                  relevance: { type: "string" },
                },
                required: ["title", "url", "relevance"],
              },
            },
            threedScenes: { type: "array", items: { type: "object" } },
          },
          required: ["title", "abstract", "sections", "timeline", "categories", "crossrefs", "citations"],
          additionalProperties: false,
        },
      }
    );

    return { result: response.text, data: response.structuredOutput as Record<string, unknown> || {} };
  },

  verify_article: async (args) => {
    const response = await sendPrompt(
      [
        { role: "user", content: `Verify this article: "${args.topic}".\n\nRESEARCH FACTS:\n${args.researchSummary || "none"}\n\nARTICLE SECTIONS:\n${args.articleSections || "none"}\n\nCross-check every claim against research data. Flag unsupported assertions, contradictions, missing citations.\n\nOutput valid JSON with this exact schema:\n{\n  "verified": boolean,\n  "confidenceScore": number (0-1),\n  "issues": [{ "section": "string", "claim": "string", "issue": "string", "severity": "high|medium|low" }],\n  "corrections": [{ "section": "string", "original": "string", "corrected": "string", "reason": "string" }]\n}\n\nNo text outside the JSON object.` }
      ],
      {
        schema: {
          type: "object",
          properties: {
            verified: { type: "boolean" },
            confidenceScore: { type: "number" },
            issues: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  section: { type: "string" },
                  claim: { type: "string" },
                  issue: { type: "string" },
                  severity: { type: "string", enum: ["high", "medium", "low"] },
                },
                required: ["section", "claim", "issue", "severity"],
                additionalProperties: false,
              },
            },
            corrections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  section: { type: "string" },
                  original: { type: "string" },
                  corrected: { type: "string" },
                  reason: { type: "string" },
                },
                required: ["section", "original", "corrected", "reason"],
                additionalProperties: false,
              },
            },
          },
          required: ["verified", "confidenceScore", "issues", "corrections"],
          additionalProperties: false,
        },
      }
    );

    return { result: response.text, data: response.structuredOutput as Record<string, unknown> || {} };
  },

  correct_article: async (args) => {
    const response = await sendPrompt(
      [
        { role: "user", content: `Apply corrections to article: "${args.topic}".\n\nCORRECTIONS:\n${args.correctionsJson}\n\nCURRENT ARTICLE:\n${args.articleJson}\n\nRevise the article to fix all issues. Maintain the same JSON structure.\n\nIMPORTANT: Output valid JSON only.` }
      ],
      {
        model: "gemma-4-31B-it",
        maxTokens: 32768,
        schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            abstract: { type: "string" },
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                  content: { type: "string" },
                  media: { type: "array", items: { type: "object" } },
                },
                required: ["id", "title", "content"],
              },
            },
            timeline: { type: "array", items: { type: "object" } },
            categories: { type: "array", items: { type: "string" } },
            crossrefs: { type: "array", items: { type: "object" } },
            citations: { type: "array", items: { type: "object" } },
            threedScenes: { type: "array", items: { type: "object" } },
          },
          required: ["title", "abstract", "sections", "timeline", "categories", "crossrefs", "citations"],
          additionalProperties: false,
        },
      }
    );

    return { result: response.text, data: response.structuredOutput as Record<string, unknown> || {} };
  },

  generate_media: async (args) => {
    const response = await sendPrompt(
      [
        { role: "user", content: `Generate media for article: "${args.topic}".\n\nOUTLINE:\n${args.outlineJson || "none"}\n\nARTICLE CONTENT:\n${args.articleJson || "none"}\n\nCreate precise prompts for each media item. For images: DALL-E prompts. For diagrams: mermaid.js code.\n\nOutput valid JSON with this exact schema:\n{\n  "mediaItems": [{ "sectionId": "string", "mediaId": "string", "type": "image|diagram", "prompt": "string", "caption": "string", "src": "" }]\n}\n\nNo text outside the JSON object.` }
      ],
      {
        schema: {
          type: "object",
          properties: {
            mediaItems: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  sectionId: { type: "string" },
                  mediaId: { type: "string" },
                  type: { type: "string", enum: ["image", "diagram"] },
                  prompt: { type: "string" },
                  caption: { type: "string" },
                  src: { type: "string" },
                },
                required: ["sectionId", "mediaId", "type", "prompt", "caption"],
                additionalProperties: false,
              },
            },
          },
          required: ["mediaItems"],
          additionalProperties: false,
        },
      }
    );

    return { result: response.text, data: response.structuredOutput as Record<string, unknown> || {} };
  },
};
