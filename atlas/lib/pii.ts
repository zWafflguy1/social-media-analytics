// Edge redaction — runs BEFORE any event body is persisted. Conservative by
// design: better to over-redact than to store a card number. Replace with a
// dedicated PII service (e.g. Presidio) at scale; the interface stays the same.

interface Rule {
  label: string;
  re: RegExp;
}

const RULES: Rule[] = [
  { label: "SSN", re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { label: "CARD", re: /\b(?:\d[ -]*?){13,16}\b/g },
  { label: "EMAIL", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { label: "PHONE", re: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
  // generic secrets / keys
  { label: "SECRET", re: /\b(?:sk|pk|api|key|token)[-_][A-Za-z0-9]{16,}\b/gi },
];

export interface RedactionResult {
  text: string;
  found: Record<string, number>;
}

export function redact(input: string | undefined | null): RedactionResult {
  const found: Record<string, number> = {};
  let text = input ?? "";
  for (const rule of RULES) {
    text = text.replace(rule.re, () => {
      found[rule.label] = (found[rule.label] ?? 0) + 1;
      return `[${rule.label}_REDACTED]`;
    });
  }
  return { text, found };
}
