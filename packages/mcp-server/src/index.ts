#!/usr/bin/env node
import { loadEnv } from "@kickbase-ai-manager/shared";
import { KickbaseMcpServer } from "./server.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const server = new KickbaseMcpServer({
    token: env.KB_TOKEN,
    leagueId: env.LEAGUE_ID,
    enableBaseXi: env.ENABLE_BASEXI,
  });
  await server.start();
}

main().catch((error: unknown) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
