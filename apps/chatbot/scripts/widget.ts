// ConvoHatch widget administration. Needs DATABASE_URL (read from .env.local if present).
// Usage: npm run widget -- <command> [arguments]   (run `npm run widget -- help` for the list)

import { readFile } from "node:fs/promises";
import { getClient, listClients, setClientActive, upsertClient } from "../lib/clients.ts";
import { validateClientConfig } from "../lib/config.ts";
import { DatabaseNotConfiguredError, databaseUrl, migrate, openDb, type Db } from "../lib/db.ts";
import { emailSender, retryDueNotifications } from "../lib/notify.ts";
import { purgeExpired, retentionSettings } from "../lib/retention.ts";
import { installationSnippet, widgetBaseUrl } from "../lib/snippet.ts";

const HELP = `ConvoHatch widget administration

  migrate                      Apply database migrations
  seed                         Migrate, then load the fictional demo client (db/clients/demo-cedar-hollow.json)
  deploy:prepare               Used by the Vercel build: migrate and load the demo client when a
                               PostgreSQL DATABASE_URL (or POSTGRES_URL) is set; skip otherwise
  client:upsert <file.json>    Validate a client config file and create or update that client
  client:check <file.json>     Validate a client config file without saving it
  client:list                  List clients
  client:show <publicId>       Show a client's settings
  client:snippet <publicId>    Print the installation snippet for a client
  client:disable <publicId>    Turn a client's widget off (it stops loading on their site)
  client:enable <publicId>     Turn it back on
  leads:list <publicId> [--limit N] [--full]
                               Recent service requests and their notification status
                               (contact details are hidden unless --full is given)
  notifications:retry          Send notifications that are pending or due for a retry
  purge                        Delete chats and leads past their retention period

Environment: DATABASE_URL (required), WIDGET_PUBLIC_BASE_URL (for snippets),
RESEND_API_KEY + LEAD_NOTIFY_FROM_EMAIL (for notifications:retry).`;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function loadConfigFile(file: string | undefined) {
  if (!file) fail("Give the path to a client config JSON file.");
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    fail(`Could not read ${file}: ${(error as Error).message}`);
  }
  const result = validateClientConfig(raw);
  if (!result.ok) fail(`${file} has problems:\n- ${result.errors.join("\n- ")}`);
  const placeholders = JSON.stringify(raw).match(/REPLACE[^"]*|replace-me\.example/g);
  if (placeholders && !result.config.isDemo) {
    fail(`${file} still has template placeholders, e.g. "${placeholders[0]}". Replace them with the client's approved details.`);
  }
  return result.config;
}

function snippetHelp(publicId: string): string {
  const base = widgetBaseUrl();
  return [
    installationSnippet(publicId, base),
    ...(base ? [] : ["(Set WIDGET_PUBLIC_BASE_URL to replace the placeholder host with where this app is deployed.)"]),
  ].join("\n");
}

async function withDb<T>(run: (db: Db) => Promise<T>): Promise<T> {
  let db: Db;
  try {
    db = await openDb();
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      fail("DATABASE_URL is not set. For local development, add DATABASE_URL=pglite:./.data/pglite to .env.local.");
    }
    throw error;
  }
  try {
    return await run(db);
  } finally {
    await db.close();
  }
}

function loadEnvLocal() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // No .env.local: use the environment as is.
  }
}

async function main() {
  loadEnvLocal();
  const [command, ...args] = process.argv.slice(2);
  const deps = (db: Db) => ({ db, ai: null, email: emailSender(), now: () => new Date() });

  switch (command) {
    case "migrate":
      await withDb(async (db) => {
        const applied = await migrate(db);
        console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Database is up to date.");
      });
      return;

    case "seed":
      await withDb(async (db) => {
        await migrate(db);
        const config = await loadConfigFile("db/clients/demo-cedar-hollow.json");
        const client = await upsertClient(db, config);
        console.log(`Demo client ready: ${client.publicId} (${client.businessName})`);
        console.log("It's a demo: requests are never emailed to a contractor. Set WIDGET_DEMO_NOTIFY_TO to email them to your own test inbox.");
        console.log(`Allowed websites: ${client.allowedOrigins.join(", ")}`);
        console.log(`\nInstallation snippet:\n${snippetHelp(client.publicId)}`);
      });
      return;

    case "deploy:prepare": {
      // Runs before every Vercel build, so a newly connected database is set up without any
      // manual commands. Without a database the build continues and the widget reports itself
      // as unavailable.
      const url = databaseUrl();
      if (!/^postgres(ql)?:\/\//i.test(url)) {
        console.log("deploy:prepare: no PostgreSQL DATABASE_URL set; skipping database setup.");
        return;
      }
      await withDb(async (db) => {
        const applied = await migrate(db);
        console.log(`deploy:prepare: ${applied.length ? `applied ${applied.join(", ")}` : "database is up to date"}.`);
        const client = await upsertClient(db, await loadConfigFile("db/clients/demo-cedar-hollow.json"));
        console.log(`deploy:prepare: demo client ${client.publicId} is ready.`);
      });
      return;
    }

    case "client:check": {
      const config = await loadConfigFile(args[0]);
      console.log(`${args[0]} is valid (${config.publicId}).`);
      return;
    }

    case "client:upsert":
      await withDb(async (db) => {
        const config = await loadConfigFile(args[0]);
        const existing = await getClient(db, config.publicId);
        const client = await upsertClient(db, config);
        console.log(`${existing ? "Updated" : "Created"} ${client.publicId} (${client.businessName}).`);
        if (client.isDemo) console.log("Demo client: requests go only to WIDGET_DEMO_NOTIFY_TO (if set), never to a contractor.");
        console.log(`\nInstallation snippet:\n${snippetHelp(client.publicId)}`);
      });
      return;

    case "client:list":
      await withDb(async (db) => {
        const clients = await listClients(db);
        if (clients.length === 0) console.log("No clients yet. Run `npm run widget -- seed` or `client:upsert`.");
        for (const client of clients) {
          const flags = [client.active ? "active" : "disabled", client.isDemo ? "demo" : null].filter(Boolean).join(", ");
          console.log(`${client.publicId}  ${client.businessName}  [${flags}]`);
        }
      });
      return;

    case "client:show":
      await withDb(async (db) => {
        const client = await getClient(db, args[0] ?? "");
        if (!client) fail(`No client with public ID "${args[0]}".`);
        console.log(JSON.stringify({ ...client, id: undefined }, null, 2));
        if (!client.isDemo && !emailSender()) {
          console.log("\nWarning: no email provider is configured here (RESEND_API_KEY + LEAD_NOTIFY_FROM_EMAIL, or WIDGET_EMAIL_PROVIDER=outbox), so lead emails can't be sent.");
        }
      });
      return;

    case "client:snippet":
      await withDb(async (db) => {
        const client = await getClient(db, args[0] ?? "");
        if (!client) fail(`No client with public ID "${args[0]}".`);
        console.log(snippetHelp(client.publicId));
      });
      return;

    case "client:disable":
    case "client:enable":
      await withDb(async (db) => {
        const active = command === "client:enable";
        if (!(await setClientActive(db, args[0] ?? "", active))) fail(`No client with public ID "${args[0]}".`);
        console.log(`${args[0]} is now ${active ? "enabled" : "disabled"}.`);
      });
      return;

    case "leads:list":
      await withDb(async (db) => {
        const client = await getClient(db, args[0] ?? "");
        if (!client) fail(`No client with public ID "${args[0]}".`);
        const limitIndex = args.indexOf("--limit");
        const limit = limitIndex >= 0 ? Math.min(Number(args[limitIndex + 1]) || 20, 500) : 20;
        const full = args.includes("--full");
        const rows = await db.query<Record<string, unknown>>(
          `SELECT l.reference, l.created_at, l.name, l.email, l.phone, l.zip, l.in_service_area, l.service,
                  l.preferred_time, l.time_zone, n.status, n.attempts, n.last_error
           FROM leads l LEFT JOIN lead_notifications n ON n.lead_id = l.id
           WHERE l.client_id = $1 ORDER BY l.created_at DESC LIMIT $2`,
          [client.id, limit],
        );
        if (rows.length === 0) console.log("No service requests yet.");
        for (const row of rows) {
          const who = full ? `${row.name} | ${row.phone ?? "-"} | ${row.email ?? "-"}` : "(contact hidden; use --full)";
          console.log(
            `${row.reference}  ${new Date(row.created_at as string).toISOString()}  ZIP ${row.zip}${row.in_service_area ? "" : " (outside area)"}  ${row.service}  ${who}  notification: ${row.status}${row.last_error ? ` (${row.last_error}, ${row.attempts} attempts)` : ""}`,
          );
        }
      });
      return;

    case "notifications:retry":
      await withDb(async (db) => {
        const summary = await retryDueNotifications(deps(db), 100);
        console.log(JSON.stringify(summary));
        if (summary.not_configured) console.log("Email isn't configured: set RESEND_API_KEY and LEAD_NOTIFY_FROM_EMAIL (or WIDGET_EMAIL_PROVIDER=outbox locally).");
      });
      return;

    case "purge":
      await withDb(async (db) => {
        const result = await purgeExpired(db);
        const settings = retentionSettings();
        console.log(
          `Deleted ${result.conversations} chats older than ${settings.conversationDays} days, ${result.leads} leads older than ${settings.leadDays} days, and ${result.counters} expired counters.`,
        );
      });
      return;

    case undefined:
    case "help":
    case "--help":
      console.log(HELP);
      return;

    default:
      fail(`Unknown command "${command}".\n\n${HELP}`);
  }
}

await main();
