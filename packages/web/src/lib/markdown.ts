import DOMPurify from "dompurify";

function cleanMediaPlaceholders(md: string): string {
  const lines = md.split("\n");
  const cleaned = lines.filter((line) => {
    const t = line.trim();
    if (!t) return true;
    if (/(?:Media|Image|Diagram|3D)\s+(?:suggestions?|pending|placeholders?)/i.test(t)) return false;
    if (/^\[Media:/i.test(t)) return false;
    // Lines consisting of a single emoji (1-2 Unicode chars)
    if (/^[🏛🗺🌍🎨🔬⚗⚔📖🏺🎵🎭📜🔍💡🧊📊🖼]\uFE0F?$/u.test(t)) return false;
    return true;
  });
  return cleaned.join("\n").replace(/\n{3,}/g, "\n\n");
}

export function mdToHTML(md: string): string {
  let html = cleanMediaPlaceholders(md);

  // Tables — match header row + separator + body rows
  html = html.replace(
    /(\|[^\n]+\|\n\|[-:| ]+\|\n?)((?:\|[^\n]+\|\n?)*)/g,
    (_, headerSep: string, body: string) => {
      const lines = headerSep.trim().split("\n");
      const headerRow = lines[0];
      const headers = headerRow.split("|").filter((c: string) => c.trim()).map((c: string) => c.trim());
      const bodyRows = body.trim().split("\n").filter((l: string) => l.trim().startsWith("|"));

      if (headers.length === 0) return _;

      const thead = `<thead><tr>${headers.map((h: string) => `<th style="padding:0.5rem 0.75rem;border:2px solid #1c1917;background:#fef3c7;text-align:left;font-family:'Press Start 2P',monospace;font-size:0.65rem;">${h}</th>`).join("")}</tr></thead>`;
      const tbody = bodyRows.length > 0
        ? `<tbody>${bodyRows.map((row: string) => {
            const cells = row.split("|").filter((c: string) => c.trim()).map((c: string) => c.trim());
            return `<tr>${cells.map((c: string) => `<td style="padding:0.4rem 0.75rem;border:1.5px solid #ddd;font-size:0.9rem;">${c}</td>`).join("")}</tr>`;
          }).join("")}</tbody>`
        : "";

      return `<div style="overflow-x:auto;margin:1rem 0;"><table style="width:100%;border-collapse:collapse;border:3px solid #1c1917;box-shadow:4px 4px 0 rgba(28,25,23,0.1);">${thead}${tbody}</table></div>`;
    }
  );

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote style="border-left:4px solid var(--orange);padding:0.75rem 1rem;margin:1rem 0;background:var(--cream);font-style:italic;">$1</blockquote>');

  // Unordered lists
  html = html.replace(/^(\- .+(?:\n\- .+)*)/gm, (match: string) => {
    const items = match.split("\n").map((l: string) => `<li>${l.replace(/^\- /, "")}</li>`).join("");
    return `<ul style="padding-left:1.5rem;margin:0.5rem 0;">${items}</ul>`;
  });

  // Code blocks (not inline — fenced)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background:#1a1a2e;color:#e0e0e0;padding:1rem;border-radius:4px;overflow-x:auto;font-size:0.85rem;line-height:1.4;margin:0.75rem 0;"><code>$2</code></pre>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code style="background:#f0f0f0;padding:0.15rem 0.4rem;border-radius:3px;font-size:0.9em;border:1px solid #ddd;">$1</code>');

  // Bold, italic, links
  html = html
    .replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:underline;text-underline-offset:2px;">$1</a>');

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-weight:700;font-size:1.1rem;margin-top:1.25rem;margin-bottom:0.5rem;">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="font-weight:800;font-size:1.3rem;margin-top:1.5rem;margin-bottom:0.5rem;border-bottom:2px solid #e0e0e0;padding-bottom:0.25rem;">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 style="font-weight:800;font-size:1.5rem;margin-top:1.5rem;margin-bottom:0.5rem;">$1</h1>');

  // Horizontal rules
  html = html.replace(/^---+\s*$/gm, '<hr style="border:none;border-top:2px dashed #e0e0e0;margin:1.5rem 0;" />');

  // Paragraphs — wrap text blocks, avoid breaking block elements
  html = html
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      if (/^<(?:table|div|h[1-6]|blockquote|ul|ol|li|pre|hr)/i.test(block)) return block;
      return `<p style="line-height:1.7;margin:0.75rem 0;">${block}</p>`;
    })
    .join("\n");

  return html;
}

export function sanitizeHTML(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "em", "u", "s", "blockquote", "code", "pre",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "ul", "ol", "li",
      "a", "img",
      "table", "thead", "tbody", "tr", "th", "td",
      "div", "span", "details", "summary",
    ],
    ALLOWED_ATTR: [
      "href", "target", "rel", "src", "alt", "title",
      "style", "class", "id",
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|\/|#)/i,
  });
}
