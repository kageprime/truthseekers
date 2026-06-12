import DOMPurify from "dompurify";

export function mdToHTML(md: string): string {
  let html = md;

  // Tables — match header row + separator + body rows
  html = html.replace(
    /(\|[^\n]+\|\n\|[-:| ]+\|\n)((?:\|[^\n]+\|\n?)*)/g,
    (_, headerSep, body) => {
      const headerRow = headerSep.split("\n")[0];
      const headers = headerRow.split("|").filter((c: string) => c.trim()).map((c: string) => c.trim());
      const bodyRows = body.trim().split("\n").filter(Boolean);

      const thead = `<thead><tr>${headers.map((h: string) => `<th style="padding:0.5rem 0.75rem;border:2px solid #1c1917;background:#fef3c7;text-align:left;font-family:'Press Start 2P',monospace;font-size:0.65rem;">${h}</th>`).join("")}</tr></thead>`;
      const tbody = `<tbody>${bodyRows.map((row: string) => {
        const cells = row.split("|").filter((c: string) => c.trim()).map((c: string) => c.trim());
        return `<tr>${cells.map((c: string) => `<td style="padding:0.4rem 0.75rem;border:1.5px solid #ddd;font-size:0.9rem;">${c}</td>`).join("")}</tr>`;
      }).join("")}</tbody>`;

      return `<table style="width:100%;border-collapse:collapse;border:3px solid #1c1917;margin:1rem 0;box-shadow:4px 4px 0 rgba(28,25,23,0.1);">${thead}${tbody}</table>`;
    }
  );

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote style="border-left:4px solid var(--orange);padding:0.75rem 1rem;margin:1rem 0;background:var(--cream);font-style:italic;">$1</blockquote>');

  // Unordered lists
  html = html.replace(/^(\- .+(?:\n\- .+)*)/gm, (match: string) => {
    const items = match.split("\n").map((l: string) => `<li>${l.replace(/^\- /, "")}</li>`).join("");
    return `<ul style="padding-left:1.5rem;margin:0.5rem 0;">${items}</ul>`;
  });

  // Code blocks (inline)
  html = html.replace(/`([^`]+)`/g, '<code style="background:#f0f0f0;padding:0.15rem 0.4rem;border-radius:3px;font-size:0.9em;border:1px solid #ddd;">$1</code>');

  // Bold, italic, links
  html = html
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-weight:700;font-size:1.1rem;margin-top:1.25rem;margin-bottom:0.5rem;">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="font-weight:800;font-size:1.3rem;margin-top:1.5rem;margin-bottom:0.5rem;border-bottom:2px solid #e0e0e0;padding-bottom:0.25rem;">$1</h2>');

  // Paragraphs — avoid wrapping already-converted elements
  html = "<p>" + html.replace(/\n\n+/g, "</p><p>") + "</p>";

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
