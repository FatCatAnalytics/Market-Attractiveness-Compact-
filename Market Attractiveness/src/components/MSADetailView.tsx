import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Info, TrendingUp, DollarSign, AlertTriangle } from "lucide-react";
import { MSACompetitiveTable } from "./MSACompetitiveTable";

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
  HHI_Score: string;
  Economic_Growth_Score: string;
  Loan_Growth_Score: string;
  Risk_Score: string;
  Risk_Migration_Score: string;
  Relative_Risk_Migration_Score: string;
  Premium_Discount_Score: string;
  Pricing_Rationality_Score: string;
  Revenue_per_Company_Score: string;
  International_CM_Score: string;
  Pricing_Rationality: string;
  Pricing_Rationality_Explanation: string;
}

interface OpportunityData {
  Provider: string;
  MSA: string;
  Product: string;
  "Market Share": string | number;
  "Defend $": string | number;
  "Market Size": string | number;
  Opportunity_Category: string;
  Attractiveness_Category: string;
  Included_In_Ranking?: boolean;
  Exclusion?: boolean;
}

interface MSADetailViewProps {
  msaData: MSAData;
  opportunities: OpportunityData[];
  allOpportunities?: OpportunityData[];
  selectedProviders?: Set<string>;
  onToggleProviderSelection?: (provider: string) => void;
}

export function MSADetailView({ msaData, opportunities, allOpportunities, selectedProviders, onToggleProviderSelection }: MSADetailViewProps) {
  const formatCurrency = (value: number | string) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return "$0.00";
    if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatPercentage = (value: number | string) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return "0.0%";
    return `${(num * 100).toFixed(1)}%`;
  };

  const getScoreColor = (score: string) => {
    const s = score?.toLowerCase() || "";
    if (s === "high" || s === "rational" || s === "premium" || s === "below national avg") return "text-green-600 font-medium";
    if (s === "medium" || s === "par" || s === "at national avg") return "text-yellow-600 font-medium";
    if (s === "low" || s === "irrational" || s === "discount" || s === "above national avg") return "text-red-600 font-medium";
    return "text-muted-foreground";
  };
  
  // Inverse logic for Risk/HHI
  const getInverseScoreColor = (score: string) => {
    const s = score?.toLowerCase() || "";
    if (s === "low") return "text-green-600 font-medium";
    if (s === "medium") return "text-yellow-600 font-medium";
    if (s === "high") return "text-red-600 font-medium";
    return "text-muted-foreground";
  };

  const getRiskMigrationColor = (score: string) => {
     const s = score?.toLowerCase() || "";
     if (s === "low") return "text-green-600 font-medium";
     if (s === "medium") return "text-yellow-600 font-medium";
     if (s === "high") return "text-red-600 font-medium";
     return "text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Market Metrics */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Market Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
               <div className="flex justify-between items-center border-b pb-2">
                <span className="text-muted-foreground">Market Size:</span>
                <span className={getScoreColor(msaData.Market_Size_Score)}>{msaData.Market_Size_Score || "N/A"}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-muted-foreground">Market Concentration:</span>
                <span className={getInverseScoreColor(msaData.HHI_Score)}>{msaData.HHI_Score || "N/A"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">International CM:</span>
                <span className={getScoreColor(msaData.International_CM_Score)}>{msaData.International_CM_Score || "N/A"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Growth & Risk */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Growth & Risk
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-muted-foreground">Economic Growth:</span>
                <span className={getScoreColor(msaData.Economic_Growth_Score)}>{msaData.Economic_Growth_Score || "N/A"}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-muted-foreground">Loan Growth:</span>
                <span className={getScoreColor(msaData.Loan_Growth_Score)}>{msaData.Loan_Growth_Score || "N/A"}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-muted-foreground">Credit Risk:</span>
                <span className={getInverseScoreColor(msaData.Risk_Score)}>{msaData.Risk_Score || "N/A"}</span>
              </div>
               <div className="flex justify-between items-center border-b pb-2">
                <span className="text-muted-foreground">Risk Migration:</span>
                <span className={getRiskMigrationColor(msaData.Risk_Migration_Score)}>{msaData.Risk_Migration_Score || "N/A"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Relative Risk Migration:</span>
                <span className={getScoreColor(msaData.Relative_Risk_Migration_Score)}>{msaData.Relative_Risk_Migration_Score || "N/A"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pricing & Other */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Pricing & Other
            </CardTitle>
          </CardHeader>
          <CardContent>
             <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-muted-foreground">Premium/Discount:</span>
                <span className={getScoreColor(msaData.Premium_Discount_Score)}>{msaData.Premium_Discount_Score || "N/A"}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-muted-foreground">Pricing Rationality:</span>
                <span className={getScoreColor(msaData.Pricing_Rationality_Score)}>{msaData.Pricing_Rationality_Score || "N/A"}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-muted-foreground">Revenue per Company:</span>
                <span className={getScoreColor(msaData.Revenue_per_Company_Score)}>{msaData.Revenue_per_Company_Score || "N/A"}</span>
              </div>
               <div className="pt-2">
                 <span className="text-xs text-muted-foreground italic block mb-1">Rational:</span>
                 <p className="text-xs">{msaData.Pricing_Rationality_Explanation || "No explanation available"}</p>
               </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Competitive Landscape Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Competitive Landscape</CardTitle>
        </CardHeader>
        <CardContent>
          <MSACompetitiveTable opportunities={opportunities} allOpportunities={allOpportunities} selectedProviders={selectedProviders} onToggleProviderSelection={onToggleProviderSelection} />
        </CardContent>
      </Card>
    </div>
  );
}