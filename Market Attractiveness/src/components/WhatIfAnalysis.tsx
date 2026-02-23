import { useState, useMemo, useRef, useEffect } from "react";
import { GlobalFilters } from "../types";
import { fetchFilterBuckets } from "../utils/csvDataHooks";
import { getRegionFromCoordinates } from "../utils/applyGlobalFilters";
import { getRegionForMSASync } from "../utils/stateToRegionMapping";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Card } from "./ui/card";
import { WeightSlider } from "./WeightSlider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { ArrowUpDown, X, Filter, RotateCcw, Save, Settings2, Sliders as SlidersIcon, RefreshCw, Info, GripVertical, Eye, EyeOff, Calculator } from "lucide-react";
import { Button } from "./ui/button";
import { Weights, DEFAULT_WEIGHTS, calculateAttractivenessScore, getCategoriesByQuartiles, BucketAssignment, ImportanceBucket, DEFAULT_BUCKET_ASSIGNMENTS, calculateBucketModeScore } from "../utils/scoreCalculation";
import { Alert, AlertDescription } from "./ui/alert";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Slider } from "./ui/slider";

interface WhatIfData {
  MSA: string;
  Product: string;
  LAT?: number;
  LON?: number;
  Market_Size_Score: string;  // Now used for filtering only
  "Market Size"?: number;     // Actual numeric value for bucket filtering
  HHI_Score: string;
  Economic_Growth_Score: string;
  Loan_Growth_Score: string;
  Risk_Score: string;
  Risk_Migration_Score: string;
  Relative_Risk_Migration_Score: string;
  Premium_Discount_Score: string;
  Pricing_Rationality_Score: string;
  Revenue_per_Company_Score: string;  // Now used for filtering only
  "Revenue per Company"?: number;     // Actual numeric value for bucket filtering
  International_CM_Score: string;
  Attractiveness_Score: number;
  Attractiveness_Category: string;
}

interface FilterBucket {
  label: string;
  min: number;
  max: number;
  count: number;
}

interface FilterBucketData {
  buckets: FilterBucket[];
  range: { min: number; max: number };
  totalCount: number;
}

interface WhatIfAnalysisProps {
  data: WhatIfData[];
  weights: Weights;
  setWeights: (weights: Weights) => void;
  bucketAssignments: BucketAssignment[];
  setBucketAssignments: (assignments: BucketAssignment[]) => void;
  bucketWeights: { high: number; medium: number };
  setBucketWeights: (weights: { high: number; medium: number }) => void;
  globalFilters: GlobalFilters;
  setGlobalFilters: (filters: GlobalFilters) => void;
  resetGlobalFilters: () => void;
}

type SortField = "MSA" | "originalScore" | "calculatedScore" | "scoreDelta" | "originalCategory" | "calculatedCategory";
type SortDirection = "asc" | "desc";

// Column configuration
interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  sortable: boolean;
  fixed?: boolean; // MSA column should be fixed
  minWidth?: string;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: "MSA", label: "MSA", visible: true, sortable: true, fixed: true, minWidth: "200px" },
  { id: "originalScore", label: "Original Score", visible: true, sortable: true, minWidth: "100px" },
  { id: "calculatedScore", label: "New Score", visible: true, sortable: true, minWidth: "100px" },
  { id: "scoreDelta", label: "Change", visible: true, sortable: true, minWidth: "100px" },
  { id: "originalCategory", label: "Original Category", visible: true, sortable: true, minWidth: "120px" },
  { id: "calculatedCategory", label: "New Category", visible: true, sortable: true, minWidth: "120px" },
  { id: "HHI", label: "Market Concentration", visible: true, sortable: false },
  { id: "Economic_Growth", label: "Economic Growth", visible: true, sortable: false },
  { id: "Loan_Growth", label: "Loan Growth", visible: true, sortable: false },
  { id: "Risk", label: "Weighted Average Credit Risk", visible: true, sortable: false },
  { id: "Risk_Migration", label: "1-Year Credit Risk Migration", visible: true, sortable: false },
  { id: "Relative_Risk_Migration", label: "Relative Risk Mig.", visible: true, sortable: false },
  { id: "Premium_Discount", label: "Premium / Discount Loan Pricing", visible: true, sortable: false },
  { id: "Pricing_Rationality", label: "Loan Pricing Rationality", visible: true, sortable: false },
  { id: "International_CM", label: "International CM", visible: true, sortable: false },
];

// Parameter descriptions for help tooltips
const PARAMETER_DESCRIPTIONS: Record<string, { description: string; highMeans: string }> = {
  HHI: {
    description: "Market Concentration - Measures market concentration and competition intensity",
    highMeans: "• High = Concentrated market with few dominant players (LESS attractive - harder to compete)\n• Medium = Moderately concentrated market\n• Low = Competitive market with many players (MORE attractive - easier entry)"
  },
  Economic_Growth: {
    description: "Economic Growth Rate - Measures the pace of economic expansion in the MSA",
    highMeans: "• High = Strong economic growth (MORE attractive - expanding opportunity)\n• Medium = Moderate growth\n• Low = Slower growth (LESS attractive - limited expansion)"
  },
  Loan_Growth: {
    description: "Loan Growth Rate - Measures the rate at which lending volume is growing",
    highMeans: "• High = Strong loan growth (MORE attractive - increasing demand)\n• Medium = Moderate loan growth\n• Low = Slower loan growth (LESS attractive - stagnant market)"
  },
  Risk: {
    description: "Weighted Average Credit Risk - Overall credit risk profile of the market",
    highMeans: "• High = Higher risk loans (may offer better returns but more defaults)\n• Medium = Moderate risk profile\n• Low = Lower risk loans (safer but lower returns)"
  },
  Risk_Migration: {
    description: "1-Year Credit Risk Migration - Rate at which credit quality is changing over time",
    highMeans: "• High = Credit quality deteriorating rapidly (LESS attractive - increasing defaults)\n• Medium = Moderate changes in credit quality\n• Low = Credit quality stable or improving (MORE attractive - healthier market)"
  },
  Relative_Risk_Migration: {
    description: "Relative Risk Migration - Market's risk migration compared to national average",
    highMeans: "• Below National = Better than average credit trends (MORE attractive)\n• At National = Average credit trends\n• Above National = Worse than average credit trends (LESS attractive)"
  },
  Premium_Discount: {
    description: "Premium / Discount Loan Pricing - Pricing level relative to risk-adjusted returns",
    highMeans: "• Premium = Pricing above fair value (LESS attractive - overpriced market)\n• Par = Pricing at fair value\n• Discount = Pricing below fair value (MORE attractive - underpriced opportunity)"
  },
  Pricing_Rationality: {
    description: "Loan Pricing Rationality - Whether market pricing appropriately reflects underlying risk",
    highMeans: "• Rational = Pricing matches risk levels (MORE attractive - predictable market)\n• Irrational = Pricing disconnected from risk (LESS attractive - unpredictable returns)"
  },
  International_CM: {
    description: "International Cash Management - Size of international cash management opportunities",
    highMeans: "• High = Large international CM opportunity (MORE attractive - significant revenue potential)\n• Medium = Moderate opportunity size\n• Low = Small opportunity (LESS attractive - limited revenue potential)"
  }
};

// Category preferences for Simple Mode
interface CategoryPreferences {
  HHI: string;
  Economic_Growth: string;
  Loan_Growth: string;
  Risk: string;
  Risk_Migration: string;
  Relative_Risk_Migration: string;
  Premium_Discount: string;
  Pricing_Rationality: string;
  International_CM: string;
}

// Bucket Mode - Parameter importance buckets (types imported from utils/scoreCalculation)

interface ParameterInfo {
  id: keyof Weights;
  label: string;
  description: string;
  valueOptions: string[]; // Available values for this parameter
  isInverse?: boolean; // For scoring direction
}

const AVAILABLE_PARAMETERS: ParameterInfo[] = [
  { 
    id: "HHI", 
    label: "Market Concentration", 
    description: "Lower is better", 
    valueOptions: ["Low", "Medium", "High"],
    isInverse: true 
  },
  { 
    id: "Economic_Growth", 
    label: "Economic Growth", 
    description: "Higher is better", 
    valueOptions: ["High", "Medium", "Low"] 
  },
  { 
    id: "Loan_Growth", 
    label: "Loan Growth", 
    description: "Higher is better", 
    valueOptions: ["High", "Medium", "Low"] 
  },
  { 
    id: "Risk", 
    label: "Weighted Average Credit Risk", 
    description: "Higher is riskier", 
    valueOptions: ["High", "Medium", "Low"],
    isInverse: true 
  },
  { 
    id: "Risk_Migration", 
    label: "1-Year Credit Risk Migration", 
    description: "Lower is better", 
    valueOptions: ["Low", "Medium", "High"],
    isInverse: true 
  },
  { 
    id: "Relative_Risk_Migration", 
    label: "Relative Risk Migration", 
    description: "Below National Avg is best, Above National Avg is worst", 
    valueOptions: ["Below National Avg", "At National Avg", "Above National Avg"],
    isInverse: true 
  },
  { 
    id: "Premium_Discount", 
    label: "Premium / Discount Loan Pricing", 
    description: "Premium is better", 
    valueOptions: ["Premium", "Par", "Discount"] 
  },
  { 
    id: "Pricing_Rationality", 
    label: "Loan Pricing Rationality", 
    description: "Rational is better", 
    valueOptions: ["Rational", "Irrational"] 
  },
  { 
    id: "International_CM", 
    label: "International CM", 
    description: "Higher is better", 
    valueOptions: ["High", "Medium", "Low"] 
  },
];

// DEFAULT_BUCKET_ASSIGNMENTS is now imported from utils/scoreCalculation
// getRegionFromCoordinates is now imported from utils/applyGlobalFilters

const DEFAULT_CATEGORIES: CategoryPreferences = {
  HHI: "Any",
  Economic_Growth: "Any",
  Loan_Growth: "Any",
  Risk: "Any",
  Risk_Migration: "Any",
  Relative_Risk_Migration: "Any",
  Premium_Discount: "Any",
  Pricing_Rationality: "Any",
  International_CM: "Any",
};

// Convert category preferences to weights
const convertCategoriesToWeights = (categories: CategoryPreferences): Weights => {
  const getCategoryPoints = (category: string, isInverse: boolean = false, isPremiumDiscount: boolean = false, isPricingRationality: boolean = false): number => {
    if (category === "Any") return 0;
    if (isInverse) {
      // For inverse scoring (HHI, Risk Migration, Relative Risk Migration): Low is good, High is bad
      if (category === "Low") return 3;
      if (category === "Medium") return 2;
      if (category === "High") return 1;
      // For Relative Risk Migration
      if (category === "Below National Avg" || category === "Below National") return 3;
      if (category === "At National Avg" || category === "At National") return 2;
      if (category === "Above National Avg" || category === "Above National") return 1;
      return 0;
    }
    if (isPremiumDiscount) {
      if (category === "Premium") return 3;
      if (category === "Par") return 2;
      if (category === "Discount") return 1;
      return 0;
    }
    if (isPricingRationality) {
      if (category === "Rational") return 3;
      if (category === "Irrational") return 1;
      return 0;
    }
    // Standard scoring: High is good
    if (category === "High") return 3;
    if (category === "Medium") return 2;
    if (category === "Low") return 1;
    return 0;
  };

  const points = {
    HHI: getCategoryPoints(categories.HHI, true), // HHI is inverse
    Economic_Growth: getCategoryPoints(categories.Economic_Growth),
    Loan_Growth: getCategoryPoints(categories.Loan_Growth),
    Risk: getCategoryPoints(categories.Risk),
    Risk_Migration: getCategoryPoints(categories.Risk_Migration, true), // Inverse
    Relative_Risk_Migration: getCategoryPoints(categories.Relative_Risk_Migration, true), // Inverse
    Premium_Discount: getCategoryPoints(categories.Premium_Discount, false, true),
    Pricing_Rationality: getCategoryPoints(categories.Pricing_Rationality, false, false, true),
    International_CM: getCategoryPoints(categories.International_CM),
  };

  const totalPoints = Object.values(points).reduce((sum, p) => sum + p, 0);
  
  if (totalPoints === 0) {
    return DEFAULT_WEIGHTS;
  }

  const weights: Weights = {
    HHI: Math.round((points.HHI / totalPoints) * 100),
    Economic_Growth: Math.round((points.Economic_Growth / totalPoints) * 100),
    Loan_Growth: Math.round((points.Loan_Growth / totalPoints) * 100),
    Risk: Math.round((points.Risk / totalPoints) * 100),
    Risk_Migration: Math.round((points.Risk_Migration / totalPoints) * 100),
    Relative_Risk_Migration: Math.round((points.Relative_Risk_Migration / totalPoints) * 100),
    Premium_Discount: Math.round((points.Premium_Discount / totalPoints) * 100),
    Pricing_Rationality: Math.round((points.Pricing_Rationality / totalPoints) * 100),
    International_CM: Math.round((points.International_CM / totalPoints) * 100),
  };

  const actualTotal = Object.values(weights).reduce((sum, w) => sum + w, 0);
  const diff = 100 - actualTotal;
  if (diff !== 0) {
    weights.HHI += diff;
  }

  return weights;
};

// Helper to get score value based on selected value direction
const getScoreForValue = (actualValue: string, selectedValue: string, parameterId: string): number => {
  const normalized = actualValue?.toLowerCase() || "";
  const selected = selectedValue?.toLowerCase() || "";
  
  // For parameters with High/Medium/Low
  if (["high", "medium", "low"].includes(selected)) {
    // Score based on how close to the selected value
    if (normalized === selected) return 3;
    if (normalized === "medium") return 2;
    if ((selected === "high" && normalized === "medium") || 
        (selected === "low" && normalized === "medium")) return 2;
    if ((selected === "high" && normalized === "low") || 
        (selected === "low" && normalized === "high")) return 1;
    return 1;
  }
  
  // For Relative Risk Migration - check if it contains "national" to identify this parameter type
  if (selected.includes("national")) {
    // Handle exact matches for "Below National Avg", "At National Avg", "Above National Avg"
    if (normalized.includes("below") && selected.includes("below")) return 3;
    if (normalized.includes("at") && selected.includes("at")) return 3;
    if (normalized.includes("above") && selected.includes("above")) return 3;
    // Secondary matches
    if (normalized === "at_national" || normalized === "at national") return 2;
    return 1;
  }
  
  // For Premium/Discount
  if (["premium", "par", "discount"].includes(selected)) {
    if (normalized === selected) return 3;
    if (normalized === "par") return 2;
    return 1;
  }
  
  // For Pricing Rationality
  if (["rational", "irrational"].includes(selected)) {
    if (normalized === selected) return 3;
    return 1;
  }
  
  return 0;
};

// Calculate score using bucket mode with value preferences (DEPRECATED - use imported one from scoreCalculation.ts)
// This function is kept for backward compatibility but should not be used
const calculateBucketModeScoreLocal = (row: any, assignments: BucketAssignment[], weights: Weights, bucketWeightsPct: { high: number; medium: number }): number => {
  // Ensure bucketWeightsPct is always defined
  const safeBucketWeights = bucketWeightsPct && typeof bucketWeightsPct === 'object' && 'high' in bucketWeightsPct && 'medium' in bucketWeightsPct
    ? bucketWeightsPct
    : { high: 60, medium: 40 };
    
  if (assignments.length === 0) {
    return calculateAttractivenessScore(row, weights);
  }

  // Convert bucket weights from percentages to decimals (exclusions always 0)
  const total = safeBucketWeights.high + safeBucketWeights.medium;
  const BUCKET_WEIGHTS = {
    high: safeBucketWeights.high / total,
    medium: safeBucketWeights.medium / total,
    exclusions: 0,  // Excluded parameters don't contribute to score
  };

  // Position weight decay factor - very small so items stay nearly equal
  const POSITION_DECAY = 0.02;

  // Group assignments by bucket (exclusions are ignored in scoring)
  const bucketGroups = {
    high: assignments.filter(a => a.bucket === "high").sort((a, b) => a.position - b.position),
    medium: assignments.filter(a => a.bucket === "medium").sort((a, b) => a.position - b.position),
  };

  let totalScore = 0;

  // Calculate contribution from each bucket (exclusions bucket is skipped)
  Object.entries(bucketGroups).forEach(([bucket, items]) => {
    if (items.length === 0) return;

    const bucketWeight = BUCKET_WEIGHTS[bucket as "high" | "medium"];
    const numItems = items.length;

    // Calculate position-weighted average for this bucket
    let weightedSum = 0;
    let totalPositionWeight = 0;

    items.forEach((assignment, idx) => {
      const paramId = assignment.parameterId;
      const scoreFieldName = `${paramId}_Score`;
      const actualValue = row[scoreFieldName];
      
      // Get match score (1-3) based on how well this MSA matches the desired value
      const matchScore = getScoreForValue(actualValue, assignment.selectedValue, paramId);
      
      // Position weight: first item gets 1.0, second gets (1.0 - decay), etc.
      const positionWeight = 1.0 - (idx * POSITION_DECAY);
      
      weightedSum += matchScore * positionWeight;
      totalPositionWeight += positionWeight;
    });

    // Average match score for this bucket (value between 1-3)
    const bucketAverageScore = weightedSum / totalPositionWeight;

    // Contribution = bucket average × bucket weight
    totalScore += bucketAverageScore * bucketWeight;
  });

  return Math.round(totalScore * 100) / 100;
};

// Convert bucket assignments to weights with position-based weighting
const convertBucketsToWeights = (assignments: BucketAssignment[], bucketWeightsPct: { high: number; medium: number }): Weights => {
  if (assignments.length === 0) {
    return DEFAULT_WEIGHTS;
  }

  // Use dynamic bucket weights (exclusions always gets 0)
  const BUCKET_WEIGHTS = {
    high: bucketWeightsPct.high,
    medium: bucketWeightsPct.medium,
    exclusions: 0,
  };

  // Group assignments by bucket (exclusions are not weighted)
  const bucketGroups = {
    high: assignments.filter(a => a.bucket === "high").sort((a, b) => a.position - b.position),
    medium: assignments.filter(a => a.bucket === "medium").sort((a, b) => a.position - b.position),
  };

  // Initialize all weights to 0
  const weights: Weights = {
    HHI: 0,
    Economic_Growth: 0,
    Loan_Growth: 0,
    Risk: 0,
    Risk_Migration: 0,
    Relative_Risk_Migration: 0,
    Premium_Discount: 0,
    Pricing_Rationality: 0,
    International_CM: 0,
  };

  // Calculate weights for each bucket (exclusions are skipped)
  Object.entries(bucketGroups).forEach(([bucket, items]) => {
    if (items.length === 0) return;

    const bucketWeight = BUCKET_WEIGHTS[bucket as "high" | "medium"];
    const numItems = items.length;

    if (numItems === 1) {
      // If only one item in bucket, it gets the full bucket weight
      const param = items[0].parameterId as keyof Weights;
      weights[param] = bucketWeight;
    } else {
      // Multiple items: distribute almost evenly with very slight position preference
      // Use a small decay factor so items are nearly equal but maintain order
      // Formula: weight(i) = 1.0 + (numItems - i - 1) * 0.02
      // This gives: [1.02, 1.0] for 2 items (51%/49% split), [1.04, 1.02, 1.0] for 3 items, etc.
      const positionWeights = items.map((_, idx) => 1.0 + (numItems - idx - 1) * 0.02);
      const totalPositionWeight = positionWeights.reduce((sum, w) => sum + w, 0);

      // Distribute bucket weight among items based on position
      items.forEach((assignment, idx) => {
        const param = assignment.parameterId as keyof Weights;
        const itemWeight = (bucketWeight * positionWeights[idx]) / totalPositionWeight;
        weights[param] = Math.round(itemWeight * 100) / 100; // Round to 2 decimals
      });
    }
  });

  // Adjust for rounding errors to ensure total is 100%
  const actualTotal = Object.values(weights).reduce((sum, w) => sum + w, 0);
  const diff = 100 - actualTotal;
  if (Math.abs(diff) > 0.01 && assignments.length > 0) {
    // Only adjust high/medium bucket items, not exclusions
    const firstNonExcludedAssignment = assignments.find(a => a.bucket !== "exclusions");
    if (firstNonExcludedAssignment) {
      const firstParam = firstNonExcludedAssignment.parameterId as keyof Weights;
      weights[firstParam] = Math.round((weights[firstParam] + diff) * 100) / 100;
    }
  }

  return weights;
};

// Clickable Parameter Card for Bucket Mode - Opens value selection dialog
interface ParameterCardProps {
  parameter: ParameterInfo;
  onValueSelected: (parameterId: string, value: string) => void;
  usedValues: Set<string>; // Track which parameter-value combos are already assigned
}

const ParameterCard = ({ parameter, onValueSelected, usedValues }: ParameterCardProps) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Get help information from PARAMETER_DESCRIPTIONS
  const paramKey = parameter.id.replace(/_(Score)?$/, '');
  const helpInfo = PARAMETER_DESCRIPTIONS[paramKey];

  const handleValueSelect = (value: string) => {
    onValueSelected(parameter.id, value);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div
          className="p-3 rounded-lg border-2 cursor-pointer transition-all bg-card border-border hover:border-primary hover:shadow-md"
        >
          <div className="flex items-start gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium">{parameter.label}</p>
                {helpInfo && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-md">
                        <div className="space-y-2">
                          <p className="font-medium">{helpInfo.description}</p>
                          <div className="text-xs text-muted-foreground whitespace-pre-line">{helpInfo.highMeans}</div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{parameter.description}</p>
            </div>
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div>
            <h4 className="font-medium text-sm mb-1">Select Target Value</h4>
            <p className="text-xs text-muted-foreground">Choose the value you want to prioritize</p>
          </div>
          
          {helpInfo && (
            <div className="p-2 rounded-md bg-muted/50 border text-xs space-y-1">
              <p className="font-medium text-foreground">{helpInfo.description}</p>
              <div className="text-muted-foreground whitespace-pre-line">{helpInfo.highMeans}</div>
            </div>
          )}
          
          <div className="space-y-1">
            {parameter.valueOptions.map(value => {
              const comboKey = `${parameter.id}-${value}`;
              const isUsed = usedValues.has(comboKey);
              return (
                <Button
                  key={value}
                  variant={isUsed ? "outline" : "secondary"}
                  className="w-full justify-start"
                  onClick={() => handleValueSelect(value)}
                  disabled={isUsed}
                >
                  {value}
                  {isUsed && <span className="ml-auto text-xs text-muted-foreground">(In use)</span>}
                </Button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// Draggable Parameter-Value Item (created after value selection)
interface DraggableParameterValueProps {
  assignment: BucketAssignment;
  paramLabel: string;
  onRemove?: () => void;
}

const DraggableParameterValue = ({ assignment, paramLabel, onRemove }: DraggableParameterValueProps) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'parameter-value',
    item: { 
      parameterId: assignment.parameterId, 
      selectedValue: assignment.selectedValue,
      // Don't set fromBucket for items in staging area (undefined means it's new)
      fromBucket: undefined,
      fromPosition: undefined
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  return (
    <div
      ref={drag}
      className={`p-2 rounded bg-card border flex items-center justify-between group cursor-move transition-all ${
        isDragging ? 'opacity-50 scale-95' : 'opacity-100'
      }`}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{paramLabel}</p>
          <p className="text-xs text-muted-foreground truncate">{assignment.selectedValue}</p>
        </div>
      </div>
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-2 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

// Drop Bucket for Bucket Mode with reordering support
interface DropBucketProps {
  bucket: ImportanceBucket;
  title: string;
  description: string;
  color: string;
  assignments: BucketAssignment[];
  bucketWeight: number;
  onWeightChange: (newWeight: number) => void;
  onDrop: (parameterId: string, selectedValue: string, bucket: ImportanceBucket, position?: number) => void;
  onRemove: (parameterId: string, selectedValue: string) => void;
  onReorder: (parameterId: string, selectedValue: string, newPosition: number, newBucket: ImportanceBucket) => void;
}

const DropBucket = ({ bucket, title, description, color, assignments, bucketWeight, onWeightChange, onDrop, onRemove, onReorder }: DropBucketProps) => {
  const [{ isOver }, drop] = useDrop({
    accept: 'parameter-value',
    drop: (item: { parameterId: string; selectedValue: string; fromBucket?: ImportanceBucket; fromPosition?: number }, monitor) => {
      // If dropping from another bucket or from selection, add to end
      if (!item.fromBucket || item.fromBucket !== bucket) {
        onDrop(item.parameterId, item.selectedValue, bucket);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  const bucketParameters = assignments
    .filter(a => a.bucket === bucket)
    .sort((a, b) => a.position - b.position);

  const moveItem = (dragIndex: number, hoverIndex: number) => {
    if (dragIndex === hoverIndex) return;
    const item = bucketParameters[dragIndex];
    onReorder(item.parameterId, item.selectedValue, hoverIndex, bucket);
  };

  return (
    <div
      ref={drop}
      className={`p-4 rounded-lg border-2 min-h-[200px] transition-all ${
        isOver ? 'border-primary bg-primary/5 scale-[1.02]' : `${color} border-dashed`
      }`}
    >
      <div className="mb-3 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">{title}</h4>
          {bucket !== "exclusions" && (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                max="100"
                value={bucketWeight}
                onChange={(e) => onWeightChange(parseInt(e.target.value) || 0)}
                className="w-16 h-7 text-xs text-center"
              />
              <span className="text-xs">%</span>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-2">
        {bucketParameters.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Select a parameter value and drag here
          </div>
        ) : (
          bucketParameters.map((assignment, index) => {
            const param = AVAILABLE_PARAMETERS.find(p => p.id === assignment.parameterId);
            return param ? (
              <DraggableParameterValueInBucket
                key={`${assignment.parameterId}-${assignment.selectedValue}`}
                assignment={assignment}
                paramLabel={param.label}
                index={index}
                moveItem={moveItem}
                onRemove={() => onRemove(assignment.parameterId, assignment.selectedValue)}
              />
            ) : null;
          })
        )}
      </div>
    </div>
  );
};

// Draggable item within a bucket with hover reordering
interface DraggableParameterValueInBucketProps {
  assignment: BucketAssignment;
  paramLabel: string;
  index: number;
  moveItem: (dragIndex: number, hoverIndex: number) => void;
  onRemove: () => void;
}

const DraggableParameterValueInBucket = ({ assignment, paramLabel, index, moveItem, onRemove }: DraggableParameterValueInBucketProps) => {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: 'parameter-value',
    item: { 
      parameterId: assignment.parameterId, 
      selectedValue: assignment.selectedValue,
      fromBucket: assignment.bucket,
      fromPosition: assignment.position,
      index
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: 'parameter-value',
    hover: (item: { parameterId: string; selectedValue: string; fromBucket: ImportanceBucket; index: number }) => {
      if (!ref.current) return;
      if (item.fromBucket !== assignment.bucket) return; // Only reorder within same bucket
      
      const dragIndex = item.index;
      const hoverIndex = index;

      if (dragIndex === hoverIndex) return;

      moveItem(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  drag(drop(ref));

  return (
    <div
      ref={ref}
      className={`p-2 rounded bg-card border flex items-center justify-between group cursor-move transition-all ${
        isDragging ? 'opacity-50' : 'opacity-100'
      } ${isOver ? 'border-primary' : ''}`}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{index + 1}</Badge>
            <p className="text-sm font-medium truncate">{paramLabel}</p>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{assignment.selectedValue}</p>
        </div>
      </div>
      <button
        onClick={onRemove}
        className="ml-2 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

// Draggable Header Cell Component
interface DraggableHeaderCellProps {
  column: ColumnConfig;
  index: number;
  moveColumn: (fromIndex: number, toIndex: number) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
}

const DraggableHeaderCell = ({ column, index, moveColumn, sortField, sortDirection, onSort }: DraggableHeaderCellProps) => {
  const ref = useRef<HTMLTableCellElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: 'column',
    item: { index },
    canDrag: !column.fixed,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: 'column',
    hover: (item: { index: number }) => {
      if (item.index !== index && !column.fixed) {
        moveColumn(item.index, index);
        item.index = index;
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  drag(drop(ref));

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => onSort(field)}
      className="flex items-center gap-1 hover:text-foreground/80 transition-colors w-full"
    >
      {children}
      <ArrowUpDown className={`h-3 w-3 ${sortField === field ? "text-primary" : "text-muted-foreground"}`} />
    </button>
  );

  return (
    <th
      ref={ref}
      className={`text-foreground h-10 px-2 text-${column.id === 'MSA' ? 'left' : 'center'} align-middle font-medium whitespace-nowrap ${column.minWidth ? `min-w-[${column.minWidth}]` : ''} ${
        isDragging ? 'opacity-50' : ''
      } ${isOver ? 'bg-muted/50' : ''} ${column.fixed ? '' : 'cursor-move'}`}
      style={{ minWidth: column.minWidth }}
    >
      <div className="flex items-center gap-1">
        {!column.fixed && <GripVertical className="h-3 w-3 text-muted-foreground" />}
        {column.sortable ? (
          <SortButton field={column.id as SortField}>{column.label}</SortButton>
        ) : (
          <span>{column.label}</span>
        )}
      </div>
    </th>
  );
};

export function WhatIfAnalysis({ 
  data, 
  weights, 
  setWeights,
  bucketAssignments,
  setBucketAssignments,
  bucketWeights = { high: 60, medium: 40 },
  setBucketWeights,
  globalFilters,
  setGlobalFilters,
  resetGlobalFilters 
}: WhatIfAnalysisProps) {
  const [sortField, setSortField] = useState<SortField>("MSA");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [mode, setMode] = useState<"simple" | "advanced" | "bucket">("bucket");
  const [categoryPreferences, setCategoryPreferences] = useState<CategoryPreferences>(DEFAULT_CATEGORIES);
  const [isCalculating, setIsCalculating] = useState(false);
  
  // Column configuration state
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  
  // selectedParameterValues is just UI state, can remain local
  const [selectedParameterValues, setSelectedParameterValues] = useState<Array<{ parameterId: string; selectedValue: string; }>>([]);
  
  // Local filter states (MSA search and category filters are page-specific)
  const [msaFilter, setMsaFilter] = useState("");
  const [oldCategoryFilter, setOldCategoryFilter] = useState<string>("all");
  const [newCategoryFilter, setNewCategoryFilter] = useState<string>("all");
  
  // Bucket data from backend
  const [marketSizeBuckets, setMarketSizeBuckets] = useState<FilterBucketData | null>(null);
  const [revenuePerCompanyBuckets, setRevenuePerCompanyBuckets] = useState<FilterBucketData | null>(null);
  const [bucketsLoading, setBucketsLoading] = useState(true);

  // Toggle states for collapsible sections
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showScoreComparison, setShowScoreComparison] = useState(false); // Hidden by default, can be toggled with eye icon

  // Calculate total weight percentage (with NaN safety)
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + (isNaN(w) ? 0 : w), 0);
  const totalBucketWeight = bucketWeights.high + bucketWeights.medium;
  
  // Fetch bucket data from backend and initialize slider ranges
  useEffect(() => {
    const fetchBuckets = async () => {
      try {
        setBucketsLoading(true);
        const data = await fetchFilterBuckets();
        setMarketSizeBuckets(data.marketSize);
        setRevenuePerCompanyBuckets(data.revenuePerCompany);
        
        // Initialize slider ranges to full range if not already set
        if (data.marketSize?.range && globalFilters.marketSizeRange[0] === 0 && globalFilters.marketSizeRange[1] === 0) {
          setGlobalFilters({
            ...globalFilters,
            marketSizeRange: [data.marketSize.range.min, data.marketSize.range.max],
            revenuePerCompanyRange: data.revenuePerCompany?.range 
              ? [data.revenuePerCompany.range.min, data.revenuePerCompany.range.max]
              : [0, 0]
          });
        }
      } catch (error) {
        console.error("Error fetching filter buckets:", error);
      } finally {
        setBucketsLoading(false);
      }
    };

    fetchBuckets();
  }, []);

  // Show calculating indicator when weights change
  useEffect(() => {
    setIsCalculating(true);
    const timer = setTimeout(() => setIsCalculating(false), 100);
    return () => clearTimeout(timer);
  }, [weights]);

  // Update a specific weight
  const updateWeight = (key: keyof Weights, value: number) => {
    setWeights({ ...weights, [key]: value });
  };

  // Update a specific category preference and immediately apply
  const updateCategory = (key: keyof CategoryPreferences, value: string) => {
    const updatedCategories = { ...categoryPreferences, [key]: value };
    setCategoryPreferences(updatedCategories);
    
    // Automatically convert to weights and apply in real-time
    const newWeights = convertCategoriesToWeights(updatedCategories);
    setWeights(newWeights);
  };

  // Apply category preferences (convert to weights) - kept for backward compatibility
  const applyCategoryPreferences = () => {
    const newWeights = convertCategoriesToWeights(categoryPreferences);
    setWeights(newWeights);
  };

  // Reset to default bucket assignments
  const resetToOriginal = () => {
    setBucketAssignments(DEFAULT_BUCKET_ASSIGNMENTS);
  };

  // Apply new weights (keep current weights but recalculate)
  const applyWeights = () => {
    // Weights are always applied automatically via calculatedMapData
  };

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Column management functions
  const moveColumn = (fromIndex: number, toIndex: number) => {
    const newColumns = [...columns];
    const [movedColumn] = newColumns.splice(fromIndex, 1);
    newColumns.splice(toIndex, 0, movedColumn);
    setColumns(newColumns);
  };

  const toggleColumnVisibility = (columnId: string) => {
    setColumns(columns.map(col => 
      col.id === columnId ? { ...col, visible: !col.visible } : col
    ));
  };

  const resetColumns = () => {
    setColumns(DEFAULT_COLUMNS);
  };

  // Bucket mode handlers
  const handleValueSelected = (parameterId: string, value: string) => {
    // Add to selected items that can be dragged
    setSelectedParameterValues(prev => [...prev, { parameterId, selectedValue: value }]);
  };

  const handleDropParameter = (parameterId: string, selectedValue: string, bucket: ImportanceBucket, insertPosition?: number) => {
    // Remove from selected items (staging area)
    setSelectedParameterValues(prev => 
      prev.filter(item => !(item.parameterId === parameterId && item.selectedValue === selectedValue))
    );

    // Remove this param-value combo from any existing bucket (in case it's being moved)
    const filtered = bucketAssignments.filter(
      a => !(a.parameterId === parameterId && a.selectedValue === selectedValue)
    );

    // Get current items in target bucket to determine position
    const bucketItems = filtered.filter(a => a.bucket === bucket);
    const position = insertPosition !== undefined ? insertPosition : bucketItems.length;

    // Reindex positions in all buckets
    const reindexedByBucket: Record<ImportanceBucket, BucketAssignment[]> = {
      high: [],
      medium: [],
      exclusions: []
    };

    filtered.forEach(a => {
      reindexedByBucket[a.bucket].push(a);
    });

    // Add new item to target bucket
    reindexedByBucket[bucket].splice(position, 0, { parameterId, selectedValue, bucket, position: 0 });

    // Flatten and assign positions
    const newAssignments: BucketAssignment[] = [];
    (Object.keys(reindexedByBucket) as ImportanceBucket[]).forEach(bucketKey => {
      reindexedByBucket[bucketKey].forEach((item, idx) => {
        newAssignments.push({ ...item, bucket: bucketKey, position: idx });
      });
    });

    setBucketAssignments(newAssignments);
  };

  const handleRemoveParameter = (parameterId: string, selectedValue: string) => {
    const newAssignments = bucketAssignments.filter(
      a => !(a.parameterId === parameterId && a.selectedValue === selectedValue)
    );
    
    // Reindex positions in each bucket
    const reindexed = newAssignments.map((a, idx) => {
      const bucketItems = newAssignments.filter(item => item.bucket === a.bucket);
      const position = bucketItems.findIndex(item => 
        item.parameterId === a.parameterId && item.selectedValue === a.selectedValue
      );
      return { ...a, position };
    });
    
    setBucketAssignments(reindexed);
  };

  const handleReorderParameter = (parameterId: string, selectedValue: string, newPosition: number, bucket: ImportanceBucket) => {
    const assignment = bucketAssignments.find(
      a => a.parameterId === parameterId && a.selectedValue === selectedValue
    );
    
    if (!assignment || assignment.bucket !== bucket) return;

    const bucketItems = bucketAssignments
      .filter(a => a.bucket === bucket)
      .sort((a, b) => a.position - b.position);

    const oldPosition = bucketItems.findIndex(
      a => a.parameterId === parameterId && a.selectedValue === selectedValue
    );

    if (oldPosition === -1 || oldPosition === newPosition) return;

    // Reorder within bucket
    const reordered = [...bucketItems];
    const [movedItem] = reordered.splice(oldPosition, 1);
    reordered.splice(newPosition, 0, movedItem);

    // Update positions
    const updatedBucketItems = reordered.map((item, idx) => ({ ...item, position: idx }));

    // Merge with items from other buckets
    const otherBucketItems = bucketAssignments.filter(a => a.bucket !== bucket);
    const newAssignments = [...otherBucketItems, ...updatedBucketItems];

    setBucketAssignments(newAssignments);
  };

  const clearAllBuckets = () => {
    setBucketAssignments([]); // Remove all parameters from boxes
    setSelectedParameterValues([]);
  };

  const applyDefaultParameters = () => {
    setBucketAssignments(DEFAULT_BUCKET_ASSIGNMENTS);
  };

  // Get unique values for filters - Product filter removed

  // Calculate new scores and categories
  const enrichedData = useMemo(() => {
    // Calculate baseline scores using DEFAULT_BUCKET_ASSIGNMENTS (constant, never changes)
    // Calculate current scores using CURRENT bucket assignments (changes when user modifies parameters)
    console.log('WhatIfAnalysis: enrichedData - data length:', data.length);
    if (data.length > 0) {
      console.log('WhatIfAnalysis: Sample row:', {
        MSA: data[0].MSA,
        Attractiveness_Score: data[0].Attractiveness_Score,
        Attractiveness_Category: data[0].Attractiveness_Category
      });
    }
    
    // Calculate baseline using DEFAULT_BUCKET_ASSIGNMENTS with default bucket weights
    const baselineScores = data.map((row, index) => ({
      ...row,
      baselineScore: calculateBucketModeScore(row, DEFAULT_BUCKET_ASSIGNMENTS, { high: 60, medium: 40 }),
      originalIndex: index,
    }));
    
    // Calculate baseline categories
    const baselineScoreData = baselineScores.map((row, index) => ({
      score: row.baselineScore,
      index,
    }));
    const baselineCategories = getCategoriesByQuartiles(baselineScoreData);
    
    // Calculate current scores using CURRENT bucket assignments and bucket weights
    const currentBucketWeights = bucketWeights || { high: 60, medium: 40 };
    const dataWithCurrentScores = baselineScores.map((row, index) => {
      // Use the EXACT same calculation as Score Breakdown Dialog
      const currentBucketAssignments = bucketAssignments || DEFAULT_BUCKET_ASSIGNMENTS;
      const calculatedScore = calculateBucketModeScore(row, currentBucketAssignments, currentBucketWeights);
      
      // Debug Charlotte specifically
      if (row.MSA && row.MSA.includes('Charlotte')) {
        console.log('WhatIfAnalysis enrichedData: Charlotte calculatedScore:', calculatedScore, 'using assignments:', currentBucketAssignments.length, 'weights:', currentBucketWeights);
      }
      
      return {
        ...row,
        calculatedScore: calculatedScore,
        baselineCategory: baselineCategories[index],
      };
    });
    
    // Calculate current categories based on current scores
    const currentScoreData = dataWithCurrentScores.map((row, index) => ({
      score: row.calculatedScore,
      index,
    }));
    const calculatedCategories = getCategoriesByQuartiles(currentScoreData);
    
    return dataWithCurrentScores.map((row, index) => ({
      ...row,
      calculatedCategory: calculatedCategories[index],
      scoreDelta: row.calculatedScore - row.baselineScore,
    }));
  }, [data, bucketAssignments, bucketWeights]);

  // Apply filters
  const filteredData = useMemo(() => {
    console.log('WhatIfAnalysis: Filtering enrichedData, length:', enrichedData.length);
    const filtered = enrichedData.filter((row) => {
      const matchesMSA = !msaFilter || row.MSA.toLowerCase().includes(msaFilter.toLowerCase());
      const matchesOldCategory = oldCategoryFilter === "all" || row.baselineCategory === oldCategoryFilter;
      const matchesNewCategory = newCategoryFilter === "all" || row.calculatedCategory === newCategoryFilter;
      
      // Market Size slider filter
      let matchesMarketSize = true;
      if (marketSizeBuckets?.range) {
        const value = row["Market Size"];
        // Treat [0, 0] as "not initialized" and skip filtering
        const isNotInitialized = globalFilters.marketSizeRange[0] === 0 && globalFilters.marketSizeRange[1] === 0;
        const isFullRange = globalFilters.marketSizeRange[0] === marketSizeBuckets.range.min && 
                           globalFilters.marketSizeRange[1] === marketSizeBuckets.range.max;
        if (!isFullRange && !isNotInitialized) {
          matchesMarketSize = value !== undefined && value !== null && 
            value >= globalFilters.marketSizeRange[0] && value <= globalFilters.marketSizeRange[1];
        }
      }
      
      // Revenue per Company slider filter
      let matchesRevenuePerCompany = true;
      if (revenuePerCompanyBuckets?.range) {
        const value = row["Revenue per Company"];
        // Treat [0, 0] as "not initialized" and skip filtering
        const isNotInitialized = globalFilters.revenuePerCompanyRange[0] === 0 && globalFilters.revenuePerCompanyRange[1] === 0;
        const isFullRange = globalFilters.revenuePerCompanyRange[0] === revenuePerCompanyBuckets.range.min && 
                           globalFilters.revenuePerCompanyRange[1] === revenuePerCompanyBuckets.range.max;
        if (!isFullRange && !isNotInitialized) {
          matchesRevenuePerCompany = value !== undefined && value !== null && 
            value >= globalFilters.revenuePerCompanyRange[0] && value <= globalFilters.revenuePerCompanyRange[1];
        }
      }
      
      // Geography filter - use MSA name mapping first, then fallback to coordinates
      let matchesRegion = true;
      if (globalFilters.selectedRegions.length > 0) {
        const msaName = row.MSA;
        const msaRegion = getRegionForMSASync(msaName, row.LAT, row.LON);
        matchesRegion = globalFilters.selectedRegions.includes(msaRegion);
      }
      
      // Industry filter (placeholder - always matches for now)
      let matchesIndustry = true;
      if (globalFilters.selectedIndustries.length > 0) {
        // Placeholder: will be implemented when industry data is available
        matchesIndustry = true;
      }
      
      // Exclusions filter - filter out MSAs that match excluded parameter values
      let passesExclusions = true;
      const exclusionAssignments = bucketAssignments.filter(a => a.bucket === "exclusions");
      if (exclusionAssignments.length > 0) {
        // Check if this MSA matches any exclusion criterion
        for (const exclusion of exclusionAssignments) {
          const paramId = exclusion.parameterId;
          const scoreFieldName = `${paramId}_Score`;
          const actualValue = row[scoreFieldName];
          
          // Normalize both values for comparison
          const normalizedActual = actualValue?.toLowerCase().replace(/ /g, "_") || "";
          const normalizedExcluded = exclusion.selectedValue.toLowerCase().replace(/ /g, "_");
          
          // If the MSA's value matches the excluded value, filter it out
          if (normalizedActual === normalizedExcluded) {
            passesExclusions = false;
            break;
          }
        }
      }
      
      return matchesMSA && matchesOldCategory && matchesNewCategory && 
             matchesMarketSize && matchesRevenuePerCompany && matchesRegion && matchesIndustry && passesExclusions;
    });
    console.log('WhatIfAnalysis: Filtered data length:', filtered.length);
    return filtered;
  }, [enrichedData, msaFilter, oldCategoryFilter, newCategoryFilter, globalFilters, 
      marketSizeBuckets, revenuePerCompanyBuckets, bucketAssignments]);

  // Calculate impact summary statistics
  const impactStats = useMemo(() => {
    const categoryCounts = {
      original: { "Highly Attractive": 0, Attractive: 0, Neutral: 0, Challenging: 0 },
      calculated: { "Highly Attractive": 0, Attractive: 0, Neutral: 0, Challenging: 0 },
    };
    
    let totalIncrease = 0;
    let totalDecrease = 0;
    let msasWithChanges = 0;
    
    enrichedData.forEach((row) => {
      // Use baselineCategory instead of database category
      const baselineCat = row.baselineCategory || row.Attractiveness_Category;
      categoryCounts.original[baselineCat as keyof typeof categoryCounts.original]++;
      categoryCounts.calculated[row.calculatedCategory as keyof typeof categoryCounts.calculated]++;
      
      if (row.scoreDelta > 0) totalIncrease++;
      if (row.scoreDelta < 0) totalDecrease++;
      if (Math.abs(row.scoreDelta) > 0.01) msasWithChanges++;
    });
    
    return {
      categoryCounts,
      totalIncrease,
      totalDecrease,
      msasWithChanges,
      avgScoreChange: enrichedData.reduce((sum, row) => sum + (isNaN(row.scoreDelta) ? 0 : row.scoreDelta), 0) / enrichedData.length,
    };
  }, [enrichedData]);

  // Apply sorting
  const sortedData = useMemo(() => {
    const sorted = [...filteredData];
    sorted.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortField) {
        case "MSA":
          aValue = a.MSA;
          bValue = b.MSA;
          break;
        case "originalScore":
          aValue = a.baselineScore;
          bValue = b.baselineScore;
          break;
        case "calculatedScore":
          aValue = a.calculatedScore;
          bValue = b.calculatedScore;
          break;
        case "scoreDelta":
          aValue = a.scoreDelta;
          bValue = b.scoreDelta;
          break;
        case "originalCategory":
          aValue = a.baselineCategory;
          bValue = b.baselineCategory;
          break;
        case "calculatedCategory":
          aValue = a.calculatedCategory;
          bValue = b.calculatedCategory;
          break;
        default:
          return 0;
      }

      if (typeof aValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    });

    return sorted;
  }, [filteredData, sortField, sortDirection]);

  // Score badge component
  const ScoreBadge = ({ score }: { score: string }) => {
    const getScoreColor = (score: string) => {
      const normalized = score?.toLowerCase() || "";
      
      // Handle High/Medium/Low
      if (normalized === "high") return "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700";
      if (normalized === "medium") return "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700";
      if (normalized === "low") return "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700";
      
      // Handle Relative Risk Migration values - Below is green (good), Above is red (bad), At is orange (neutral)
      if (normalized === "below_national" || normalized === "below national" || normalized === "below national avg") return "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700";
      if (normalized === "at_national" || normalized === "at national" || normalized === "at national avg") return "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700";
      if (normalized === "above_national" || normalized === "above national" || normalized === "above national avg") return "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700";
      
      // Handle Premium/Discount values (Premium is best)
      if (normalized === "premium") return "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700";
      if (normalized === "par") return "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700";
      if (normalized === "discount") return "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700";
      
      // Handle Pricing Rationality values - Overpriced is green (opportunity), Underpriced is red (risk)
      if (normalized === "rational") return "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700";
      if (normalized === "overpriced" || normalized === "overpriced (opportunity)") return "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700";
      if (normalized === "underpriced" || normalized === "underpriced (risk)") return "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700";
      if (normalized === "irrational") return "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700";
      
      return "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600";
    };

    return (
      <Badge variant="outline" className={`${getScoreColor(score)} border`}>
        {score || "N/A"}
      </Badge>
    );
  };

  // Category badge component
  const CategoryBadge = ({ category }: { category: string }) => {
    const getCategoryColor = (category: string) => {
      if (category === "Highly Attractive") return "bg-green-100 text-green-800 border-green-300";
      if (category === "Attractive") return "bg-yellow-100 text-yellow-800 border-yellow-300";
      if (category === "Neutral") return "bg-orange-100 text-orange-800 border-orange-300";
      return "bg-red-100 text-red-800 border-red-300";
    };

    return (
      <Badge variant="outline" className={`${getCategoryColor(category)} border`}>
        {category}
      </Badge>
    );
  };

  // Score Breakdown Dialog Component
  const ScoreBreakdownDialog = ({ row }: { row: any }) => {
    const [open, setOpen] = useState(false);
    
    // Ensure bucketWeights is always defined
    const safeBucketWeights = bucketWeights && typeof bucketWeights === 'object' && 'high' in bucketWeights && 'medium' in bucketWeights
      ? bucketWeights
      : { high: 60, medium: 40 };

    // Calculate breakdown based on current mode
    const getBreakdown = () => {
      // Double-check bucketWeights is safe
      const finalSafeBucketWeights = safeBucketWeights;
      
      if (mode === "bucket" && bucketAssignments.length > 0) {
        // Use EXACT same calculation as recalculateDataWithBuckets
        const currentBucketWeights = finalSafeBucketWeights;
        console.log('ScoreBreakdown: Using bucketWeights:', currentBucketWeights, 'for', row.MSA);
        
        // Verify bucketWeights is valid before calling
        if (!currentBucketWeights || typeof currentBucketWeights !== 'object' || !('high' in currentBucketWeights) || !('medium' in currentBucketWeights)) {
          console.error('ScoreBreakdown: Invalid bucketWeights, using defaults');
          return { buckets: [], totalScore: 0, mode: "bucket" };
        }
        
        // Verify what score we're breaking down - should match the displayed "New Score" (calculatedScore)
        const displayedScore = row.calculatedScore;
        console.log('ScoreBreakdown: Breaking down score for', row.MSA);
        console.log('ScoreBreakdown: Displayed New Score (calculatedScore):', displayedScore);
        console.log('ScoreBreakdown: Displayed Original Score (baselineScore):', row.baselineScore);
        console.log('ScoreBreakdown: Current bucketAssignments:', bucketAssignments.length, 'items');
        console.log('ScoreBreakdown: Current bucketWeights:', currentBucketWeights);
        
        // Recalculate to verify it matches
        const recalculatedScore = calculateBucketModeScore(row, bucketAssignments || DEFAULT_BUCKET_ASSIGNMENTS, currentBucketWeights);
        console.log('ScoreBreakdown: Recalculated score:', recalculatedScore, 'should match displayed:', displayedScore);
        
        if (Math.abs(recalculatedScore - displayedScore) > 0.01) {
          console.warn('ScoreBreakdown: MISMATCH! Recalculated:', recalculatedScore, 'Displayed:', displayedScore);
        }
        
        // Bucket mode breakdown with dynamic bucket weights
        const total = currentBucketWeights.high + currentBucketWeights.medium;
        const BUCKET_WEIGHTS = {
          high: currentBucketWeights.high / total,
          medium: currentBucketWeights.medium / total,
          exclusions: 0,  // Excluded parameters don't contribute
        };

        // Group assignments by bucket (exclusions shown but not scored)
        const bucketGroups = {
          high: bucketAssignments.filter(a => a.bucket === "high").sort((a, b) => a.position - b.position),
          medium: bucketAssignments.filter(a => a.bucket === "medium").sort((a, b) => a.position - b.position),
          exclusions: bucketAssignments.filter(a => a.bucket === "exclusions").sort((a, b) => a.position - b.position),
        };

        // Store bucket-level data
        const buckets: Array<{
          bucket: string;
          bucketWeight: number;
          parameters: Array<{
            parameter: string;
            targetValue: string;
            actualValue: string;
            matchScore: number;
            position: number;
            positionWeight: number;
            weightedScore: number;
          }>;
          averageScore: number;
          contribution: number;
        }> = [];

        let totalScore = 0;

        // Calculate for each bucket
        Object.entries(bucketGroups).forEach(([bucket, items]) => {
          if (items.length === 0) return;

          const bucketWeight = BUCKET_WEIGHTS[bucket as ImportanceBucket];
          const parameters: Array<any> = [];
          
          let sumOfScores = 0;

          items.forEach((assignment, idx) => {
            const paramId = assignment.parameterId;
            const paramLabel = AVAILABLE_PARAMETERS.find(p => p.id === paramId)?.label || paramId;
            const scoreFieldName = `${paramId}_Score`;
            const actualValue = row[scoreFieldName] || "";
            const matchScore = getScoreForValue(actualValue, assignment.selectedValue, paramId);
            
            console.log(`  ScoreBreakdown ${bucket}: ${paramId}="${actualValue}" vs target="${assignment.selectedValue}" → score=${matchScore}`);
            
            // All parameters weighted equally (positionWeight = 1.0 for all)
            const positionWeight = bucket === "exclusions" ? 0 : 1.0;
            const weightedScore = matchScore * positionWeight;
            
            sumOfScores += matchScore;

            parameters.push({
              parameter: paramLabel,
              targetValue: assignment.selectedValue,
              actualValue: actualValue,
              matchScore: matchScore,
              position: idx + 1,
              positionWeight: positionWeight,
              weightedScore: weightedScore
            });
          });

          const averageScore = items.length > 0 ? sumOfScores / items.length : 0;
          const contribution = averageScore * bucketWeight;
          totalScore += contribution;

          buckets.push({
            bucket: bucket,
            bucketWeight: bucketWeight,
            parameters: parameters,
            averageScore: averageScore,
            contribution: contribution
          });
        });

        const finalScore = Math.round(totalScore * 100) / 100;
        console.log('ScoreBreakdown: Final calculated score:', finalScore, 'should match displayed calculatedScore:', row.calculatedScore);
        console.log('ScoreBreakdown: If mismatch, check bucket assignments and weights match');
        return { buckets, totalScore: finalScore, mode: "bucket" };
      } else {
        // Standard mode breakdown (simple/advanced)
        const components: Array<{
          parameter: string;
          actualValue: string;
          numericScore: number;
          weight: number;
          contribution: number;
        }> = [];

        const params: Array<keyof Weights> = [
          "HHI", "Economic_Growth", "Loan_Growth", "Risk", "Risk_Migration",
          "Relative_Risk_Migration", "Premium_Discount", "Pricing_Rationality", "International_CM"
        ];

        let totalContribution = 0;

        params.forEach(paramId => {
          const paramLabel = AVAILABLE_PARAMETERS.find(p => p.id === paramId)?.label || paramId;
          const scoreFieldName = `${paramId}_Score`;
          const actualValue = row[scoreFieldName] || "";
          
          // Convert category to numeric score
          let numericScore = 0;
          const normalized = actualValue.toLowerCase();
          if (normalized === "high") numericScore = 3;
          else if (normalized === "medium") numericScore = 2;
          else if (normalized === "low") numericScore = 1;
          else if (normalized === "premium") numericScore = 3;
          else if (normalized === "par") numericScore = 2;
          else if (normalized === "discount") numericScore = 1;
          else if (normalized === "rational") numericScore = 3;
          else if (normalized === "irrational") numericScore = 1;
          else if (normalized === "below_national" || normalized === "below national") numericScore = 3;
          else if (normalized === "at_national" || normalized === "at national") numericScore = 2;
          else if (normalized === "above_national" || normalized === "above national") numericScore = 1;

          const weight = weights[paramId] || 0;
          const contribution = (numericScore * (weight / 100));
          
          if (weight > 0) {
            totalContribution += contribution;
            components.push({
              parameter: paramLabel,
              actualValue: actualValue,
              numericScore: numericScore,
              weight: weight,
              contribution: contribution
            });
          }
        });

        return { components, totalScore: Math.round(totalContribution * 100) / 100, mode: "standard" };
      }
    };

    const breakdown = getBreakdown();

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-2 ml-1">
            <Calculator className="h-3 w-3" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Score Calculation Breakdown</DialogTitle>
            <DialogDescription>
              Breakdown of New Score ({row.calculatedScore.toFixed(2)}) for {row.MSA}
              <br />
              <span className="text-xs text-muted-foreground">
                Original Score: {row.baselineScore.toFixed(2)} • Change: {row.scoreDelta >= 0 ? '+' : ''}{row.scoreDelta.toFixed(2)}
              </span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {breakdown.mode === "bucket" ? (
              // Bucket Mode Breakdown
              <>
                <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="ml-2 text-sm">
                    <strong>Bucket Priority Mode:</strong> Each bucket calculates an average match score (all parameters weighted equally at 1.0), then multiplies by the bucket's weight (High=60%, Medium=40%). Exclusions filter out MSAs entirely - they don't appear in results.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  {breakdown.buckets?.map((bucket, bucketIdx) => (
                    <Card key={bucketIdx} className="p-4 border-2" style={{
                      borderColor: bucket.bucket === "high" ? "rgb(34, 197, 94)" :
                                   bucket.bucket === "medium" ? "rgb(234, 179, 8)" :
                                   bucket.bucket === "exclusions" ? "rgb(156, 163, 175)" :
                                   "rgb(251, 146, 60)"
                    }}>
                      <div className="space-y-3">
                        {/* Bucket Header */}
                        <div className="flex items-center justify-between pb-2 border-b">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={
                              bucket.bucket === "high" ? "bg-green-50 border-green-300 text-green-800" :
                              bucket.bucket === "medium" ? "bg-yellow-50 border-yellow-300 text-yellow-800" :
                              bucket.bucket === "exclusions" ? "bg-gray-50 border-gray-300 text-gray-800" :
                              "bg-orange-50 border-orange-300 text-orange-800"
                            }>
                              {bucket.bucket === "exclusions" ? "Exclusions" : `${bucket.bucket.charAt(0).toUpperCase() + bucket.bucket.slice(1)} Importance`} Bucket
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              ({(bucket.bucketWeight * 100).toFixed(0)}% weight)
                            </span>
                          </div>
                        </div>

                        {/* Parameters in this bucket */}
                        <div className="space-y-2">
                          {bucket.parameters.map((param, paramIdx) => (
                            <div key={paramIdx} className="p-3 rounded-lg bg-muted/50 border">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">#{param.position}</Badge>
                                  <span className="font-medium text-sm">{param.parameter}</span>
                                </div>
                              </div>
                              <div className="grid grid-cols-5 gap-3 text-xs">
                                <div>
                                  <span className="text-muted-foreground">Target:</span>
                                  <p className="font-medium">{param.targetValue}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Actual:</span>
                                  <p className="font-medium">{param.actualValue}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Match:</span>
                                  <p className="font-medium">{param.matchScore}/3</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Pos Weight:</span>
                                  <p className="font-medium">{param.positionWeight.toFixed(3)}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Weighted:</span>
                                  <p className="font-medium">{param.weightedScore.toFixed(2)}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Bucket Calculation */}
                        <div className="pt-3 border-t space-y-2">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Bucket Average Score:</span>
                            <span className="font-medium">{bucket.averageScore.toFixed(3)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Bucket Contribution:</span>
                            <div className="text-right">
                              <span className="font-medium text-lg">{bucket.contribution.toFixed(2)}</span>
                              <p className="text-xs text-muted-foreground">
                                = {bucket.averageScore.toFixed(3)} × {(bucket.bucketWeight * 100).toFixed(0)}%
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                <Card className="p-4 bg-muted/50 border-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total Calculated Score:</span>
                    <span className="text-2xl font-bold">{breakdown.totalScore.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Sum of all bucket contributions
                  </p>
                </Card>
              </>
            ) : (
              // Standard Mode Breakdown
              <>
                <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="ml-2 text-sm">
                    <strong>Standard Mode:</strong> Each parameter contributes based on its value (High=3, Medium=2, Low=1) multiplied by its weight.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  {breakdown.components.map((comp, idx) => (
                    <div key={idx} className="p-3 rounded-lg border bg-card">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 grid grid-cols-4 gap-4 items-center">
                          <div>
                            <p className="text-sm font-medium">{comp.parameter}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Value</p>
                            <p className="text-sm font-medium">{comp.actualValue}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Score × Weight</p>
                            <p className="text-sm font-medium">{comp.numericScore} × {comp.weight.toFixed(1)}%</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Contribution</p>
                            <p className="font-medium">{comp.contribution.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Card className="p-4 bg-muted/50">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total Calculated Score:</span>
                    <span className="text-2xl font-bold">{breakdown.totalScore.toFixed(2)}</span>
                  </div>
                </Card>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  // Count categories changed
  const categoriesChanged = useMemo(() => {
    return enrichedData.filter(row => row.baselineCategory !== row.calculatedCategory).length;
  }, [enrichedData]);

  const hasActiveFilters = msaFilter !== "" || oldCategoryFilter !== "all" || newCategoryFilter !== "all" || 
    globalFilters.selectedRegions.length > 0 || globalFilters.selectedIndustries.length > 0 ||
    (marketSizeBuckets && (globalFilters.marketSizeRange[0] !== marketSizeBuckets.range.min || globalFilters.marketSizeRange[1] !== marketSizeBuckets.range.max)) ||
    (revenuePerCompanyBuckets && (globalFilters.revenuePerCompanyRange[0] !== revenuePerCompanyBuckets.range.min || globalFilters.revenuePerCompanyRange[1] !== revenuePerCompanyBuckets.range.max));

  // Calculate preview weights from category preferences
  const previewWeights = useMemo(() => {
    return convertCategoriesToWeights(categoryPreferences);
  }, [categoryPreferences]);

  // Helper function to render cell content based on column ID
  const renderCellContent = (columnId: string, row: any) => {
    switch (columnId) {
      case "MSA":
        return row.MSA;
      case "originalScore":
        return row.baselineScore.toFixed(2);
      case "calculatedScore":
        return (
          <div className="flex items-center justify-center">
            <span className={`transition-all duration-300 ${isCalculating ? 'opacity-50' : 'opacity-100'}`}>
              {row.calculatedScore.toFixed(2)}
            </span>
            <ScoreBreakdownDialog row={row} />
          </div>
        );
      case "scoreDelta":
        return (
          <span className={`transition-all duration-300 ${
            row.scoreDelta > 0 ? "text-green-600 dark:text-green-400" : 
            row.scoreDelta < 0 ? "text-red-600 dark:text-red-400" : ""
          } ${isCalculating ? 'opacity-50' : 'opacity-100'}`}>
            {row.scoreDelta > 0 ? "+" : ""}{row.scoreDelta.toFixed(2)}
          </span>
        );
      case "originalCategory":
        return <CategoryBadge category={row.baselineCategory} />;
      case "calculatedCategory":
        return (
          <span className={`transition-all duration-300 ${isCalculating ? 'opacity-50' : 'opacity-100'}`}>
            <CategoryBadge category={row.calculatedCategory} />
          </span>
        );
      case "HHI":
        return <ScoreBadge score={row.HHI_Score} />;
      case "Economic_Growth":
        return <ScoreBadge score={row.Economic_Growth_Score} />;
      case "Loan_Growth":
        return <ScoreBadge score={row.Loan_Growth_Score} />;
      case "Risk":
        return <ScoreBadge score={row.Risk_Score} />;
      case "Risk_Migration":
        return <ScoreBadge score={row.Risk_Migration_Score} />;
      case "Relative_Risk_Migration":
        return <ScoreBadge score={row.Relative_Risk_Migration_Score} />;
      case "Premium_Discount":
        return <ScoreBadge score={row.Premium_Discount_Score} />;
      case "Pricing_Rationality":
        return <ScoreBadge score={row.Pricing_Rationality_Score} />;
      case "International_CM":
        return <ScoreBadge score={row.International_CM_Score} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with Controls */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2>What-If Analysis</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Drag parameters into importance buckets - only selected parameters affect the score. Scores update in real-time across the entire dashboard.
              </p>
            </div>
            <div className="flex gap-2">
              {isCalculating && mode === "simple" && (
                <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Calculating...</span>
                </div>
              )}
              <Button
                variant="outline"
                onClick={resetToOriginal}
                disabled={JSON.stringify(bucketAssignments) === JSON.stringify(DEFAULT_BUCKET_ASSIGNMENTS)}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to Default
              </Button>
            </div>
          </div>

          <Alert>
            <AlertDescription>
              Scores are calculated in real-time based on your bucket priorities. {categoriesChanged} MSAs changed attractiveness category from baseline.
              {enrichedData.length - filteredData.length > 0 && (
                <span className="ml-2 text-orange-600 dark:text-orange-400">
                  ({enrichedData.length - filteredData.length} MSAs filtered by exclusions/filters)
                </span>
              )}
            </AlertDescription>
          </Alert>

          {/* Mode Toggle - Hidden (Bucket Priority Mode is default) */}
          {false && (
            <div className="flex items-center gap-4">
              <span className="text-sm">Mode:</span>
              <Tabs value={mode} onValueChange={(value) => setMode(value as "simple" | "advanced" | "bucket")}>
                <TabsList>
                  <TabsTrigger value="simple" className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    Simple
                  </TabsTrigger>
                  <TabsTrigger value="advanced" className="flex items-center gap-2">
                    <SlidersIcon className="h-4 w-4" />
                    Advanced
                  </TabsTrigger>
                  <TabsTrigger value="bucket" className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4" />
                    Bucket Priority
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}

          {/* Total Weight Display (Advanced Mode Only) */}
          {mode === "advanced" && (
            <div className="flex items-center gap-4">
              <span className="text-sm">Total Weight:</span>
              <Badge variant={totalWeight === 100 ? "default" : "destructive"}>
                {isNaN(totalWeight) ? 0 : totalWeight}%
              </Badge>
              {totalWeight !== 100 && (
                <span className="text-sm text-muted-foreground">
                  (Weights should sum to 100%)
                </span>
              )}
              {isCalculating && (
                <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Calculating...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Data Filters - Market Size, Revenue, Geography & Industry */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="mb-2">Filter Data Scope</h3>
            <p className="text-sm text-muted-foreground">
              Filter markets by size, revenue, geography and industry characteristics
            </p>
          </div>
          
          {bucketsLoading ? (
            <div className="text-sm text-muted-foreground">Loading filter options...</div>
          ) : (
            <div className="space-y-6">
              {/* Market Size and Revenue Sliders */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Market Size Slider */}
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5">
                    <Label>Market Size</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <div className="space-y-1">
                            <p className="font-medium">Total addressable market size in the MSA</p>
                            <p className="text-xs text-muted-foreground">Higher market size indicates larger opportunity for revenue growth and market penetration</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        ${(globalFilters.marketSizeRange[0] / 1000000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M
                      </span>
                      <span className="text-muted-foreground">
                        ${(globalFilters.marketSizeRange[1] / 1000000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M
                      </span>
                    </div>
                    <Slider
                      min={marketSizeBuckets?.range.min || 0}
                      max={marketSizeBuckets?.range.max || 100}
                      step={(marketSizeBuckets?.range.max || 100) / 100}
                      value={globalFilters.marketSizeRange}
                      onValueChange={(value) => setGlobalFilters({ ...globalFilters, marketSizeRange: value as [number, number] })}
                      className="w-full [&_[data-slot=slider-range]]:bg-blue-500 [&_[data-slot=slider-thumb]]:border-blue-500"
                    />
                  </div>
                </div>

                {/* Revenue per Company Slider - Coming Soon */}
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5">
                    <Label>Revenue per Company</Label>
                    <Badge variant="outline" className="text-xs">Coming Soon</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground italic">
                    Revenue per company filtering will be available when this feature is enabled.
                  </div>
                </div>
              </div>

              {/* Geography and Industry Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Geography Filter */}
                <div className="space-y-3">
                  <Label>Region</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      "Far West",
                      "Great Lakes",
                      "Mideast",
                      "New England",
                      "Plains",
                      "Rocky Mountain",
                      "Southeast",
                      "Southwest"
                    ].map((region) => (
                      <div key={region} className="flex items-center space-x-2">
                        <Checkbox
                          id={`region-${region}`}
                          checked={globalFilters.selectedRegions.includes(region)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setGlobalFilters({ ...globalFilters, selectedRegions: [...globalFilters.selectedRegions, region] });
                            } else {
                              setGlobalFilters({ ...globalFilters, selectedRegions: globalFilters.selectedRegions.filter(r => r !== region) });
                            }
                          }}
                        />
                        <label
                          htmlFor={`region-${region}`}
                          className="text-sm cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {region}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Industry Filter (Placeholder) */}
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5">
                    <Label>Industry Focus</Label>
                    <Badge variant="outline" className="text-xs">Coming Soon</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground italic">
                    Industry-specific filtering will be available when industry data is added to the dataset.
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Active Filters Indicator */}
          {(() => {
            // Check if market size filter is active (not at default [0,0] and not at full range)
            const marketSizeActive = marketSizeBuckets && 
              !(globalFilters.marketSizeRange[0] === 0 && globalFilters.marketSizeRange[1] === 0) &&
              (globalFilters.marketSizeRange[0] !== marketSizeBuckets.range.min || globalFilters.marketSizeRange[1] !== marketSizeBuckets.range.max);
            
            // Check if revenue filter is active (not at default [0,0] and not at full range)
            const revenueActive = revenuePerCompanyBuckets && 
              !(globalFilters.revenuePerCompanyRange[0] === 0 && globalFilters.revenuePerCompanyRange[1] === 0) &&
              (globalFilters.revenuePerCompanyRange[0] !== revenuePerCompanyBuckets.range.min || globalFilters.revenuePerCompanyRange[1] !== revenuePerCompanyBuckets.range.max);
            
            const regionsActive = globalFilters.selectedRegions.length > 0;
            
            const hasActiveFilters = marketSizeActive || revenueActive || regionsActive;
            
            return hasActiveFilters ? (
              <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                <span className="text-sm text-blue-900 dark:text-blue-100">
                  Global filters active - showing {sortedData.length} of {data.length} MSAs (applies to all pages)
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // Reset to full bucket ranges instead of [0, 0]
                    setGlobalFilters({
                      marketSizeRange: marketSizeBuckets?.range 
                        ? [marketSizeBuckets.range.min, marketSizeBuckets.range.max]
                        : [0, 0],
                      revenuePerCompanyRange: revenuePerCompanyBuckets?.range
                        ? [revenuePerCompanyBuckets.range.min, revenuePerCompanyBuckets.range.max]
                        : [0, 0],
                      selectedRegions: [],
                      selectedIndustries: [],
                    });
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Reset to Default
                </Button>
              </div>
            ) : null;
          })()}
        </div>
      </Card>

      {/* Simple Mode - Category Selectors */}
      {mode === "simple" && (
        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="mb-2">Component Preferences</h3>
              <p className="text-sm text-muted-foreground">
                Select your preferred level for each component - changes apply immediately. Components set to "High" will be weighted most heavily, "Medium" moderately, and "Low" minimally. "Any" means the component doesn't matter.
              </p>
            </div>
          </div>
          <TooltipProvider>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(categoryPreferences).map(([key, value]) => {
                const isHHI = key === "HHI";
                const isRiskMigration = key === "Risk_Migration";
                const isRelativeRisk = key === "Relative_Risk_Migration";
                const isPremiumDiscount = key === "Premium_Discount";
                const isPricingRationality = key === "Pricing_Rationality";
                const isInternationalCM = key === "International_CM";
                const label = key.replace(/_/g, " ");
                const paramInfo = PARAMETER_DESCRIPTIONS[key];
                
                return (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <label className="text-sm">{label}</label>
                      {paramInfo && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-md">
                            <div className="space-y-2">
                              <p className="font-medium">{paramInfo.description}</p>
                              <div className="text-xs text-muted-foreground whitespace-pre-line">{paramInfo.highMeans}</div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <Select value={value} onValueChange={(val) => updateCategory(key as keyof CategoryPreferences, val)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Any">Any</SelectItem>
                        {isRelativeRisk ? (
                          <>
                            <SelectItem value="Below National Avg">Below National Avg</SelectItem>
                            <SelectItem value="At National Avg">At National Avg</SelectItem>
                            <SelectItem value="Above National Avg">Above National Avg</SelectItem>
                          </>
                        ) : isPremiumDiscount ? (
                          <>
                            <SelectItem value="Premium">Premium</SelectItem>
                            <SelectItem value="Par">Par</SelectItem>
                            <SelectItem value="Discount">Discount</SelectItem>
                          </>
                        ) : isPricingRationality ? (
                          <>
                            <SelectItem value="Rational">Rational</SelectItem>
                            <SelectItem value="Irrational">Irrational</SelectItem>
                          </>
                        ) : (isHHI || isRiskMigration) ? (
                          <>
                            <SelectItem value="Low">Low (Best)</SelectItem>
                            <SelectItem value="Medium">Medium</SelectItem>
                            <SelectItem value="High">High</SelectItem>
                          </>
                        ) : isInternationalCM ? (
                          <>
                            <SelectItem value="High">High</SelectItem>
                            <SelectItem value="Medium">Medium</SelectItem>
                            <SelectItem value="Low">Low</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="High">High (Best)</SelectItem>
                            <SelectItem value="Medium">Medium</SelectItem>
                            <SelectItem value="Low">Low</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </TooltipProvider>
          
          {/* Active calculated weights */}
          <div className="mt-6 pt-6 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <h4 className="text-sm">Active Weights</h4>
              {isCalculating && (
                <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span>Updating...</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {Object.entries(weights).map(([key, value]) => {
                const safeValue = isNaN(value) ? 0 : value;
                return (
                  <div key={key} className="text-xs">
                    <div className="text-muted-foreground">{key.replace(/_/g, " ")}</div>
                    <div className={`font-medium transition-all duration-300 ${isCalculating ? 'opacity-50' : 'opacity-100'}`}>{safeValue}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Advanced Mode - Weight Sliders */}
      {mode === "advanced" && (
        <Card className="p-6">
          <h3 className="mb-4">Component Weights</h3>
          <TooltipProvider>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(weights).map(([key, value]) => {
                const paramKey = key as keyof Weights;
                const paramInfo = PARAMETER_DESCRIPTIONS[paramKey];
                const label = key.replace(/_/g, " ");
                
                return (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <label className="text-sm">{label}</label>
                      {paramInfo && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-md">
                            <div className="space-y-2">
                              <p className="font-medium">{paramInfo.description}</p>
                              <div className="text-xs text-muted-foreground whitespace-pre-line">{paramInfo.highMeans}</div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <WeightSlider
                      label=""
                      value={value}
                      defaultValue={DEFAULT_WEIGHTS[paramKey]}
                      onChange={(newValue) => updateWeight(paramKey, newValue)}
                    />
                  </div>
                );
              })}
              
              {/* Revenue per Company - Coming Soon */}
              <div className="space-y-2 opacity-60">
                <div className="flex items-center gap-1.5">
                  <label className="text-sm">Revenue per Company</label>
                  <Badge variant="outline" className="text-xs">Coming Soon</Badge>
                </div>
                <div className="h-10 flex items-center justify-center border border-dashed border-muted-foreground/30 rounded-md bg-muted/30">
                  <span className="text-xs text-muted-foreground italic">Not yet available</span>
                </div>
              </div>
            </div>
          </TooltipProvider>
        </Card>
      )}

      {/* Bucket Priority Mode */}
      {mode === "bucket" && (
        <DndProvider backend={HTML5Backend}>
          <div className="space-y-4">
            {/* How It Works Info */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <h4 className="font-medium text-blue-900 dark:text-blue-100">How Bucket Priority Mode Works</h4>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHowItWorks(!showHowItWorks)}
                >
                  {showHowItWorks ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {showHowItWorks && (
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc ml-4">
                  <li>Click a parameter and select your target value (e.g., "Market Concentration - Low" or "Loan Growth - High")</li>
                  <li>Drag the parameter-value combination into an importance bucket</li>
                  <li><strong>High bucket:</strong> Gets 60% of scoring weight (adjustable)</li>
                  <li><strong>Medium bucket:</strong> Gets 40% of scoring weight (adjustable)</li>
                  <li><strong>Exclusions bucket:</strong> Filters out MSAs that match the selected value (e.g., exclude "Market Concentration - High" removes all MSAs with high market concentration from results)</li>
                  <li>Within each bucket, weight is split equally among all parameters</li>
                  <li>MSAs are scored based on how well they match your selected parameter values in High/Medium buckets</li>
                </ul>
              )}
            </Card>

            {/* Available Parameters */}
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm">Select Parameters</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click a parameter to select its target value, then drag it to an importance bucket
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={clearAllBuckets} disabled={bucketAssignments.length === 0 && selectedParameterValues.length === 0}>
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Clear All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={applyDefaultParameters}>
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Apply Default Parameters
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {AVAILABLE_PARAMETERS.map(param => {
                  const usedValues = new Set(
                    bucketAssignments.map(a => `${a.parameterId}-${a.selectedValue}`)
                  );
                  return (
                    <ParameterCard
                      key={param.id}
                      parameter={param}
                      onValueSelected={handleValueSelected}
                      usedValues={usedValues}
                    />
                  );
                })}
              </div>
            </Card>

            {/* Selected Items Ready to Drag */}
            {selectedParameterValues.length > 0 && (
              <Card className="p-4">
                <h4 className="text-sm font-medium mb-3">Ready to Place</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Drag these items into importance buckets below
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {selectedParameterValues.map(item => {
                    const param = AVAILABLE_PARAMETERS.find(p => p.id === item.parameterId);
                    if (!param) return null;
                    
                    return (
                      <DraggableParameterValue
                        key={`${item.parameterId}-${item.selectedValue}`}
                        assignment={{
                          parameterId: item.parameterId,
                          selectedValue: item.selectedValue,
                          bucket: "high", // temporary, will be set on drop
                          position: 0
                        }}
                        paramLabel={param.label}
                        onRemove={() => {
                          setSelectedParameterValues(prev => 
                            prev.filter(v => !(v.parameterId === item.parameterId && v.selectedValue === item.selectedValue))
                          );
                        }}
                      />
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Importance Buckets */}
            <div className="space-y-3">
              {totalBucketWeight !== 100 && (
                <Alert>
                  <AlertDescription className="text-sm">
                    Bucket weights total {totalBucketWeight}%. Adjust weights to total 100%.
                  </AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <DropBucket
                  bucket="high"
                  title="High Importance"
                  description="Adjust weight % for this bucket"
                  color="bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-800"
                  assignments={bucketAssignments}
                  bucketWeight={bucketWeights.high}
                  onWeightChange={(newWeight) => setBucketWeights({ ...bucketWeights, high: newWeight })}
                  onDrop={handleDropParameter}
                  onRemove={handleRemoveParameter}
                  onReorder={handleReorderParameter}
                />
                <DropBucket
                  bucket="medium"
                  title="Medium Importance"
                  description="Adjust weight % for this bucket"
                  color="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-300 dark:border-yellow-800"
                  assignments={bucketAssignments}
                  bucketWeight={bucketWeights.medium}
                  onWeightChange={(newWeight) => setBucketWeights({ ...bucketWeights, medium: newWeight })}
                  onDrop={handleDropParameter}
                  onRemove={handleRemoveParameter}
                  onReorder={handleReorderParameter}
                />
                <DropBucket
                  bucket="exclusions"
                  title="Exclusions"
                  description="Filter out MSAs matching these values"
                  color="bg-gray-50 dark:bg-gray-950/20 border-gray-300 dark:border-gray-800"
                  assignments={bucketAssignments}
                  bucketWeight={0}
                  onWeightChange={() => {}}
                  onDrop={handleDropParameter}
                  onRemove={handleRemoveParameter}
                  onReorder={handleReorderParameter}
                />
              </div>
            </div>
          </div>


        </DndProvider>
      )}

      {/* Impact Summary */}
      <Card className="p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">MSAs with Changes</p>
            <p className="text-2xl">{impactStats.msasWithChanges}</p>
            <p className="text-xs text-muted-foreground">out of {enrichedData.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Score Increases</p>
            <p className="text-2xl text-green-600 dark:text-green-400">{impactStats.totalIncrease}</p>
            <p className="text-xs text-muted-foreground">MSAs improved</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Score Decreases</p>
            <p className="text-2xl text-red-600 dark:text-red-400">{impactStats.totalDecrease}</p>
            <p className="text-xs text-muted-foreground">MSAs declined</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Category Changes</p>
            <p className="text-2xl">{categoriesChanged}</p>
            <p className="text-xs text-muted-foreground">MSAs shifted</p>
          </div>
        </div>
      </Card>

      {/* Results Table */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3>Score Comparison</h3>
              {isCalculating && (
                <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Updating scores...</span>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowScoreComparison(!showScoreComparison)}
              >
                {showScoreComparison ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex gap-2 items-center">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings2 className="h-4 w-4 mr-2" />
                    Columns
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64" align="end">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">Show/Hide Columns</h4>
                      <Button variant="ghost" size="sm" onClick={resetColumns}>
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Reset
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {columns.map((col) => (
                        <div key={col.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={col.id}
                            checked={col.visible}
                            onCheckedChange={() => toggleColumnVisibility(col.id)}
                            disabled={col.fixed}
                          />
                          <label
                            htmlFor={col.id}
                            className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {col.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMsaFilter("");
                    setOldCategoryFilter("all");
                    setNewCategoryFilter("all");
                    setMarketSizeFilter("all");
                    setRevenuePerCompanyFilter("all");
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              )}
              <span className="text-sm text-muted-foreground">
                Showing {sortedData.length} of {data.length} MSAs
              </span>
            </div>
          </div>

          {showScoreComparison && (
            <>
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search MSA..."
                value={msaFilter}
                onChange={(e) => setMsaFilter(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={oldCategoryFilter} onValueChange={setOldCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Original Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Original Categories</SelectItem>
                <SelectItem value="Highly Attractive">Highly Attractive</SelectItem>
                <SelectItem value="Attractive">Attractive</SelectItem>
                <SelectItem value="Neutral">Neutral</SelectItem>
                <SelectItem value="Challenging">Challenging</SelectItem>
              </SelectContent>
            </Select>
            <Select value={newCategoryFilter} onValueChange={setNewCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="New Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All New Categories</SelectItem>
                <SelectItem value="Highly Attractive">Highly Attractive</SelectItem>
                <SelectItem value="Attractive">Attractive</SelectItem>
                <SelectItem value="Neutral">Neutral</SelectItem>
                <SelectItem value="Challenging">Challenging</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table Hint */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <GripVertical className="h-3 w-3" />
            <span>Drag column headers to reorder • Use the Columns button to show/hide columns</span>
          </div>

          {/* Table */}
          <div className="rounded-md border overflow-hidden">
            <div className="overflow-auto max-h-[600px] relative">
              <DndProvider backend={HTML5Backend}>
                <table className="w-full caption-bottom text-sm">
                  <thead className="sticky top-0 bg-background z-10 border-b shadow-sm">
                    <tr className="border-b">
                      {columns.filter(col => col.visible).map((column, index) => (
                        <DraggableHeaderCell
                          key={column.id}
                          column={column}
                          index={columns.indexOf(column)}
                          moveColumn={moveColumn}
                          sortField={sortField}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                        />
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedData.map((row, rowIndex) => (
                      <tr key={rowIndex} className="hover:bg-muted/50 border-b transition-colors">
                        {columns.filter(col => col.visible).map((column) => (
                          <td 
                            key={column.id} 
                            className={`p-2 align-middle whitespace-nowrap ${column.id === 'MSA' ? '' : 'text-center'}`}
                          >
                            {renderCellContent(column.id, row)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DndProvider>
            </div>
          </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
