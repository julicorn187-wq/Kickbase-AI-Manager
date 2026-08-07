import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { KickbaseApiClient } from "@kickbase-ai-manager/kickbase-api";
import { createLogger, type Logger } from "@kickbase-ai-manager/shared";
import { KickbaseService } from "./kickbase.service.js";
import {
  registerGetLeagueRankingTool,
  registerGetMySquadTool,
  registerGetPlayerInfoTool,
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

    this.registerTools(kickbaseService);
  }

  private registerTools(kickbaseService: KickbaseService): void {
    registerGetPlayerInfoTool(this.server, kickbaseService);
    registerListMarketTool(this.server, kickbaseService);
    registerMakeOfferTool(this.server, kickbaseService);
    registerGetMySquadTool(this.server, kickbaseService);
    registerGetLeagueRankingTool(this.server, kickbaseService);
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.logger.info("Kickbase MCP Server running on stdio");
  }
}
