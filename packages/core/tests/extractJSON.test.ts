import { describe, it, expect } from "vitest";

function extractJSON(response: { text: string; structuredOutput?: unknown }): object {
  if (response.structuredOutput) return response.structuredOutput as object;

  let raw = response.text.trim();

  const JSON_FENCE = /```(?:json)?\s*([\s\S]*?)```/g;
  const JSON_OBJECT = /\{[\s\S]*\}/;

  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = JSON_FENCE.exec(raw)) !== null) {
    results.push(match[1].trim());
  }

  if (results.length === 0) {
    const objMatch = raw.match(JSON_OBJECT);
    if (objMatch) results.push(objMatch[0]);
  }

  if (results.length === 0) {
    throw new Error(`No JSON found in response. Text: ${raw.slice(0, 500)}`);
  }

  for (const candidate of results) {
    try {
      return JSON.parse(candidate);
    } catch {
      const fixed = candidate
        .replace(/,\s*([}\]])/g, "$1")
        .replace(/\/\/[^\n]*/g, "")
        .replace(/(?<!\\)\\(?!["\\/bfnrtu])/g, "\\\\\\\\");
      try {
        return JSON.parse(fixed);
      } catch {
        // try next candidate
      }
    }
  }

  throw new Error(
    `Agent returned invalid JSON. First 500 chars: ${raw.slice(0, 500)}`
  );
}

describe("extractJSON", () => {
  it("should return structuredOutput if present", () => {
    const result = extractJSON({ text: "garbage", structuredOutput: { key: "value" } });
    expect(result).toEqual({ key: "value" });
  });

  it("should parse clean JSON from text", () => {
    const result = extractJSON({ text: '{"name": "test", "value": 42}' });
    expect(result).toEqual({ name: "test", value: 42 });
  });

  it("should extract JSON from code fences", () => {
    const result = extractJSON({
      text: "```json\n{\"title\": \"Hello\", \"count\": 5}\n```",
    });
    expect(result).toEqual({ title: "Hello", count: 5 });
  });

  it("should extract JSON from code fences without json tag", () => {
    const result = extractJSON({
      text: "```\n{\"key\": \"value\"}\n```",
    });
    expect(result).toEqual({ key: "value" });
  });

  it("should fix trailing commas", () => {
    const result = extractJSON({
      text: '{"items": [1, 2, 3,], "name": "test",}',
    });
    expect(result).toEqual({ items: [1, 2, 3], name: "test" });
  });

  it("should throw on invalid JSON with no braces", () => {
    expect(() => extractJSON({ text: "hello world" })).toThrow("No JSON found");
  });

  it("should handle nested objects", () => {
    const result = extractJSON({
      text: '{"outer": {"inner": {"deep": true}, "list": [1, 2]}}',
    });
    expect(result).toEqual({ outer: { inner: { deep: true }, list: [1, 2] } });
  });

  it("should handle text before and after JSON", () => {
    const result = extractJSON({
      text: "Here is the data:\n\n{\"status\": \"ok\"}\n\nThat's it.",
    });
    expect(result).toEqual({ status: "ok" });
  });
});
