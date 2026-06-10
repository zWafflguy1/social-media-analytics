import { config } from "../config.js";
import type { CrawledPage } from "./crawler.js";
import type { AuditFinding } from "../store/db.js";

/**
 * Deterministic on-page SEO/AEO audit rules. These catch the mechanical
 * issues; the Claude orchestrator handles the judgment calls (content
 * strategy, schema design, intent coverage).
 */
export function auditPages(pages: CrawledPage[]): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const city = config.market.split(",")[0].trim();
  const titles = new Map<string, string[]>();

  for (const p of pages) {
    const add = (severity: AuditFinding["severity"], rule: string, detail: string) =>
      findings.push({ page: p.path, severity, rule, detail });

    if (p.status === 0) {
      add("critical", "fetch-failed", p.textSample || "Page could not be fetched.");
      continue;
    }
    if (p.status >= 400) {
      add("critical", "http-error", `Returned HTTP ${p.status}.`);
      continue;
    }

    if (!p.title) add("critical", "missing-title", "Page has no <title>.");
    else {
      if (p.title.length > 60)
        add("warning", "title-too-long", `Title is ${p.title.length} chars (target ≤ 60): "${p.title}"`);
      titles.set(p.title, [...(titles.get(p.title) || []), p.path]);
    }

    if (!p.metaDescription)
      add("warning", "missing-meta-description", "No meta description — SERP snippet will be auto-generated.");
    else if (p.metaDescription.length > 160)
      add("info", "meta-description-too-long", `${p.metaDescription.length} chars (target ≤ 160).`);

    if (p.h1s.length === 0) add("warning", "missing-h1", "Page has no <h1>.");
    if (p.h1s.length > 1) add("info", "multiple-h1", `${p.h1s.length} <h1> elements found.`);

    if (!p.canonical) add("info", "missing-canonical", "No canonical link.");
    if (!p.hasViewportMeta) add("critical", "missing-viewport", "No viewport meta — fails mobile-friendly checks.");
    if (p.imagesMissingAlt > 0)
      add("info", "images-missing-alt", `${p.imagesMissingAlt} image(s) without alt text.`);

    if (p.jsonLdTypes.length === 0)
      add("warning", "no-structured-data", "No JSON-LD structured data — hurts both rich results and AI-engine grounding.");
    if (p.jsonLdTypes.includes("(invalid JSON-LD)"))
      add("critical", "invalid-json-ld", "A JSON-LD block fails to parse.");

    if (p.path === "/" && !p.jsonLdTypes.some((t) => /LocalBusiness|Organization/i.test(t)))
      add("warning", "no-localbusiness-schema", "Homepage lacks LocalBusiness/Organization schema — key local SEO + AEO signal.");

    if (p.wordCount < 150)
      add("warning", "thin-content", `Only ~${p.wordCount} words — thin content rarely ranks or gets cited by AI engines.`);

    const text = (p.title + " " + p.textSample).toLowerCase();
    if (p.path === "/" && !text.includes(city.toLowerCase()))
      add("warning", "no-local-signal", `Homepage doesn't mention "${city}" — weak local relevance signal.`);

    if (Object.keys(p.ogTags).length === 0)
      add("info", "missing-og-tags", "No Open Graph tags.");
  }

  for (const [title, paths] of titles) {
    if (paths.length > 1)
      findings.push({
        page: paths.join(", "),
        severity: "warning",
        rule: "duplicate-titles",
        detail: `Duplicate title across ${paths.length} pages: "${title}"`,
      });
  }

  return findings;
}
