/**
 * Response parsing helpers — pure and unit-tested. Models sometimes wrap
 * JSON in markdown fences or prose despite instructions; be forgiving.
 */

/** The balanced {...} or [...] starting at `start`, string-aware. */
function balancedSlice(text: string, start: number): string | null {
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (char === "\\") i += 1;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === open) depth += 1;
    else if (char === close) {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

export function extractJson<T>(text: string): T | null {
  const candidates: string[] = [];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1]);
  candidates.push(text);
  const firstBrace = text.search(/[[{]/);
  if (firstBrace >= 0) {
    const balanced = balancedSlice(text, firstBrace);
    if (balanced) candidates.push(balanced);
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate.trim()) as T;
    } catch {
      /* try the next shape */
    }
  }
  return null;
}
