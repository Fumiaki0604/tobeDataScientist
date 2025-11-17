import { z } from 'zod';
// GA4データ取得パラメータの型定義
export const GA4FetchParamsSchema = z.object({
    propertyId: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    metrics: z.array(z.string()),
    dimensions: z.array(z.string()).optional(),
    accessToken: z.string(),
});
export class GA4Client {
    async fetchAnalyticsData(params) {
        console.log(`[GA4Client] Fetching data for property: ${params.propertyId}`);
        const requestBody = {
            dateRanges: [
                {
                    startDate: params.startDate,
                    endDate: params.endDate,
                },
            ],
            dimensions: params.dimensions?.map(name => ({ name })) || [],
            metrics: params.metrics.map(name => ({ name })),
        };
        console.log(`[GA4Client] Request body:`, JSON.stringify(requestBody, null, 2));
        try {
            const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${params.propertyId}:runReport`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${params.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[GA4Client] API Error: ${response.status} ${errorText}`);
                throw new Error(`Analytics API error: ${response.status} ${errorText}`);
            }
            const apiResult = await response.json();
            console.log(`[GA4Client] Raw API response:`, JSON.stringify(apiResult, null, 2));
            // データを整形
            const formattedData = this.formatApiResponse(apiResult);
            console.log(`[GA4Client] Formatted data:`, JSON.stringify(formattedData, null, 2));
            return formattedData;
        }
        catch (error) {
            console.error(`[GA4Client] Error fetching data:`, error);
            throw error;
        }
    }
    formatApiResponse(apiResult) {
        if (!apiResult.rows || apiResult.rows.length === 0) {
            console.log(`[GA4Client] No data returned from API`);
            return [];
        }
        return apiResult.rows.map((row) => {
            const data = {};
            // ディメンションの値を追加
            apiResult.dimensionHeaders?.forEach((header, index) => {
                data[header.name] = row.dimensionValues?.[index]?.value || '';
            });
            // メトリクスの値を追加
            apiResult.metricHeaders?.forEach((header, index) => {
                const value = row.metricValues?.[index]?.value || '0';
                // 数値メトリクスは数値型に変換
                if (header.type === 'TYPE_INTEGER' || header.type === 'TYPE_FLOAT') {
                    data[header.name] = parseFloat(value);
                }
                else {
                    data[header.name] = parseInt(value);
                }
            });
            return data;
        });
    }
    // プロパティの検証
    async validateProperty(propertyId, accessToken) {
        try {
            const response = await fetch(`https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });
            return response.ok;
        }
        catch (error) {
            console.error(`[GA4Client] Error validating property:`, error);
            return false;
        }
    }
    // 利用可能なメトリクス一覧
    getAvailableMetrics() {
        return [
            'activeUsers',
            'sessions',
            'screenPageViews',
            'totalRevenue',
            'transactions',
            'bounceRate',
            'sessionDuration',
            'conversions',
        ];
    }
    // 利用可能なディメンション一覧
    getAvailableDimensions() {
        return [
            'date',
            'deviceCategory',
            'sessionDefaultChannelGrouping',
            'sessionSource',
            'sessionMedium',
            'pagePath',
            'pageTitle',
            'country',
            'city',
            'browser',
            'operatingSystem',
        ];
    }
}
//# sourceMappingURL=ga4-client.js.map