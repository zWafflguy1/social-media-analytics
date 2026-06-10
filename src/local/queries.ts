import { config } from "../config.js";

/**
 * Builds the query set the agent tracks: the searches a local prospect
 * actually types into Google or asks an AI assistant.
 */

export function serpQueries(): string[] {
  const city = config.market.split(",")[0].trim();
  const queries = new Set<string>();
  for (const service of config.services) {
    queries.add(`${service} ${city}`);
    queries.add(`${service} near me`);
    queries.add(`best ${service} in ${city}`);
  }
  return [...queries];
}

export function aeoQueries(): string[] {
  const city = config.market.split(",")[0].trim();
  const queries = new Set<string>();
  for (const service of config.services) {
    queries.add(`Who is the best ${service} provider in ${city}?`);
    queries.add(`I need ${service} in ${city} — who should I call?`);
  }
  queries.add(`What are the top-rated ${config.services[0]} companies in ${city}?`);
  return [...queries];
}
