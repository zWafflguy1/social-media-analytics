/**
 * Connector registration. Importing this module registers every connector.
 * To add an integration: create your connector file (see template.ts) and add
 * one import line here. Nothing else changes — routes, catalog, sync, and the
 * webhook endpoint all pick it up automatically.
 */
import "./email";
import "./call";
// import "./template"; // ← copy template.ts and register your connector here

export { listConnectors, getConnector } from "./registry";
