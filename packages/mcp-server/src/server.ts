import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { KickbaseApiClient } from "@kickbase-ai-manager/kickbase-api";
import { OpenLigaDbClient } from "@kickbase-ai-manager/openligadb";
import { createLogger, type Logger } from "@kickbase-ai-manager/shared";
import { KickbaseService } from "./kickbase.service.js";
import { MatchupService } from "./matchup.service.js";
import {
  registerAnalyzePlayerValueTool,
  registerAnalyzeTeamMatchupTool,
  registerGetLeagueRankingTool,
  registerGetMySquadTool,
  registerGetPlayerInfoTool,
  registerGetSquadReportTool,
  registerGetSquadValuationTool,
  registerListMarketTool,
  registerMakeOfferTool,
} from "./tools.js";

export interface KickbaseMcpServerOptions {
  cookie: string;
  leagueId: string;
  logger?: Logger;
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
      cookie: options.cookie,
      leagueId: options.leagueId,
      logger: this.logger,
    });
    const kickbaseService = new KickbaseService(apiClient);
    const matchupService = new MatchupService(new OpenLigaDbClient({ logger: this.logger }));

    this.registerTools(kickbaseService, matchupService);
  }

  private registerTools(kickbaseService: KickbaseService, matchupService: MatchupService): void {
    registerGetPlayerInfoTool(this.server, kickbaseService);
    registerListMarketTool(this.server, kickbaseService);
    registerMakeOfferTool(this.server, kickbaseService);
    registerGetMySquadTool(this.server, kickbaseService);
    registerGetLeagueRankingTool(this.server, kickbaseService);
    registerAnalyzePlayerValueTool(this.server, kickbaseService);
    registerGetSquadValuationTool(this.server, kickbaseService);
    registerGetSquadReportTool(this.server, kickbaseService);
    registerAnalyzeTeamMatchupTool(this.server, matchupService);
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.logger.info("Kickbase MCP Server running on stdio");
  }
}
