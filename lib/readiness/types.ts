/**
 * Domain types for the readiness system (rd_* tables in Supabase).
 *
 * These are hand-maintained to keep the operator console code typed without
 * depending on the parked marketplace types in lib/supabase/types.ts. If the
 * schema changes, update the migration AND this file together.
 */

export type AssetStatus = "in_yard" | "checked_out" | "in_repair" | "retired";
export type AlertType = "cert_expiring" | "cert_expired" | "asset_overdue" | "asset_missing" | "reconcile_due";
export type AlertStatus = "pending" | "sent" | "dismissed" | "snoozed";
export type MessageDirection = "outbound" | "inbound";

export interface Shop {
  id: string;
  code: string;
  name: string;
  primary_contact_name: string | null;
  primary_contact_phone: string | null;
  billing_tier: string | null;
  timezone: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
export type NewShop = Pick<Shop, "code" | "name"> & Partial<Pick<Shop, "primary_contact_name" | "primary_contact_phone" | "billing_tier" | "timezone" | "notes">>;

export interface Yard {
  id: string;
  shop_id: string;
  name: string;
  address: string | null;
  created_at: string;
  updated_at: string;
}

export interface Person {
  id: string;
  shop_id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: string;
  shop_id: string;
  yard_id: string | null;
  asset_code: string;
  asset_type: string;
  description: string | null;
  serial_number: string | null;
  status: AssetStatus;
  last_reconciled_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
export type NewAsset = Pick<Asset, "shop_id" | "asset_code" | "asset_type"> &
  Partial<Pick<Asset, "yard_id" | "description" | "serial_number" | "status" | "notes">>;

export interface AssetCert {
  id: string;
  asset_id: string;
  cert_type: string;
  issued_at: string | null;
  expires_at: string | null;
  document_path: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
export type NewAssetCert = Pick<AssetCert, "asset_id" | "cert_type"> &
  Partial<Pick<AssetCert, "issued_at" | "expires_at" | "document_path" | "notes">>;

export interface PersonCert {
  id: string;
  person_id: string;
  cert_type: string;
  issued_at: string | null;
  expires_at: string | null;
  document_path: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Checkout {
  id: string;
  asset_id: string;
  shop_id: string;
  taken_by_person_id: string | null;
  taken_by_name: string | null;
  out_at: string;
  expected_return_at: string | null;
  returned_at: string | null;
  job_ref: string | null;
  notes: string | null;
  created_at: string;
}

export interface Alert {
  id: string;
  shop_id: string;
  alert_type: AlertType;
  asset_cert_id: string | null;
  person_cert_id: string | null;
  asset_id: string | null;
  due_at: string | null;
  dedup_key: string;
  to_phone: string | null;
  message: string;
  status: AlertStatus;
  generated_at: string;
  sent_at: string | null;
  sent_by: string | null;
  dismissed_at: string | null;
  dismissed_reason: string | null;
  snoozed_until: string | null;
}

export interface ShopMessage {
  id: string;
  shop_id: string | null;
  person_id: string | null;
  direction: MessageDirection;
  phone: string;
  body: string;
  alert_id: string | null;
  twilio_sid: string | null;
  occurred_at: string;
}

export interface AuditLogEntry {
  id: string;
  shop_id: string | null;
  actor: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: unknown;
  occurred_at: string;
}
