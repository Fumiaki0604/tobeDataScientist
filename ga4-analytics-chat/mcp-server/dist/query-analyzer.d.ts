import { z } from 'zod';
export declare const AnalysisConfigSchema: z.ZodObject<{
    timeframe: z.ZodObject<{
        type: z.ZodEnum<["relative", "absolute", "named"]>;
        startDate: z.ZodOptional<z.ZodString>;
        endDate: z.ZodOptional<z.ZodString>;
        period: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "relative" | "absolute" | "named";
        startDate?: string | undefined;
        endDate?: string | undefined;
        period?: string | undefined;
    }, {
        type: "relative" | "absolute" | "named";
        startDate?: string | undefined;
        endDate?: string | undefined;
        period?: string | undefined;
    }>;
    metrics: z.ZodArray<z.ZodString, "many">;
    dimensions: z.ZodArray<z.ZodString, "many">;
    analysisType: z.ZodEnum<["simple_query", "comparison", "ranking", "trend", "device_breakdown"]>;
    filters: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
}, "strip", z.ZodTypeAny, {
    metrics: string[];
    dimensions: string[];
    timeframe: {
        type: "relative" | "absolute" | "named";
        startDate?: string | undefined;
        endDate?: string | undefined;
        period?: string | undefined;
    };
    analysisType: "simple_query" | "ranking" | "comparison" | "trend" | "device_breakdown";
    filters?: any[] | undefined;
}, {
    metrics: string[];
    dimensions: string[];
    timeframe: {
        type: "relative" | "absolute" | "named";
        startDate?: string | undefined;
        endDate?: string | undefined;
        period?: string | undefined;
    };
    analysisType: "simple_query" | "ranking" | "comparison" | "trend" | "device_breakdown";
    filters?: any[] | undefined;
}>;
export type AnalysisConfig = z.infer<typeof AnalysisConfigSchema>;
export declare class QueryAnalyzer {
    private timePatterns;
    private metricPatterns;
    private dimensionPatterns;
    analyzeQuery(question: string, propertyId: string): Promise<AnalysisConfig>;
    private extractTimeframe;
    private extractMetrics;
    private extractDimensions;
    private determineAnalysisType;
    calculateDateRange(timeframe: AnalysisConfig['timeframe']): {
        startDate: string;
        endDate: string;
    };
    private handleNamedPeriod;
    private formatDate;
}
//# sourceMappingURL=query-analyzer.d.ts.map