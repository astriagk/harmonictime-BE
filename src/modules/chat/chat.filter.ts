// Patterns that could enable off-platform contact between buyers and sellers.
const RULES: { pattern: RegExp; label: string }[] = [
  // Email addresses
  {
    pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
    label: "email",
  },

  // Phone numbers — at least 7 digits, optional country code / separators
  {
    pattern: /(\+?\d[\d\s\-().]{5,}\d)/g,
    label: "phone",
  },

  // Any http / https URL
  {
    pattern: /https?:\/\/[^\s]+/gi,
    label: "url-http",
  },

  // www. links (no protocol)
  {
    pattern: /www\.[a-zA-Z0-9\-]+\.[a-zA-Z]{2,}[^\s]*/gi,
    label: "url-www",
  },

  // Bare short-domain links commonly used to share contact / group invites
  {
    pattern: /\b(wa\.me|t\.me|discord\.gg|zoom\.us|meet\.google\.com|teams\.live\.com|skype:[^\s]+)[^\s]*/gi,
    label: "url-bare",
  },

  // @handles — Instagram, Telegram, Twitter, Snapchat, etc.
  {
    pattern: /@[\w.]{2,}/g,
    label: "handle",
  },
];

const MASK = "****";

export function maskSensitiveContent(text: string): string {
  let result = text;
  for (const { pattern } of RULES) {
    // Reset lastIndex between calls since patterns are reused with /g flag.
    pattern.lastIndex = 0;
    result = result.replace(pattern, MASK);
  }
  return result;
}
