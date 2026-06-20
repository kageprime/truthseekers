import { createOpencodeClient } from "@opencode-ai/sdk";

const c = createOpencodeClient({ baseUrl: "http://127.0.0.1:4098" });
const sess = await c.session.create({ body: { title: "probe3" } });
const sid = sess.data?.id;
console.log("session:", sid);

const res = await c.session.prompt({
  path: { id: sid },
  body: {
    parts: [{ type: "text", text: "Output valid JSON only. No text outside the JSON object. Topic: test article." }],
  },
});

console.log("error:", !!res.error);
const parts = res.data?.parts || [];
for (const p of parts) {
  console.log("  part type:", p.type, "text:", JSON.stringify(p.text).slice(0, 500));
}

await c.session.delete({ path: { id: sid } }).catch(() => {});
