import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function createTextResponse(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}
