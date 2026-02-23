import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  DollarSign, 
  Briefcase,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from "lucide-react";
import { MSAEconomicsData } from "../utils/csvDataService";

interface MSAEconomicProfileProps {
  economics: MSAEconomicsData;
  msaName: string;
}

// Helper to format large numbers
const formatNumber = (num: number, decimals = 0): string => {
  if (num >= 1_000_000_000) {
    return `$${(num / 1_000_000_000).toFixed(1)}B`;
  }
  if (num >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `$${(num / 1_000).toFixed(1)}K`;
  }
  return `$${num.toFixed(decimals)}`;
};

const formatPopulation = (num: number): string => {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(0)}K`;
  }
  return num.toString();
};

const formatPercent = (num: number, showSign = true): string => {
  const sign = showSign && num > 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
};

// Determine trend icon and color based on value and whether higher is better
const getTrendIndicator = (value: number, higherIsBetter: boolean = true) => {
  const isPositive = value > 0;
  const isGood = higherIsBetter ? isPositive : !isPositive;
  
  if (Math.abs(value) < 0.1) {
    return { 
      icon: <Minus className="h-3 w-3" />, 
      color: 'text-gray-400',
      bgColor: 'bg-gray-100'
    };
  }
  
  if (isGood) {
    return { 
      icon: isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50'
    };
  }
  
  return { 
    icon: isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />,
    color: 'text-red-500',
    bgColor: 'bg-red-50'
  };
};

// Calculate economic health score (0-100)
const calculateHealthScore = (economics: MSAEconomicsData): number => {
  let score = 50; // Base score
  
  // GDP Growth (weight: 25%)
  if (economics.gdpGrowth > 3) score += 15;
  else if (economics.gdpGrowth > 2) score += 10;
  else if (economics.gdpGrowth > 1) score += 5;
  else if (economics.gdpGrowth < 0) score -= 10;
  
  // Income Growth (weight: 20%)
  if (economics.incomeGrowth > 5) score += 12;
  else if (economics.incomeGrowth > 3) score += 8;
  else if (economics.incomeGrowth > 1) score += 4;
  else if (economics.incomeGrowth < 0) score -= 8;
  
  // Unemployment (weight: 25%) - lower is better
  if (economics.unemployment2024 < 3) score += 15;
  else if (economics.unemployment2024 < 4) score += 10;
  else if (economics.unemployment2024 < 5) score += 5;
  else if (economics.unemployment2024 > 6) score -= 10;
  
  // Population Growth (weight: 15%)
  if (economics.populationGrowth > 2) score += 10;
  else if (economics.populationGrowth > 1) score += 6;
  else if (economics.populationGrowth > 0) score += 3;
  else if (economics.populationGrowth < -1) score -= 8;
  
  // Per Capita Income (weight: 15%)
  if (economics.perCapitaIncome > 70000) score += 10;
  else if (economics.perCapitaIncome > 60000) score += 6;
  else if (economics.perCapitaIncome > 50000) score += 3;
  else if (economics.perCapitaIncome < 40000) score -= 5;
  
  return Math.max(0, Math.min(100, score));
};

const getHealthLabel = (score: number): { label: string; color: string; bgColor: string } => {
  if (score >= 80) return { label: 'Excellent', color: 'text-emerald-700', bgColor: 'bg-emerald-100' };
  if (score >= 65) return { label: 'Strong', color: 'text-blue-700', bgColor: 'bg-blue-100' };
  if (score >= 50) return { label: 'Moderate', color: 'text-amber-700', bgColor: 'bg-amber-100' };
  if (score >= 35) return { label: 'Weak', color: 'text-orange-700', bgColor: 'bg-orange-100' };
  return { label: 'Challenging', color: 'text-red-700', bgColor: 'bg-red-100' };
};

export function MSAEconomicProfile({ economics, msaName }: MSAEconomicProfileProps) {
  const gdpTrend = getTrendIndicator(economics.gdpGrowth, true);
  const incomeTrend = getTrendIndicator(economics.incomeGrowth, true);
  const unempTrend = getTrendIndicator(economics.unemploymentChange, false);
  const popTrend = getTrendIndicator(economics.populationGrowth, true);

  return (
    <Card className="p-4 bg-gradient-to-br from-slate-50 to-white border-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-slate-600" />
            <h3 className="font-semibold text-slate-800">MSA Economic Profile</h3>
          </div>
          <p className="text-xs text-slate-500">Metrics relative to national average</p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* GDP */}
        <div className="bg-white rounded-lg p-3 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500">GDP</span>
            <div className={`flex items-center gap-0.5 ${gdpTrend.color} ${gdpTrend.bgColor} px-1.5 py-0.5 rounded text-xs font-medium`}>
              {gdpTrend.icon}
              {formatPercent(economics.gdpGrowth)}
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <DollarSign className="h-4 w-4 text-slate-400" />
            <span className="text-lg font-bold text-slate-800">
              {formatNumber(economics.gdp * 1000)} {/* GDP is in $K */}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Annual GDP</p>
        </div>

        {/* Per Capita Income */}
        <div className="bg-white rounded-lg p-3 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500">Per Capita Income</span>
            <div className={`flex items-center gap-0.5 ${incomeTrend.color} ${incomeTrend.bgColor} px-1.5 py-0.5 rounded text-xs font-medium`}>
              {incomeTrend.icon}
              {formatPercent(economics.incomeGrowth)}
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <Briefcase className="h-4 w-4 text-slate-400" />
            <span className="text-lg font-bold text-slate-800">
              ${economics.perCapitaIncome.toLocaleString()}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">YoY Growth</p>
        </div>

        {/* Unemployment */}
        <div className="bg-white rounded-lg p-3 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500">Unemployment</span>
            <div className={`flex items-center gap-0.5 ${unempTrend.color} ${unempTrend.bgColor} px-1.5 py-0.5 rounded text-xs font-medium`}>
              {unempTrend.icon}
              {formatPercent(economics.unemploymentChange)}
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <Users className="h-4 w-4 text-slate-400" />
            <span className="text-lg font-bold text-slate-800">
              {economics.unemployment2024.toFixed(1)}%
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">2024 Rate (was {economics.unemployment2023.toFixed(1)}%)</p>
        </div>

        {/* Population */}
        <div className="bg-white rounded-lg p-3 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500">Population</span>
            <div className={`flex items-center gap-0.5 ${popTrend.color} ${popTrend.bgColor} px-1.5 py-0.5 rounded text-xs font-medium`}>
              {popTrend.icon}
              {formatPercent(economics.populationGrowth)}
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <Users className="h-4 w-4 text-slate-400" />
            <span className="text-lg font-bold text-slate-800">
              {formatPopulation(economics.population2024)}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">2024 Est. ({formatPopulation(economics.population2023)} in 2023)</p>
        </div>
      </div>

      {/* Quick Insights */}
      <div className="mt-3 pt-3 border-t border-slate-100">
        <div className="flex flex-wrap gap-2">
          {economics.gdpGrowth > 2.5 && (
            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
              <TrendingUp className="h-3 w-3 mr-1" /> Strong GDP Growth
            </Badge>
          )}
          {economics.unemployment2024 < 3.5 && (
            <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
              <Briefcase className="h-3 w-3 mr-1" /> Low Unemployment
            </Badge>
          )}
          {economics.populationGrowth > 1.5 && (
            <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
              <Users className="h-3 w-3 mr-1" /> Growing Population
            </Badge>
          )}
          {economics.incomeGrowth > 5 && (
            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
              <DollarSign className="h-3 w-3 mr-1" /> Rising Incomes
            </Badge>
          )}
          {economics.perCapitaIncome > 65000 && (
            <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">
              <DollarSign className="h-3 w-3 mr-1" /> High Income Market
            </Badge>
          )}
          {economics.unemployment2024 > 5 && (
            <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
              <TrendingDown className="h-3 w-3 mr-1" /> Elevated Unemployment
            </Badge>
          )}
          {economics.populationGrowth < 0 && (
            <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200">
              <Users className="h-3 w-3 mr-1" /> Population Decline
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}

// Compact version for comparison view
interface MSAEconomicProfileCompactProps {
  economics: MSAEconomicsData;
}

export function MSAEconomicProfileCompact({ economics }: MSAEconomicProfileCompactProps) {
  return (
    <div className="bg-slate-50 rounded-lg p-2 border border-slate-200">
      <div className="text-[10px] font-medium text-slate-500 mb-1.5 flex items-center gap-1">
        <Building2 className="h-3 w-3" />
        Economic Indicators <span className="text-[9px] font-normal text-slate-400">(% changes are YoY · relative to national average)</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {/* GDP */}
        <div className="flex items-center justify-between bg-white rounded px-1.5 py-1 border border-slate-100">
          <span className="text-[10px] text-slate-500">GDP</span>
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] font-semibold">{formatNumber(economics.gdp * 1000)}</span>
            <span 
              className={`text-[10px] font-medium ${
                economics.gdpGrowth > 0 ? 'text-emerald-600' : 
                economics.gdpGrowth < 0 ? 'text-red-600' : 
                'text-slate-400'
              }`}
            >
              {economics.gdpGrowth > 0 ? '↑' : economics.gdpGrowth < 0 ? '↓' : '−'}{Math.abs(economics.gdpGrowth).toFixed(1)}%
            </span>
          </div>
        </div>
        
        {/* Unemployment - green for decrease (good), red for increase (bad) */}
        <div className="flex items-center justify-between bg-white rounded px-1.5 py-1 border border-slate-100">
          <span className="text-[10px] text-slate-500">Unemployment</span>
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] font-semibold">{economics.unemployment2024.toFixed(1)}%</span>
            <span 
              className={`text-[10px] font-medium ${
                economics.unemploymentChange < 0 ? 'text-emerald-600' : 
                economics.unemploymentChange > 0 ? 'text-red-600' : 
                'text-slate-400'
              }`}
            >
              {economics.unemploymentChange > 0 ? '↑' : economics.unemploymentChange < 0 ? '↓' : '−'}{Math.abs(economics.unemploymentChange).toFixed(1)}%
            </span>
          </div>
        </div>
        
        {/* Income */}
        <div className="flex items-center justify-between bg-white rounded px-1.5 py-1 border border-slate-100">
          <span className="text-[10px] text-slate-500">Income</span>
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] font-semibold">${(economics.perCapitaIncome / 1000).toFixed(0)}K</span>
            <span 
              className={`text-[10px] font-medium ${
                economics.incomeGrowth > 0 ? 'text-emerald-600' : 
                economics.incomeGrowth < 0 ? 'text-red-600' : 
                'text-slate-400'
              }`}
            >
              {economics.incomeGrowth > 0 ? '↑' : economics.incomeGrowth < 0 ? '↓' : '−'}{Math.abs(economics.incomeGrowth).toFixed(1)}%
            </span>
          </div>
        </div>
        
        {/* Population */}
        <div className="flex items-center justify-between bg-white rounded px-1.5 py-1 border border-slate-100">
          <span className="text-[10px] text-slate-500">Population</span>
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] font-semibold">{formatPopulation(economics.population2024)}</span>
            <span 
              className={`text-[10px] font-medium ${
                economics.populationGrowth > 0 ? 'text-emerald-600' : 
                economics.populationGrowth < 0 ? 'text-red-600' : 
                'text-slate-400'
              }`}
            >
              {economics.populationGrowth > 0 ? '↑' : economics.populationGrowth < 0 ? '↓' : '−'}{Math.abs(economics.populationGrowth).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
