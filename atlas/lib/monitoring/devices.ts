import { createHash, randomBytes } from "node:crypto";
import { nanoid } from "nanoid";
import { query, queryOne } from "../db";
import { audit } from "../audit";

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export interface EnrollResult {
  deviceId: string;
  agentKey: string; // shown ONCE; only the hash is stored
}

/**
 * Enroll a work computer for an employee. Returns a one-time agent key the
 * desktop agent stores and presents on every activity report.
 */
export async function enrollDevice(
  tenantId: string,
  employeeId: string,
  label: string
): Promise<EnrollResult> {
  const deviceId = `dev_${nanoid(14)}`;
  const agentKey = `ak_${randomBytes(24).toString("hex")}`;
  await query(
    `INSERT INTO devices (id, tenant_id, employee_id, label, agent_key_hash)
     VALUES ($1,$2,$3,$4,$5)`,
    [deviceId, tenantId, employeeId, label, hashKey(agentKey)]
  );
  await audit(tenantId, "user", "device.enrolled", deviceId, { employeeId, label });
  return { deviceId, agentKey };
}

export interface AuthedDevice {
  tenantId: string;
  deviceId: string;
  employeeId: string;
}

/**
 * Authenticate an agent by device id + key. Also confirms the device is active.
 * Does NOT check consent — that's enforced separately in activity ingestion.
 */
export async function authenticateDevice(
  deviceId: string,
  agentKey: string
): Promise<AuthedDevice | null> {
  const row = await queryOne<{
    tenant_id: string;
    employee_id: string;
    agent_key_hash: string;
    status: string;
  }>(`SELECT tenant_id, employee_id, agent_key_hash, status FROM devices WHERE id=$1`, [deviceId]);
  if (!row || row.status !== "active") return null;
  if (row.agent_key_hash !== hashKey(agentKey)) return null;
  await query(`UPDATE devices SET last_seen_at=now() WHERE id=$1`, [deviceId]);
  return { tenantId: row.tenant_id, deviceId, employeeId: row.employee_id };
}

export async function revokeDevice(tenantId: string, deviceId: string): Promise<void> {
  await query(`UPDATE devices SET status='revoked' WHERE tenant_id=$1 AND id=$2`, [
    tenantId,
    deviceId,
  ]);
  await audit(tenantId, "user", "device.revoked", deviceId);
}
