const text = `\`\`\`json
{
  "mediaItems": [
    {
      "sectionId": "founding-and-regal-period",
      "mediaId": "romulus-remus-she-wolf",
      "type": "image",
      "prompt": "A dramatic Renaissance-style painting of Romulus and Remus",
      "caption": "The Capitoline Wolf nursing Romulus and Remus",
      "src": ""
    }
  ]
}
\`\`\``;

const JSON_FENCE = /\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/g;
const JSON_OBJECT = /\{[\s\S]*\}/;

console.log("=== TESTING JSON EXTRACTION ===");

// Test JSON_FENCE
const fenceResults = [];
let match;
while ((match = JSON_FENCE.exec(text)) !== null) {
  fenceResults.push(match[1].trim());
}
console.log("Fence results count:", fenceResults.length);
for (const r of fenceResults) {
  console.log("Candidate:", r.slice(0, 100) + "...");
  try {
    const parsed = JSON.parse(r);
    console.log("  PARSE OK:", Object.keys(parsed));
  } catch (e) {
    console.log("  PARSE FAIL:", e.message);
  }
}

// Test JSON_OBJECT
const objMatch = text.match(JSON_OBJECT);
if (objMatch) {
  console.log("JSON_OBJECT match length:", objMatch[0].length);
  try {
    const parsed = JSON.parse(objMatch[0]);
    console.log("  PARSE OK:", Object.keys(parsed));
  } catch (e) {
    console.log("  PARSE FAIL:", e.message);
  }
}
