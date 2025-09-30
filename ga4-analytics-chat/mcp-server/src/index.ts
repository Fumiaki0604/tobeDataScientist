#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { QueryAnalyzer } from './query-analyzer.js';
import { GA4Client } from './ga4-client.js';
import { DataProcessor } from './data-processor.js';

// ツール入力スキーマ定義
const AnalyzeQuerySchema = z.object({
  question: z.string().describe('ユーザーの質問'),
  propertyId: z.string().describe('GA4プロパティID'),
});

const FetchGA4DataSchema = z.object({
  propertyId: z.string().describe('GA4プロパティID'),
  startDate: z.string().describe('開始日 (YYYY-MM-DD)'),
  endDate: z.string().describe('終了日 (YYYY-MM-DD)'),
  metrics: z.array(z.string()).describe('取得するメトリクス'),
  dimensions: z.array(z.string()).describe('取得するディメンション'),
  accessToken: z.string().describe('OAuth2アクセストークン'),
});

const ProcessDataSchema = z.object({
  data: z.any().describe('GA4レスポンスデータ'),
  question: z.string().describe('元の質問'),
  analysisType: z.string().describe('分析タイプ'),
});

class GA4MCPServer {
  private server: Server;
  private queryAnalyzer: QueryAnalyzer;
  private ga4Client: GA4Client;
  private dataProcessor: DataProcessor;

  constructor() {
    this.server = new Server(
      {
        name: 'ga4-analytics-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.queryAnalyzer = new QueryAnalyzer();
    this.ga4Client = new GA4Client();
    this.dataProcessor = new DataProcessor();

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    // ツール一覧の定義
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'analyze_ga4_query',
            description: 'GA4関連の質問を解析して適切なデータ取得パラメータを決定する',
            inputSchema: {
              type: 'object',
              properties: {
                question: {
                  type: 'string',
                  description: 'ユーザーの質問',
                },
                propertyId: {
                  type: 'string',
                  description: 'GA4プロパティID',
                },
              },
              required: ['question', 'propertyId'],
            },
          },
          {
            name: 'fetch_ga4_data',
            description: 'GA4 APIからデータを取得する',
            inputSchema: {
              type: 'object',
              properties: {
                propertyId: { type: 'string', description: 'GA4プロパティID' },
                startDate: { type: 'string', description: '開始日 (YYYY-MM-DD)' },
                endDate: { type: 'string', description: '終了日 (YYYY-MM-DD)' },
                metrics: { type: 'array', items: { type: 'string' }, description: '取得するメトリクス' },
                dimensions: { type: 'array', items: { type: 'string' }, description: '取得するディメンション' },
                accessToken: { type: 'string', description: 'OAuth2アクセストークン' },
              },
              required: ['propertyId', 'startDate', 'endDate', 'metrics', 'accessToken'],
            },
          },
          {
            name: 'process_ga4_data',
            description: '取得したGA4データを処理・分析して回答を生成する',
            inputSchema: {
              type: 'object',
              properties: {
                data: { type: 'object', description: 'GA4レスポンスデータ' },
                question: { type: 'string', description: '元の質問' },
                analysisType: { type: 'string', description: '分析タイプ' },
              },
              required: ['data', 'question', 'analysisType'],
            },
          },
        ] satisfies Tool[],
      };
    });

    // ツール実行ハンドラー
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'analyze_ga4_query': {
            const { question, propertyId } = AnalyzeQuerySchema.parse(args);
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
            const params = FetchGA4DataSchema.parse(args);
            const data = await this.ga4Client.fetchAnalyticsData(params);

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
            const { data, question, analysisType } = ProcessDataSchema.parse(args);
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
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('GA4 MCP Server running on stdio');
  }
}

// サーバー起動
const server = new GA4MCPServer();
server.run().catch(console.error);