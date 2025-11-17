import { z } from 'zod';
export declare const GA4FetchParamsSchema: z.ZodObject<{
    propertyId: z.ZodString;
    startDate: z.ZodString;
    endDate: z.ZodString;
    metrics: z.ZodArray<z.ZodString, "many">;
    dimensions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    accessToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    propertyId: string;
    startDate: string;
    endDate: string;
    metrics: string[];
    accessToken: string;
    dimensions?: string[] | undefined;
}, {
    propertyId: string;
    startDate: string;
    endDate: string;
    metrics: string[];
    accessToken: string;
    dimensions?: string[] | undefined;
}>;
export type GA4FetchParams = z.infer<typeof GA4FetchParamsSchema>;
export interface GA4Response {
    dimensionHeaders?: Array<{
        name: string;
    }>;
    metricHeaders?: Array<{
        name: string;
        type: string;
    }>;
    rows?: Array<{
        dimensionValues?: Array<{
            value: string;
        }>;
        metricValues?: Array<{
            value: string;
        }>;
    }>;
}
export declare class GA4Client {
    fetchAnalyticsData(params: GA4FetchParams): Promise<any>;
    private formatApiResponse;
    validateProperty(propertyId: string, accessToken: string): Promise<boolean>;
    getAvailableMetrics(): string[];
    getAvailableDimensions(): string[];
}
//# sourceMappingURL=ga4-client.d.ts.map