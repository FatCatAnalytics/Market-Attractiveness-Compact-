import { Card } from "./ui/card";
import { TrendingUp, Crown, Star, Zap } from "lucide-react";

interface MSAData {
  MSA: string;
  Product: string;
  LAT: number;
  LON: number;
  Attractiveness_Score: number;
  Attractiveness_Category: string;
  "Market Size": number;
  Risk: number;
  Price: number;
  Driving_Metric: string;
  Market_Size_Score: string;
  Economic_Growth_Score: string;
  Risk_Score: string;
  Pricing_Rationality: string;
}

interface StrategicInsightsProps {
  mapData: MSAData[];
}

export function StrategicInsights({ mapData }: StrategicInsightsProps) {
  // Calculate top market
  const topMarket = mapData.reduce((prev, current) => {
    return (current.Attractiveness_Score > prev.Attractiveness_Score) ? current : prev;
  }, mapData[0]);

  // Calculate star markets (Highly Attractive + high growth)
  const starMarkets = mapData.filter(msa => 
    msa.Attractiveness_Category === "Highly Attractive" && 
    msa.Economic_Growth_Score === "High"
  );

  // Calculate high-growth markets (lending growth above 15%)
  // Using Economic_Growth_Score as proxy since we don't have lending growth data directly
  const highGrowthMarkets = mapData.filter(msa => 
    msa.Economic_Growth_Score === "High"
  );

  return (
    <Card className="w-80 p-4 shadow-lg bg-white/95 backdrop-blur-sm">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2 pb-3 border-b">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          <h3 className="text-base">Strategic Insights</h3>
        </div>

        {/* Top Market */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Crown className="h-4 w-4 text-yellow-600" />
            <span>Top Market</span>
          </div>
          <p className="text-sm pl-6">
            <span className="font-medium text-green-600">{topMarket?.MSA || "N/A"}</span> leads with the highest score
          </p>
        </div>

        {/* Star Markets */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Star className="h-4 w-4 text-yellow-500" />
            <span>Star Markets</span>
          </div>
          <p className="text-sm pl-6">
            <span className="font-medium text-green-600">{starMarkets.length} markets</span> combine high score + high growth
          </p>
        </div>

        {/* High-Growth Markets */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="h-4 w-4 text-green-600" />
            <span>High-Growth Markets</span>
          </div>
          <p className="text-sm pl-6">
            <span className="font-medium text-green-600">{highGrowthMarkets.length} markets</span> show strong economic growth
          </p>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Click any marker to explore market details
          </p>
        </div>
      </div>
    </Card>
  );
}
