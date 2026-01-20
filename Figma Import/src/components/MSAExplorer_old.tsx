import { useState, useMemo } from "react";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import { Search, HelpCircle } from "lucide-react";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

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
  Premium_Discount: string;
  Pricing_Rationality: string;
  Pricing_Rationality_Explanation: string;
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
}

interface MSAExplorerProps {
  data: MSAData[];
  weights: any;
  useOriginalScores: boolean;
}



export function MSAExplorer({ data, weights, useOriginalScores }: MSAExplorerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAttractiveness, setSelectedAttractiveness] = useState("all");
  const [selectedPricing, setSelectedPricing] = useState("all");
  const [selectedGrowth, setSelectedGrowth] = useState("all");

  // Filter data based on selections
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchesSearch = searchTerm === "" || 
        item.MSA.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesAttractiveness = selectedAttractiveness === "all" || 
        item.Attractiveness_Category === selectedAttractiveness;
      const matchesPricing = selectedPricing === "all" || 
        item.Pricing_Rationality === selectedPricing;
      const matchesGrowth = selectedGrowth === "all" || 
        item.Economic_Growth_Score === selectedGrowth;

      return matchesSearch && matchesAttractiveness && 
             matchesPricing && matchesGrowth;
    });
  }, [data, searchTerm, selectedAttractiveness, selectedPricing, selectedGrowth]);



  // Component score percentage breakdown (only when attractiveness filter is active)
  // Component weights (from What-If Analysis)
  const COMPONENT_WEIGHTS = {
    Market_Size_Score: 16,
    HHI_Score: 10,
    Economic_Growth_Score: 10,
    Loan_Growth_Score: 8,
    Risk_Score: 6,
    Risk_Migration_Score: 10,
    Relative_Risk_Migration_Score: 8,
    Premium_Discount_Score: 10,
    Pricing_Rationality_Score: 10,
    Revenue_per_Company_Score: 6,
    International_CM_Score: 6,
  };

  // Convert score text to numeric value
  const scoreToValue = (score: string, isInverse: boolean = false): number => {
    if (!score) return 0;
    const normalized = score.toLowerCase();
    
    // For inverse scoring (lower is better)
    if (isInverse) {
      if (normalized === "high") return 1;
      if (normalized === "medium") return 2;
      if (normalized === "low") return 3;
      // For Relative Risk Migration
      if (normalized === "above_national") return 1;
      if (normalized === "at_national") return 2;
      if (normalized === "below_national") return 3;
      return 0;
    }
    
    // Handle Premium/Discount values (Discount is best)
    if (normalized === "discount") return 3;
    if (normalized === "par") return 2;
    if (normalized === "premium") return 1;
    
    // Handle Pricing Rationality values (Rational is best)
    if (normalized === "rational") return 3;
    if (normalized === "irrational") return 1;
    
    // Standard scoring (higher is better)
    if (normalized === "high") return 3;
    if (normalized === "medium") return 2;
    if (normalized === "low") return 1;
    return 0;
  };

  // Calculate weighted average scores for components
  const componentWeightedScores = useMemo(() => {
    const dataToAnalyze = selectedAttractiveness === "all" ? data : filteredData;
    
    if (dataToAnalyze.length === 0) return null;

    const components = [
      { key: "Market_Size_Score", label: "Market Size", weight: COMPONENT_WEIGHTS.Market_Size_Score },
      { key: "HHI_Score", label: "HHI", weight: COMPONENT_WEIGHTS.HHI_Score },
      { key: "Economic_Growth_Score", label: "Economic Growth", weight: COMPONENT_WEIGHTS.Economic_Growth_Score },
      { key: "Loan_Growth_Score", label: "Loan Growth", weight: COMPONENT_WEIGHTS.Loan_Growth_Score },
      { key: "Risk_Score", label: "Risk", weight: COMPONENT_WEIGHTS.Risk_Score },
      { key: "Risk_Migration_Score", label: "Risk Migration", weight: COMPONENT_WEIGHTS.Risk_Migration_Score },
      { key: "Relative_Risk_Migration_Score", label: "Relative Risk Migration", weight: COMPONENT_WEIGHTS.Relative_Risk_Migration_Score },
      { key: "Premium_Discount_Score", label: "Premium/Discount", weight: COMPONENT_WEIGHTS.Premium_Discount_Score },
      { key: "Pricing_Rationality_Score", label: "Pricing Rationality", weight: COMPONENT_WEIGHTS.Pricing_Rationality_Score },
      { key: "Revenue_per_Company_Score", label: "Revenue per Company", weight: COMPONENT_WEIGHTS.Revenue_per_Company_Score },
      { key: "International_CM_Score", label: "International CM", weight: COMPONENT_WEIGHTS.International_CM_Score },
    ];

    return components.map(({ key, label, weight }) => {
      // Calculate average score value (0-3 scale)
      // Use inverse scoring for Risk Migration and Relative Risk Migration (lower is better)
      const isInverse = key === "Risk_Migration_Score" || key === "Relative_Risk_Migration_Score";
      const scores = dataToAnalyze.map(item => scoreToValue((item as any)[key], isInverse));
      const avgScore = scores.length > 0 
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length 
        : 0;
      
      // Calculate weighted score: multiply average (0-3) by weight percentage
      const weightedScore = avgScore * (weight / 100);
      
      return {
        name: label,
        avgScore: parseFloat(avgScore.toFixed(2)),
        weight: weight,
        weightedScore: parseFloat(weightedScore.toFixed(3)),
        // Scale for visualization (weighted score * 100 for better display)
        value: parseFloat((weightedScore * 100).toFixed(1)),
        total: dataToAnalyze.length
      };
    });
  }, [data, filteredData, selectedAttractiveness]);

  // Get top MSAs by attractiveness score
  const topMSAs = useMemo(() => {
    return [...filteredData]
      .sort((a, b) => b.Attractiveness_Score - a.Attractiveness_Score)
      .slice(0, 10);
  }, [filteredData]);

  const getAttractivenessColor = (category: string) => {
    if (category === "High") return "bg-green-100 text-green-800 border-green-300";
    if (category === "Medium") return "bg-yellow-100 text-yellow-800 border-yellow-300";
    if (category === "Low") return "bg-orange-100 text-orange-800 border-orange-300";
    return "bg-red-100 text-red-800 border-red-300";
  };

  return (
    <div className="space-y-4">
      {/* Filters Section */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3>Filters & Search</h3>
          {!useOriginalScores && (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
              Custom Weights Active
            </Badge>
          )}
        </div>
        <div className="flex flex-row gap-4">
          {/* Search */}
          <div className="flex-1 space-y-2">
            <Label>Search MSA</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by MSA name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Attractiveness Filter */}
          <div className="flex-1 space-y-2">
            <Label>Attractiveness</Label>
            <Select value={selectedAttractiveness} onValueChange={setSelectedAttractiveness}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Hostile">Hostile</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Pricing Filter */}
          <div className="flex-1 space-y-2">
            <Label>Pricing</Label>
            <Select value={selectedPricing} onValueChange={setSelectedPricing}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Rational">Rational</SelectItem>
                <SelectItem value="Irrational">Irrational</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Growth Filter */}
          <div className="flex-1 space-y-2">
            <Label>Growth Score</Label>
            <Select value={selectedGrowth} onValueChange={setSelectedGrowth}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Active Filters Summary */}
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <span>Showing {filteredData.length} of {data.length} MSAs</span>
          {(searchTerm || selectedAttractiveness !== "all" || 
            selectedPricing !== "all" || selectedGrowth !== "all") && (
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedAttractiveness("all");
                setSelectedPricing("all");
                setSelectedGrowth("all");
              }}
              className="text-primary hover:underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      </Card>

      {/* Weighted Component Score Analysis */}
      {componentWeightedScores && (
      <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-2">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3>
                  Weighted Component Score Analysis
                  {selectedAttractiveness !== "all" && ` - ${selectedAttractiveness} Attractiveness MSAs`}
                </h3>
                <TooltipProvider>
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg">
                      <div className="space-y-3 text-sm">
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100">How to Read This Chart</h4>
                        
                        <p className="text-slate-700 dark:text-slate-300">
                          Each bar shows the weighted contribution of a component to the overall attractiveness score.
                        </p>
                        
                        <div className="space-y-2">
                          <p className="font-medium text-slate-900 dark:text-slate-100">Calculation:</p>
                          <code className="block bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-xs">
                            (Average Score × Weight %) × 100
                          </code>
                        </div>
                        
                        <div className="space-y-2">
                          <p className="font-medium text-slate-900 dark:text-slate-100">Scoring:</p>
                          <div className="text-xs space-y-1">
                            <div>High = 3, Medium = 2, Low = 1</div>
                            <div>Premium/Discount: Discount=3, Par=2, Premium=1</div>
                            <div>Pricing Rationality: Rational=3, Irrational=1</div>
                          </div>
                        </div>
                        
                        <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700 p-2 rounded">
                          <strong>Note:</strong> Bars don't add to 100% - they're scaled for visualization. Longer bars indicate components that score well AND have high importance.
                        </p>
                      </div>
                    </TooltipContent>
                  </UITooltip>
                </TooltipProvider>
              </div>
              <p className="text-sm text-muted-foreground">
                Average component scores weighted by their importance in the attractiveness calculation
                {selectedAttractiveness !== "all" 
                  ? ` across ${filteredData.length} ${selectedAttractiveness} attractiveness MSAs`
                  : ` across all ${data.length} MSAs`
                }
              </p>
            </div>
            {selectedAttractiveness !== "all" && (
              <Badge 
                className={
                  selectedAttractiveness === "High" ? "bg-green-100 text-green-800 border-green-300" :
                  selectedAttractiveness === "Medium" ? "bg-yellow-100 text-yellow-800 border-yellow-300" :
                  selectedAttractiveness === "Low" ? "bg-orange-100 text-orange-800 border-orange-300" :
                  "bg-red-100 text-red-800 border-red-300"
                }
              >
                {filteredData.length} MSAs
              </Badge>
            )}
          </div>
        </div>
        <div className="bg-muted/30 rounded-lg p-4">
          <ResponsiveContainer width="100%" height={500}>
            <BarChart 
              data={componentWeightedScores} 
              layout="vertical" 
              margin={{ left: 150, right: 60, top: 20, bottom: 20 }}
            >
              <defs>
                <linearGradient id="componentGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9}/>
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0.7}/>
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="currentColor"
                className="opacity-20"
                horizontal={false}
              />
              <XAxis 
                type="number" 
                domain={[0, 100]}
                label={{ 
                  value: 'Weighted Contribution Score (0-100)', 
                  position: 'insideBottom', 
                  offset: -10,
                  style: { fontSize: 14, fontWeight: 500, fill: 'currentColor', opacity: 0.7 }
                }}
                tick={{ fontSize: 13 }}
                stroke="currentColor"
                className="opacity-60"
              />
              <YAxis 
                type="category" 
                dataKey="name" 
                width={140}
                tick={{ fontSize: 13, fontWeight: 500 }}
                stroke="currentColor"
                className="opacity-60"
              />
              <Tooltip 
                cursor={{ fill: 'currentColor', opacity: 0.1 }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div 
                        className="bg-card border rounded-lg p-3 shadow-lg"
                        style={{
                          borderColor: 'var(--border)',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        }}
                      >
                        <p className="font-medium mb-2">{data.name}</p>
                        <div className="space-y-1 text-sm">
                          <p className="text-muted-foreground">
                            Average Score: <span className="font-medium">{data.avgScore}</span> / 3.0
                          </p>
                          <p className="text-muted-foreground">
                            Component Weight: <span className="font-medium">{data.weight}%</span>
                          </p>
                          <p className="font-medium" style={{ color: '#3b82f6' }}>
                            Weighted Contribution: {data.value.toFixed(1)}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            ({data.avgScore} × {data.weight}% × 100 = {data.value.toFixed(1)})
                          </p>
                          <p className="text-muted-foreground">
                            MSAs Analyzed: <span className="font-medium">{data.total}</span>
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar 
                dataKey="value" 
                fill="url(#componentGradient)"
                radius={[0, 8, 8, 0]}
                animationDuration={1000}
                animationBegin={0}
              >
                <LabelList 
                  dataKey="value" 
                  position="right" 
                  formatter={(value: number) => value.toFixed(1)}
                  style={{ 
                    fontSize: 12, 
                    fontWeight: 600,
                    fill: 'currentColor',
                    opacity: 0.8
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">How to read this chart:</span> Each bar shows the weighted contribution of a component to the overall attractiveness score
            {selectedAttractiveness !== "all" 
              ? ` for "${selectedAttractiveness}" attractiveness MSAs`
              : " across all MSAs"
            }. 
            Longer bars indicate components that both score well on average (High=3, Medium=2, Low=1) and carry significant weight in the calculation. 
            The calculation multiplies the average score by the component's weight percentage and scales to 0-100 for visualization.
          </p>
        </div>
      </Card>
      )}



      {/* Top MSAs Table */}
      <Card className="p-4">
        <h3 className="mb-4">Top 10 MSAs by Attractiveness Score</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Rank</th>
                <th className="text-left py-3 px-4">MSA</th>
                <th className="text-left py-3 px-4">Score</th>
                <th className="text-left py-3 px-4">Category</th>
                <th className="text-left py-3 px-4">Growth</th>
                <th className="text-left py-3 px-4">HHI</th>
                <th className="text-left py-3 px-4">Pricing</th>
              </tr>
            </thead>
            <tbody>
              {topMSAs.map((msa, idx) => (
                <tr key={idx} className="border-b hover:bg-muted/50">
                  <td className="py-3 px-4">{idx + 1}</td>
                  <td className="py-3 px-4">{msa.MSA}</td>
                  <td className="py-3 px-4">{msa.Attractiveness_Score.toFixed(2)}</td>
                  <td className="py-3 px-4">
                    <Badge className={getAttractivenessColor(msa.Attractiveness_Category)}>
                      {msa.Attractiveness_Category}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-sm">{msa.Economic_Growth_Score}</td>
                  <td className="py-3 px-4 text-sm">{msa.HHI_Score}</td>
                  <td className="py-3 px-4 text-sm">{msa.Pricing_Rationality}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
