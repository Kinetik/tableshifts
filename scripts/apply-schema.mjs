import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

function readDotEnv(filePath) {
  if (!existsSync(filePath)) return {};
  return Object.fromEntries(
    readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1).replace(/^"|"$/g, "")];
      })
  );
}

async function main() {
  let Client;
  try {
    ({ Client } = await import("pg"));
  } catch (error) {
    console.error("The pg package is required to apply the schema.");
    console.error("Run: npx -p pg node scripts/apply-schema.mjs");
    process.exit(1);
  }

  const root = process.cwd();
  const env = { ...readDotEnv(path.join(root, ".env.local")), ...process.env };
  const rawConnectionString = env.POSTGRES_URL_NON_POOLING || env.POSTGRES_URL;
  if (!rawConnectionString) {
    console.error("POSTGRES_URL_NON_POOLING or POSTGRES_URL is missing.");
    process.exit(1);
  }
  const connectionUrl = new URL(rawConnectionString);
  connectionUrl.searchParams.delete("sslmode");

  const sql = readFileSync(path.join(root, "supabase", "schema.sql"), "utf8");
  const client = new Client({
    connectionString: connectionUrl.toString(),
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  try {
    await client.query(sql);
    console.log("TableShifts Supabase schema applied successfully.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Failed to apply TableShifts Supabase schema.");
  console.error(error.message);
  process.exit(1);
});
