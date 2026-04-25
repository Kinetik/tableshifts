import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const appDir = path.join(root, "legacy-app");
const distDir = path.join(root, "dist");

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

const localEnv = readDotEnv(path.join(root, ".env.local"));
const env = { ...localEnv, ...process.env };

const publicEnv = {
  SUPABASE_URL: env.SUPABASE_URL || env.tableshifts_dbSUPABASE_URL || "",
  SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.tableshifts_dbSUPABASE_ANON_KEY || env.tableshifts_dbSUPABASE_PUBLISHABLE_KEY || ""
};

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await cp(appDir, distDir, { recursive: true });
await writeFile(
  path.join(distDir, "env.js"),
  `window.TABLESHIFTS_ENV = ${JSON.stringify(publicEnv, null, 2)};\n`,
  "utf8"
);

console.log("Built TableShifts static app.");
console.log(publicEnv.SUPABASE_URL && publicEnv.SUPABASE_ANON_KEY ? "Supabase public config included." : "Supabase public config missing; app will use local mode.");
