// Server-only: reads and writes client configurations.

import type { ClientConfig, ClientLimits, ClientProfile, StoredClient } from "./config.ts";
import type { Db } from "./db.ts";

interface ClientRow {
  id: string;
  public_id: string;
  business_name: string;
  is_demo: boolean;
  active: boolean;
  profile: ClientProfile | string;
  service_zip_codes: string[];
  lead_destination_emails: string[];
  allowed_origins: string[];
  limits: ClientLimits | string;
}

const COLUMNS = `id, public_id, business_name, is_demo, active, profile, service_zip_codes,
  lead_destination_emails, allowed_origins, limits`;

function json<T>(value: T | string): T {
  return typeof value === "string" ? (JSON.parse(value) as T) : value;
}

function fromRow(row: ClientRow): StoredClient {
  return {
    id: row.id,
    publicId: row.public_id,
    businessName: row.business_name,
    isDemo: row.is_demo,
    active: row.active,
    profile: json(row.profile),
    serviceZipCodes: row.service_zip_codes ?? [],
    leadDestinationEmails: row.lead_destination_emails ?? [],
    allowedOrigins: row.allowed_origins ?? [],
    limits: json(row.limits) ?? {},
  };
}

/** Active client for a public ID, or null. Inactive clients look the same as unknown ones. */
export async function getActiveClient(db: Db, publicId: string): Promise<StoredClient | null> {
  if (typeof publicId !== "string" || publicId.length > 63) return null;
  const rows = await db.query<ClientRow>(`SELECT ${COLUMNS} FROM clients WHERE public_id = $1 AND active`, [publicId]);
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function getClient(db: Db, publicId: string): Promise<StoredClient | null> {
  const rows = await db.query<ClientRow>(`SELECT ${COLUMNS} FROM clients WHERE public_id = $1`, [publicId]);
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function listClients(db: Db): Promise<StoredClient[]> {
  return (await db.query<ClientRow>(`SELECT ${COLUMNS} FROM clients ORDER BY public_id`)).map(fromRow);
}

/** Creates or replaces a client's configuration, keyed by public ID. */
export async function upsertClient(db: Db, config: ClientConfig): Promise<StoredClient> {
  const rows = await db.query<ClientRow>(
    `INSERT INTO clients (public_id, business_name, is_demo, active, profile, service_zip_codes,
       lead_destination_emails, allowed_origins, limits)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::text[], $7::text[], $8::text[], $9::jsonb)
     ON CONFLICT (public_id) DO UPDATE SET
       business_name = EXCLUDED.business_name,
       is_demo = EXCLUDED.is_demo,
       active = EXCLUDED.active,
       profile = EXCLUDED.profile,
       service_zip_codes = EXCLUDED.service_zip_codes,
       lead_destination_emails = EXCLUDED.lead_destination_emails,
       allowed_origins = EXCLUDED.allowed_origins,
       limits = EXCLUDED.limits,
       updated_at = now()
     RETURNING ${COLUMNS}`,
    [
      config.publicId,
      config.businessName,
      config.isDemo,
      config.active,
      JSON.stringify(config.profile),
      config.serviceZipCodes,
      config.leadDestinationEmails,
      config.allowedOrigins,
      JSON.stringify(config.limits),
    ],
  );
  return fromRow(rows[0]);
}

export async function setClientActive(db: Db, publicId: string, active: boolean): Promise<boolean> {
  const rows = await db.query(`UPDATE clients SET active = $2, updated_at = now() WHERE public_id = $1 RETURNING id`, [
    publicId,
    active,
  ]);
  return rows.length > 0;
}
