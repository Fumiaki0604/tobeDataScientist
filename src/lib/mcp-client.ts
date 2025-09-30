// MCP機能をローカルライブラリとして直接インポート
import { QueryAnalyzer } from '../mcp-modules/query-analyzer';
import { GA4Client } from '../mcp-modules/ga4-client';
import { DataProcessor } from '../mcp-modules/data-processor';

export interface MCPToolResult {
  content: Array<{
    type: string;
    text: string;
  }>;
}

export class MCPClient {
  private queryAnalyzer: QueryAnalyzer;
  private ga4Client: GA4Client;
  private dataProcessor: DataProcessor;

  constructor(apiKey: string) {
    this.queryAnalyzer = new QueryAnalyzer(apiKey);
    this.ga4Client = new GA4Client();
    this.dataProcessor = new DataProcessor();
  }

  async callTool(toolName: string, args: any): Promise<MCPToolResult> {
    console.log(`[MCPClient] Calling tool: ${toolName}`, args);

    try {
      switch (toolName) {
        case 'analyze_ga4_query': {
          const { question, propertyId } = args;
          const analysis = await this.queryAnalyzer.analyzeQuery(question, propertyId);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(analysis, null, 2),
              },
            ],
          };
        }

        case 'fetch_ga4_data': {
          const data = await this.ga4Client.fetchAnalyticsData(args);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(data, null, 2),
              },
            ],
          };
        }

        case 'process_ga4_data': {
          const { data, question, analysisType } = args;
          const result = await this.dataProcessor.processData(data, question, analysisType);

          return {
            content: [
              {
                type: 'text',
                text: result,
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      console.error(`[MCPClient] Tool call failed:`, error);
      throw error;
    }
  }
}

// シングルトンインスタンスは使わず、毎回新しいインスタンスを作成
export function getMCPClient(apiKey: string): MCPClient {
  return new MCPClient(apiKey);
}