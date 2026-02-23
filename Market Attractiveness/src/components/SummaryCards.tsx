import React from "react";
import { Card, CardContent } from "./ui/card";
import { TrendingUp, Target, DollarSign, AlertTriangle, Building2, MapPin, TrendingDown, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface SummaryCardsProps {
  summaryData: {
    msaOverview: {
      totalMSAs: number;
      totalBanks: number;
    };
    targetedOpportunities: {
      highAttractiveMSAs: number;
      excellentOpportunities: number;
      opportunityDistribution: Record<string, number>;
    };
    nationalMarket: {
      totalMarketSize: number;
      avgRiskScore: number;
      avgPricing: number;
      avgLendingVolumeChange: number;
      avgLoanToDepositChange: number;
    };
    riskPricing: {
      premiumMarkets: number;
      atParMarkets: number;
      discountMarkets: number;
      rationalPricing: number;
      irrationalPricing: number;
      overpricedOpportunity: number;
      underpricedRisk: number;
    };
  } | null;
  isLoading: boolean;
}

export function SummaryCards({ summaryData, isLoading }: SummaryCardsProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1e9) {
      return `$${(value / 1e9).toFixed(1)}B`;
    } else if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(1)}M`;
    } else if (value >= 1e3) {
      return `$${(value / 1e3).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const formatPercentage = (value: number) => {
    const formatted = value >= 0 ? `+${value.toFixed(1)}%` : `${value.toFixed(1)}%`;
    return formatted;
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse border border-border">
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="h-9 w-9 bg-muted rounded-lg"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded w-24"></div>
                  <div className="h-8 bg-muted rounded w-20"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!summaryData) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      {/* Card 1: MSA Overview */}
      <Card className="border-l-4 border-l-blue-500 border-t border-r border-b border-border hover:shadow-md transition-shadow duration-200">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
              <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total MSAs</p>
              <p className="text-3xl text-blue-600 dark:text-blue-400">{summaryData.msaOverview.totalMSAs}</p>
            </div>
            <div className="pt-3 border-t border-border">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">Total Banks</span>
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-lg">{summaryData.msaOverview.totalBanks}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: National Market Overview */}
      <Card className="border-l-4 border-l-emerald-500 border-t border-r border-b border-border hover:shadow-md transition-shadow duration-200">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
              <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground mb-1">Market Size</p>
            <p className="text-2xl text-emerald-600 dark:text-emerald-400 mb-3">{formatCurrency(summaryData.nationalMarket.totalMarketSize)}</p>
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Avg Risk (S&P)</span>
                <span>{summaryData.nationalMarket.avgRiskScore.toFixed(1)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Avg Pricing over SOFR</span>
                <span>{Math.round(summaryData.nationalMarket.avgPricing)} bps</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Lending Growth</span>
                <span className={`flex items-center gap-1 ${
                  summaryData.nationalMarket.avgLendingVolumeChange >= 0 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {summaryData.nationalMarket.avgLendingVolumeChange >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {formatPercentage(summaryData.nationalMarket.avgLendingVolumeChange)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Credit Pricing Posture */}
      <Card className="border-l-4 border-l-purple-500 border-t border-r border-b border-border hover:shadow-md transition-shadow duration-200">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="p-2.5 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
              <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground mb-3">Credit Pricing Posture</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="border border-border rounded-lg p-2.5 hover:bg-muted/30 transition-colors">
                <p className="text-xs text-muted-foreground mb-1">Premium</p>
                <p className="text-lg text-green-600 dark:text-green-400">{summaryData.riskPricing.premiumMarkets}</p>
              </div>
              <div className="border border-border rounded-lg p-2.5 hover:bg-muted/30 transition-colors">
                <p className="text-xs text-muted-foreground mb-1">Par</p>
                <p className="text-lg text-blue-600 dark:text-blue-400">{summaryData.riskPricing.atParMarkets}</p>
              </div>
              <div className="border border-border rounded-lg p-2.5 hover:bg-muted/30 transition-colors">
                <p className="text-xs text-muted-foreground mb-1">Discount</p>
                <p className="text-lg text-red-600 dark:text-red-400">{summaryData.riskPricing.discountMarkets}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 4: Credit Pricing Rationality */}
      <Card className="border-l-4 border-l-orange-500 border-t border-r border-b border-border hover:shadow-md transition-shadow duration-200">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="p-2.5 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground mb-3">Credit Pricing Rationality</p>
            <div className="space-y-2">
              <div className="border border-border rounded-lg p-2.5 hover:bg-muted/30 transition-colors">
                <p className="text-xs text-muted-foreground mb-1">Rational</p>
                <p className="text-lg text-emerald-600 dark:text-emerald-400">{summaryData.riskPricing.rationalPricing}</p>
              </div>
              <div className="border border-border rounded-lg p-2.5 hover:bg-muted/30 transition-colors">
                <p className="text-xs text-muted-foreground mb-2">Irrational</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col">
                    <p className="text-xs text-muted-foreground mb-1">Overpriced</p>
                    <p className="text-base text-blue-600 dark:text-blue-400">{summaryData.riskPricing.overpricedOpportunity}</p>
                  </div>
                  <div className="flex flex-col">
                    <p className="text-xs text-muted-foreground mb-1">Underpriced</p>
                    <p className="text-base text-red-600 dark:text-red-400">{summaryData.riskPricing.underpricedRisk}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
