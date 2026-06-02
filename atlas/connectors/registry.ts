import { type ConnectorDefinition } from "./types";

// Source → connector. Populated by connectors/index.ts at import time.
const REGISTRY = new Map<string, ConnectorDefinition>();

/**
 * Register a connector. Call once per connector (connectors/index.ts wires them
 * all). Identity helper — keeps author files declarative and typed.
 */
export function defineConnector<Raw = any>(
  def: ConnectorDefinition<Raw>
): ConnectorDefinition<Raw> {
  if (REGISTRY.has(def.source)) {
    throw new Error(`connector already registered for source "${def.source}"`);
  }
  REGISTRY.set(def.source, def as ConnectorDefinition);
  return def;
}

export function getConnector(source: string): ConnectorDefinition | undefined {
  return REGISTRY.get(source);
}

export function listConnectors(): ConnectorDefinition[] {
  return [...REGISTRY.values()];
}
