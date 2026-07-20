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

/**
 * Repairs JSON truncated mid-stream (a real Gemini 3 failure mode: STOP
 * with the closing brace missing): closes any dangling string, trims a
 * trailing comma or dangling key, then appends the unclosed brackets.
 */
function repairTruncated(text: string): string | null {
  const start = text.search(/[[{]/);
  if (start < 0) return null;
  let candidate = text.slice(start).trim();
  const stack: string[] = [];
  let inString = false;
  for (let i = 0; i < candidate.length; i += 1) {
    const char = candidate[i];
    if (inString) {
      if (char === "\\") i += 1;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") stack.push("}");
    else if (char === "[") stack.push("]");
    else if (char === "}" || char === "]") stack.pop();
  }
  if (stack.length === 0 && !inString) return null; // nothing to repair
  if (inString) candidate += '"';
  candidate = candidate.replace(/,\s*$/, "").replace(/:\s*$/, ": null");
  return candidate + stack.reverse().join("");
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
  const repaired = repairTruncated(text);
  if (repaired) candidates.push(repaired);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate.trim()) as T;
    } catch {
      /* try the next shape */
    }
  }
  return null;
}
