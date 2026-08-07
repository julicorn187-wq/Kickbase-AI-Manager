import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { BaseXiClient } from "@kickbase-ai-manager/basexi";
import { KickbaseApiClient } from "@kickbase-ai-manager/kickbase-api";
import { OpenLigaDbClient } from "@kickbase-ai-manager/openligadb";
import { createLogger, type Logger } from "@kickbase-ai-manager/shared";
import { BaseXiService } from "./basexi.service.js";
import { KickbaseService } from "./kickbase.service.js";
import { MatchupService } from "./matchup.service.js";
import {
  registerAnalyzePlayerMatchupTool,
  registerAnalyzePlayerValueTool,
  registerAnalyzeTeamMatchupTool,
  registerGetBaseXiPlayerSnapshotTool,
  registerGetLeagueRankingTool,
  registerGetMySquadTool,
  registerGetPlayerInfoTool,
  registerGetSquadReportTool,
  registerGetSquadValuationTool,
  registerListMarketTool,
  registerMakeOfferTool,
} from "./tools.js";

export interface KickbaseMcpServerOptions {
  token: string;
  leagueId: string;
  logger?: Logger;
  /**
   * Opt-in for the BaseXI integration (packages/basexi). Off by default — see
   * CLAUDE.md's "External data sources" section: base-xi.de's own robots.txt
   * disallows /api/, so this is never enabled unless a maintainer explicitly
   * opts in for their own personal use via the ENABLE_BASEXI env var.
   */
  enableBaseXi?: boolean;
}

export class KickbaseMcpServer {
  private readonly server: McpServer;
  private readonly logger: Logger;

  constructor(options: KickbaseMcpServerOptions) {
    this.logger = options.logger ?? createLogger();
    this.server = new McpServer(
      { name: "kickbase-mcp", version: "0.1.0" },
      { capabilities: { resources: {}, tools: {} } },
    );

    const apiClient = new KickbaseApiClient({
      token: options.token,
      leagueId: options.leagueId,
      logger: this.logger,
    });
    const kickbaseService = new KickbaseService(apiClient);
    const matchupService = new MatchupService(new OpenLigaDbClient({ logger: this.logger }));
    const baseXiService = options.enableBaseXi
      ? new BaseXiService(new BaseXiClient({ logger: this.logger }))
      : undefined;

    if (options.enableBaseXi) {
      this.logger.warn(
        "BaseXI integration enabled (ENABLE_BASEXI=true) — base-xi.de's robots.txt disallows " +
          "automated /api/ access; this is a deliberate, informed opt-in, not a default.",
      );
    }

    this.registerTools(kickbaseService, matchupService, baseXiService);
  }

  private registerTools(
    kickbaseService: KickbaseService,
    matchupService: MatchupService,
    baseXiService: BaseXiService | undefined,
  ): void {
    registerGetPlayerInfoTool(this.server, kickbaseService);
    registerListMarketTool(this.server, kickbaseService);
    registerMakeOfferTool(this.server, kickbaseService);
    registerGetMySquadTool(this.server, kickbaseService);
    registerGetLeagueRankingTool(this.server, kickbaseService);
    registerAnalyzePlayerValueTool(this.server, kickbaseService);
    registerGetSquadValuationTool(this.server, kickbaseService);
    registerGetSquadReportTool(this.server, kickbaseService);
    registerAnalyzeTeamMatchupTool(this.server, matchupService);
    registerAnalyzePlayerMatchupTool(this.server, kickbaseService, matchupService);
    if (baseXiService) {
      registerGetBaseXiPlayerSnapshotTool(this.server, baseXiService);
    }
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.logger.info("Kickbase MCP Server running on stdio");
  }
}
