// Whitelist HTML sanitiser for author-supplied article bodies.
//
// Blog `Content` is rendered by the frontend with Angular's [innerHTML], which
// drops <script> but not every vector (inline handlers, javascript: hrefs,
// <iframe>, <object>, style-based exfiltration). Sanitising server-side means
// what we store is already safe, so any consumer — app, RSS, email digest —
// gets the same guarantee.
//
// Deliberately dependency-free and conservative: anything not on the whitelist
// is dropped, tags keep their text content, and unclosed tags are balanced.

// tag -> attributes allowed on it.
//
// This is the article-body profile, matching the deliberately narrow Quill
// toolbar the admin editor ships with (spec/Requirement/blog-api.md). Note
// what is absent: **no `<img>`** — pictures belong in `Sections[].Image`, which
// is what keeps a picture next to the copy it illustrates, so an `<img>` that
// arrives inside a section body is dropped rather than rendered out of place.
// `<h2>` is absent too: the post's `Title` is the page's h2-level heading, and
// section headings live in `Sections[].Heading`.
export const ARTICLE_TAGS: Record<string, string[]> = {
  p: ["class"],
  h3: ["class"],
  h4: ["class"],
  strong: [],
  em: [],
  ul: ["class"],
  ol: ["class"],
  li: ["class"],
  a: ["href", "title", "target"],
  blockquote: ["cite", "class"],
  br: [],
};

// Quill writes alignment and indentation as classes on block elements. They are
// the only classes that survive — an arbitrary class attribute would let an
// author reach into the site's stylesheet.
const ALLOWED_CLASS_RE = /^ql-(align|indent|direction)-[a-z0-9]+$/;

const VOID_TAGS = new Set(["br", "img"]);

// Everything else is treated as a relative URL, which is safe.
const SAFE_SCHEMES = new Set(["http:", "https:", "mailto:"]);

const escapeText = (text: string): string =>
  text
    .replace(/&(?![a-zA-Z][a-zA-Z0-9]*;|#\d+;|#x[0-9a-fA-F]+;)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const escapeAttr = (value: string): string =>
  escapeText(value).replace(/"/g, "&quot;");

// Rejects javascript:, data:, vbscript: … while allowing relative URLs.
// Whitespace and control characters are stripped first because
// "java\nscript:alert(1)" is a valid URL to a browser.
const isSafeUrl = (value: string): boolean => {
  const url = value.replace(/[\u0000-\u0020]/g, "").toLowerCase();
  const scheme = /^([a-z0-9+.-]+):/.exec(url);
  return !scheme || SAFE_SCHEMES.has(scheme[1] + ":");
};

const ATTR_RE =
  /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

const buildAttributes = (allowed: string[], rawAttrs: string): string => {
  if (!allowed.length) return "";

  const kept: string[] = [];
  let hasTargetBlank = false;
  let match: RegExpExecArray | null;
  ATTR_RE.lastIndex = 0;

  while ((match = ATTR_RE.exec(rawAttrs))) {
    const name = match[1].toLowerCase();
    if (!allowed.includes(name)) continue;

    const value = match[2] ?? match[3] ?? match[4] ?? "";
    if ((name === "href" || name === "src" || name === "cite") && !isSafeUrl(value))
      continue;

    if (name === "class") {
      const classes = value.split(/\s+/).filter((c) => ALLOWED_CLASS_RE.test(c));
      if (!classes.length) continue;
      kept.push(`class="${escapeAttr(classes.join(" "))}"`);
      continue;
    }

    if (name === "target" && value !== "_blank") continue;
    if (name === "target") hasTargetBlank = true;

    kept.push(`${name}="${escapeAttr(value)}"`);
  }

  // A target="_blank" link without this hands the opened page window.opener.
  if (hasTargetBlank) kept.push('rel="noopener noreferrer"');

  return kept.length ? " " + kept.join(" ") : "";
};

// `tags` defaults to the article-body profile above; pass a different map to
// sanitise for a surface with different needs (one that may carry images, say).
export const sanitizeHtml = (
  input: string,
  tags: Record<string, string[]> = ARTICLE_TAGS
): string => {
  if (!input) return "";

  // Comments and <script>/<style> are removed with their contents; every other
  // disallowed tag only loses its markup, not its text.
  const html = input
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\s*(script|style)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*\/?\s*(script|style)\b[^>]*>/gi, "");

  const out: string[] = [];
  const open: string[] = [];
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRe.exec(html))) {
    out.push(escapeText(html.slice(cursor, match.index)));
    cursor = tagRe.lastIndex;

    const tag = match[1].toLowerCase();
    const isClosing = match[0].startsWith("</");
    if (!(tag in tags)) continue;

    if (isClosing) {
      const idx = open.lastIndexOf(tag);
      if (idx === -1) continue; // stray close tag
      while (open.length > idx) out.push(`</${open.pop()}>`);
      continue;
    }

    const attrs = buildAttributes(tags[tag], match[2].replace(/\/\s*$/, ""));

    // A link whose href was rejected, or an image whose src was, would render
    // as a dead anchor / broken image — drop the tag and keep only its text.
    if (tag === "a" && !attrs.includes('href="')) continue;
    if (tag === "img" && !attrs.includes('src="')) continue;

    if (VOID_TAGS.has(tag)) {
      out.push(`<${tag}${attrs}>`);
      continue;
    }
    open.push(tag);
    out.push(`<${tag}${attrs}>`);
  }

  out.push(escapeText(html.slice(cursor)));
  while (open.length) out.push(`</${open.pop()}>`);

  return out.join("").trim();
};

// Plain-text projection of HTML — used to derive an Excerpt when the author
// omits one, and to keep excerpts free of markup.
export const stripHtml = (input: string): string =>
  input
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

export default sanitizeHtml;
