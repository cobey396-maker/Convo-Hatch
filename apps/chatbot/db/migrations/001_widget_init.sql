-- ConvoHatch hosted widget: clients, conversations, leads, notifications, and usage counters.
-- Applied by `npm run widget -- migrate`. Migrations are append-only: add a new numbered file
-- instead of editing this one after it has run anywhere.

CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Public identifier used in the installation snippet. Not a secret.
  public_id text NOT NULL UNIQUE CHECK (public_id ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
  business_name text NOT NULL,
  -- Demo clients never send lead notifications to anyone.
  is_demo boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  -- Approved, visitor-facing business information: branding, services, FAQs, hours, contact.
  profile jsonb NOT NULL,
  service_zip_codes text[] NOT NULL DEFAULT '{}',
  -- Private settings: never sent to the browser or the AI model.
  lead_destination_emails text[] NOT NULL DEFAULT '{}',
  allowed_origins text[] NOT NULL DEFAULT '{}',
  -- Optional per-client overrides of the usage caps (see lib/widget/limits.ts).
  limits jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE conversations (
  -- Random UUID handed to the widget; every lookup also filters by client_id.
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  visitor_message_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conversations_client_created_idx ON conversations (client_id, created_at);
CREATE INDEX conversations_last_message_idx ON conversations (last_message_at);

CREATE TABLE conversation_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  -- Visitor text is stored with email addresses and phone numbers redacted.
  content text NOT NULL,
  -- Where an assistant reply came from: ai, faq, rule, or limit.
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conversation_messages_conversation_idx ON conversation_messages (conversation_id, id);

CREATE TABLE leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  -- Short code shown to the visitor and in the notification email.
  reference text NOT NULL UNIQUE,
  -- Sent by the widget with each submission; a retried submission returns the original lead.
  idempotency_key text NOT NULL,
  -- Hash of the contact details, ZIP, and service plus the UTC day; blocks same-day resubmissions.
  dedupe_key text NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  zip text NOT NULL,
  in_service_area boolean NOT NULL,
  service text NOT NULL,
  details text,
  preferred_time text NOT NULL,
  time_zone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR phone IS NOT NULL),
  UNIQUE (client_id, idempotency_key),
  UNIQUE (client_id, dedupe_key)
);
CREATE INDEX leads_client_created_idx ON leads (client_id, created_at);

CREATE TABLE lead_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL UNIQUE REFERENCES leads(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'email',
  -- pending: not sent yet (or email isn't configured); sending: an attempt is in progress;
  -- accepted: the email provider accepted the message (not proof of delivery);
  -- failed: last attempt failed, will retry; gave_up: retries exhausted;
  -- suppressed_demo: demo client, intentionally never sent.
  status text NOT NULL CHECK (status IN ('pending', 'sending', 'accepted', 'failed', 'gave_up', 'suppressed_demo')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  locked_until timestamptz,
  last_error text,
  provider_message_id text,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lead_notifications_due_idx ON lead_notifications (status, next_attempt_at);

-- Fixed-window counters shared by every server instance: rate limits and daily usage caps.
CREATE TABLE usage_counters (
  scope text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL,
  PRIMARY KEY (scope, window_start)
);
CREATE INDEX usage_counters_window_idx ON usage_counters (window_start);
