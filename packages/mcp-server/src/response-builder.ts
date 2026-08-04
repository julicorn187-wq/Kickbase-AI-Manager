export interface ToolTextResponse {
  content: [{ type: "text"; text: string }];
}

export class ToolResponseBuilder {
  static createTextResponse(text: string): ToolTextResponse {
    return { content: [{ type: "text", text }] };
  }
}
