#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { GA4Client } from './ga4-client.js';

// ツール入力スキーマ定義
const FetchGA4DataSchema = z.object({
  propertyId: z.string().describe('GA4プロパティID'),
  startDate: z.string().describe('開始日 (YYYY-MM-DD)'),
  endDate: z.string().describe('終了日 (YYYY-MM-DD)'),
  metrics: z.array(z.string()).describe('取得するメトリクス'),
  dimensions: z.array(z.string()).describe('取得するディメンション'),
  accessToken: z.string().describe('OAuth2アクセストークン'),
});

class GA4MCPServer {
  private server: Server;
  private ga4Client: GA4Client;

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

    this.ga4Client = new GA4Client();

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    // ツール一覧の定義
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'fetch_ga4_data',
            description: `Google Analytics 4 (GA4) からデータを取得します。

【利用可能なメトリクス】
- totalRevenue: 総収益
- screenPageViews: ページビュー数
- activeUsers: アクティブユーザー数
- sessions: セッション数
- transactions: トランザクション数
- itemRevenue: 商品売上
- itemsViewed: 商品閲覧数
- itemsPurchased: 購入商品数

【利用可能なディメンション】
- date: 日付（トレンド分析に使用）
- deviceCategory: デバイスカテゴリ
- pagePath: ページパス
- pageTitle: ページタイトル
- sessionSource: セッションソース
- sessionDefaultChannelGrouping: デフォルトチャネルグループ
- itemName: 商品名（商品分析に必須）
- itemCategory: 商品カテゴリ

【使用例】
- 特定日の商品別売上ランキング: metrics=['itemRevenue'], dimensions=['itemName'], startDate='2025-09-27', endDate='2025-09-27'
- 月間のページビュー推移: metrics=['screenPageViews'], dimensions=['date'], startDate='2025-09-01', endDate='2025-09-30'
- デバイス別売上: metrics=['totalRevenue'], dimensions=['deviceCategory']`,
            inputSchema: {
              type: 'object',
              properties: {
                propertyId: { type: 'string', description: 'GA4プロパティID' },
                startDate: { type: 'string', description: '開始日 (YYYY-MM-DD形式)' },
                endDate: { type: 'string', description: '終了日 (YYYY-MM-DD形式)' },
                metrics: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '取得するメトリクス（例: ["totalRevenue"], ["itemRevenue"]）'
                },
                dimensions: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '取得するディメンション（例: ["itemName"], ["date", "deviceCategory"]）'
                },
                accessToken: { type: 'string', description: 'OAuth2アクセストークン' },
              },
              required: ['propertyId', 'startDate', 'endDate', 'metrics', 'accessToken'],
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