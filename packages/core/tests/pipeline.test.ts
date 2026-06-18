import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSend, mockWebSearch } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockWebSearch: vi.fn(),
}));

vi.mock("../src/llm.js", () => ({
  sendPrompt: mockSend,
  webSearch: mockWebSearch,
  sendPromptStream: vi.fn(async () => ({ text: "", toolCalls: undefined, usage: undefined })),
}));

const { researchPhase, outlinePhase, writePhase, verifyPhase, applyCorrections, mediaPhase } = await import("../src/pipeline/orchestrator.js");

function mockPhase(contentCheck: string, json: any) {
  mockSend.mockImplementation(async (messages: any[]) => {
    const content = messages[messages.length - 1]?.content || "";
    if (content.includes(contentCheck)) {
      return { text: JSON.stringify(json), structuredOutput: json };
    }
    return { text: "{}", structuredOutput: {} };
  });
}

describe("Pipeline Phases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWebSearch.mockResolvedValue([]);
  });

  it("researchPhase returns structured research data", async () => {
    mockPhase("Research topic", {
      summary: "Test summary",
      facts: [{ key: "founded", value: "Founded in 27 BCE", source: "https://x.com" }],
      sources: [{ title: "X", url: "https://x.com", relevance: "high" }],
      relatedTopics: ["Ancient Rome"],
      suppression: [],
    });
    const result = await researchPhase("Roman Empire");
    expect(result.summary).toBe("Test summary");
    expect(result.facts).toHaveLength(1);
    expect(mockWebSearch).toHaveBeenCalledWith("Roman Empire");
  });

  it("outlinePhase returns section outline", async () => {
    mockPhase("Create an outline", {
      sections: [{ id: "intro", title: "Introduction", key_points: ["Overview"] }],
      categories: ["History"],
      suggestedMedia: [],
      timelineEvents: [],
    });
    const research = { summary: "Test", facts: [], sources: [], relatedTopics: [], suppression: [] };
    const result = await outlinePhase("Roman Empire", research);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].id).toBe("intro");
  });

  it("writePhase returns article content", async () => {
    mockPhase("Write an encyclopedia article", {
      title: "Roman Empire",
      abstract: "Test abstract",
      sections: [{ id: "sec1", title: "Sec1", content: "Content", media: [] }],
      timeline: [],
      categories: [],
      crossrefs: [],
      citations: [],
      threedScenes: [],
    });
    const research = { summary: "Test", facts: [], sources: [], relatedTopics: [], suppression: [] };
    const outline = { sections: [], timelineEvents: [], suggestedMedia: [], categories: [] };
    const result = await writePhase("Roman Empire", research, outline);
    expect(result.title).toBe("Roman Empire");
    expect(result.sections).toHaveLength(1);
  });

  it("verifyPhase returns verification result", async () => {
    mockPhase("Verify this article", {
      verified: true,
      confidenceScore: 0.95,
      issues: [],
      corrections: [],
    });
    const research = { summary: "Test", facts: [], sources: [], relatedTopics: [], suppression: [] };
    const content = { title: "T", abstract: "", sections: [], timeline: [], categories: [], crossrefs: [], citations: [], threedScenes: [] };
    const result = await verifyPhase("Roman Empire", research, content);
    expect(result.verified).toBe(true);
    expect(result.confidenceScore).toBeGreaterThan(0.9);
  });

  it("applyCorrections returns corrected content", async () => {
    mockPhase("Apply corrections", {
      title: "Roman Empire",
      abstract: "Corrected abstract",
      sections: [{ id: "sec1", title: "Sec1", content: "Fixed", media: [] }],
      timeline: [],
      categories: [],
      crossrefs: [],
      citations: [],
      threedScenes: [],
    });
    const content = { title: "T", abstract: "", sections: [], timeline: [], categories: [], crossrefs: [], citations: [], threedScenes: [] };
    const verification = { verified: false, confidenceScore: 0.3, issues: [], corrections: [], summary: "" };
    const result = await applyCorrections("Roman Empire", content, verification);
    expect(result.abstract).toBe("Corrected abstract");
  });

  it("mediaPhase returns media items", async () => {
    mockPhase("Generate media", {
      mediaItems: [{ sectionId: "intro", mediaId: "m1", type: "image", prompt: "test", caption: "Test" }],
    });
    const outline = { sections: [], timelineEvents: [], suggestedMedia: [], categories: [] };
    const content = { title: "T", abstract: "", sections: [], timeline: [], categories: [], crossrefs: [], citations: [], threedScenes: [] };
    const result = await mediaPhase("Roman Empire", outline, content);
    expect(result.mediaItems).toHaveLength(1);
    expect(result.mediaItems[0].type).toBe("image");
  });
});
