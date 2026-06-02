"use client";

// In production the tenant comes from the authenticated session. For this
// foundation/demo the active tenant is selectable and defaults to the seed tenant.
export const ACTIVE_TENANT =
  (typeof window !== "undefined" && localStorage.getItem("atlas_tenant")) || "tnt_demo";

export async function api<T = any>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-atlas-tenant": ACTIVE_TENANT,
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `request failed: ${res.status}`);
  }
  return res.json();
}
