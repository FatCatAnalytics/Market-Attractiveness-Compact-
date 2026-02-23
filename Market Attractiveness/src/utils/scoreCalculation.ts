// Shared utility functions for attractiveness score calculation

export interface Weights {
  HHI: number;
  Economic_Growth: number;
  Loan_Growth: number;
  Risk: number;
  Risk_Migration: number;
  Relative_Risk_Migration: number;
  Premium_Discount: number;
  Pricing_Rationality: number;
  International_CM: number;
}

export type ImportanceBucket = "high" | "medium" | "exclusions";

export interface BucketAssignment {
  parameterId: string;
  selectedValue: string;
  bucket: ImportanceBucket;
  position: number;
}

export const DEFAULT_WEIGHTS: Weights = {
  HHI: 12,
  Economic_Growth: 12,
  Loan_Growth: 10,
  Risk: 8,
  Risk_Migration: 12,
  Relative_Risk_Migration: 10,
  Premium_Discount: 12,
  Pricing_Rationality: 12,
  International_CM: 12,
};

// Default bucket assignments to match original scoring as closely as possible
// HIGH (60%): 6 parameters with 12% original weight - HHI, Economic_Growth, Risk_Migration, Premium_Discount, Pricing_Rationality, International_CM
// MEDIUM (40%): 3 parameters with 8-10% original weight - Loan_Growth, Relative_Risk_Migration, Risk
// EXCLUSIONS: Empty by default
export const DEFAULT_BUCKET_ASSIGNMENTS: BucketAssignment[] = [
  // HIGH IMPORTANCE (60% total weight) - 6 parameters (each gets ~10%)
  { parameterId: "HHI", selectedValue: "Low", bucket: "high", position: 0 },
  { parameterId: "Economic_Growth", selectedValue: "High", bucket: "high", position: 1 },
  { parameterId: "Risk_Migration", selectedValue: "Low", bucket: "high", position: 2 },
  { parameterId: "Premium_Discount", selectedValue: "Premium", bucket: "high", position: 3 },
  { parameterId: "Pricing_Rationality", selectedValue: "Rational", bucket: "high", position: 4 },
  { parameterId: "International_CM", selectedValue: "High", bucket: "high", position: 5 },
  
  // MEDIUM IMPORTANCE (40% total weight) - 3 parameters (each gets ~13.33%)
  { parameterId: "Loan_Growth", selectedValue: "High", bucket: "medium", position: 0 },
  { parameterId: "Relative_Risk_Migration", selectedValue: "Below National Avg", bucket: "medium", position: 1 },
  { parameterId: "Risk", selectedValue: "Low", bucket: "medium", position: 2 },
  
  // EXCLUSIONS - empty by default (no MSAs filtered out)
];

// Convert score text to numeric value
export const scoreToValue = (score: string, isInverse: boolean = false): number => {
  if (!score) return 0;
  const normalized = score.toLowerCase();
  
  // For inverse scoring (lower is better)
  if (isInverse) {
    if (normalized === "high") return 1;
    if (normalized === "medium") return 2;
    if (normalized === "low") return 3;
    // For Relative Risk Migration
    if (normalized === "above_national" || normalized === "above national") return 1;
    if (normalized === "at_national" || normalized === "at national") return 2;
    if (normalized === "below_national" || normalized === "below national") return 3;
    return 0;
  }
  
  // Handle Premium/Discount values (Premium is best)
  if (normalized === "premium") return 3;
  if (normalized === "par") return 2;
  if (normalized === "discount") return 1;
  
  // Handle Pricing Rationality values (Rational is best)
  if (normalized === "rational") return 3;
  if (normalized === "irrational") return 1;
  
  // Standard scoring (higher is better)
  if (normalized === "high") return 3;
  if (normalized === "medium") return 2;
  if (normalized === "low") return 1;
  return 0;
};

// Calculate attractiveness score based on weights
export const calculateAttractivenessScore = (row: any, weights: Weights): number => {
  const components = [
    { score: scoreToValue(row.HHI_Score, true), weight: weights.HHI }, // HHI is inverse: Low is good, High is bad
    { score: scoreToValue(row.Economic_Growth_Score), weight: weights.Economic_Growth },
    { score: scoreToValue(row.Loan_Growth_Score), weight: weights.Loan_Growth },
    { score: scoreToValue(row.Risk_Score, true), weight: weights.Risk }, // Risk is inverse: Low is good, High is bad
    { score: scoreToValue(row.Risk_Migration_Score, true), weight: weights.Risk_Migration },
    { score: scoreToValue(row.Relative_Risk_Migration_Score, true), weight: weights.Relative_Risk_Migration },
    { score: scoreToValue(row.Premium_Discount_Score), weight: weights.Premium_Discount },
    { score: scoreToValue(row.Pricing_Rationality_Score), weight: weights.Pricing_Rationality },
    { score: scoreToValue(row.International_CM_Score), weight: weights.International_CM },
  ];

  const totalScore = components.reduce((sum, component) => {
    return sum + (component.score * (component.weight / 100));
  }, 0);

  return Math.round(totalScore * 100) / 100;
};

// Determine category based on quartiles (matches database pd.qcut method)
export const getCategoriesByQuartiles = (scores: { score: number; index: number }[]): string[] => {
  // Sort scores
  const sorted = [...scores].sort((a, b) => a.score - b.score);
  
  // Calculate quartile boundaries
  const n = sorted.length;
  const q1Index = Math.floor(n * 0.25);
  const q2Index = Math.floor(n * 0.5);
  const q3Index = Math.floor(n * 0.75);
  
  const q1 = sorted[q1Index]?.score ?? 0;
  const q2 = sorted[q2Index]?.score ?? 0;
  const q3 = sorted[q3Index]?.score ?? 0;
  
  // Initialize categories array
  const categories: string[] = new Array(scores.length);
  
  // Assign categories based on quartiles
  scores.forEach((item) => {
    let category: string;
    if (item.score <= q1) {
      category = "Challenging";
    } else if (item.score <= q2) {
      category = "Neutral";
    } else if (item.score <= q3) {
      category = "Attractive";
    } else {
      category = "Highly Attractive";
    }
    categories[item.index] = category;
  });
  
  return categories;
};

// Recalculate all scores and categories for a dataset
export const recalculateData = <T extends Record<string, any>>(
  data: T[],
  weights: Weights,
  useOriginal: boolean = false
): T[] => {
  if (useOriginal) {
    // Return original data unchanged
    return data;
  }

  // Calculate new scores
  const dataWithNewScores = data.map((row, index) => ({
    ...row,
    Attractiveness_Score: calculateAttractivenessScore(row, weights),
    originalIndex: index,
  }));

  // Calculate new categories based on quartiles
  const scores = dataWithNewScores.map((row, index) => ({
    score: row.Attractiveness_Score,
    index,
  }));

  const categories = getCategoriesByQuartiles(scores);

  // Apply new categories
  return dataWithNewScores.map((row, index) => ({
    ...row,
    Attractiveness_Category: categories[index],
  }));
};

// Get match score for bucket mode - how well does actual value match desired value
const getScoreForValue = (actualValue: string, selectedValue: string, parameterId: string): number => {
  if (!actualValue) return 0;
  
  const normalized = actualValue.toLowerCase().replace(/ /g, "_");
  const selected = selectedValue.toLowerCase().replace(/ /g, "_");
  
  // Exact match gets highest score (handled first)
  if (normalized === selected) return 3;
  
  // For simple High/Medium/Low parameters
  if (["high", "medium", "low"].includes(selected)) {
    // Medium always gets score of 2 regardless of target
    if (normalized === "medium") return 2;
    if ((selected === "high" && normalized === "medium") || 
        (selected === "low" && normalized === "medium")) return 2;
    if ((selected === "high" && normalized === "low") || 
        (selected === "low" && normalized === "high")) return 1;
    return 1;
  }
  
  // For Relative Risk Migration
  if (["below_national", "at_national", "above_national"].includes(selected)) {
    if (normalized === selected.replace(" ", "_")) return 3;
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

// Calculate score using bucket mode with dynamic bucket weights
export const calculateBucketModeScore = (
  row: any, 
  assignments: BucketAssignment[], 
  bucketWeightsPct: { high: number; medium: number } = { high: 60, medium: 40 }
): number => {
  // Ensure bucketWeightsPct is always defined
  const safeBucketWeights = bucketWeightsPct && typeof bucketWeightsPct === 'object' && 'high' in bucketWeightsPct && 'medium' in bucketWeightsPct
    ? bucketWeightsPct
    : { high: 60, medium: 40 };
  
  if (assignments.length === 0) {
    return calculateAttractivenessScore(row, DEFAULT_WEIGHTS);
  }

  // Convert percentage weights to decimal
  const BUCKET_WEIGHTS = {
    high: safeBucketWeights.high / 100,
    medium: safeBucketWeights.medium / 100,
    exclusions: 0,  // Excluded parameters contribute 0 to score
  };

  // Group assignments by bucket (excluding "exclusions")
  const bucketGroups = {
    high: assignments.filter(a => a.bucket === "high").sort((a, b) => a.position - b.position),
    medium: assignments.filter(a => a.bucket === "medium").sort((a, b) => a.position - b.position),
  };

  let totalScore = 0;

  // Calculate contribution from each bucket (exclusions bucket is ignored)
  Object.entries(bucketGroups).forEach(([bucket, items]) => {
    if (items.length === 0) return;

    const bucketWeight = BUCKET_WEIGHTS[bucket as "high" | "medium"];

    // Calculate equal-weighted average for this bucket (all positions weighted equally as 1)
    let sumOfScores = 0;

    console.log(`calculateBucketModeScore: ${bucket} bucket has ${items.length} items, weight: ${bucketWeight}`);

    items.forEach((assignment) => {
      const paramId = assignment.parameterId;
      const scoreFieldName = `${paramId}_Score`;
      const actualValue = row[scoreFieldName];
      
      // Get match score (1-3) based on how well this MSA matches the desired value
      const matchScore = getScoreForValue(actualValue, assignment.selectedValue, paramId);
      
      console.log(`  ${paramId}: actual="${actualValue}", target="${assignment.selectedValue}", score=${matchScore}`);
      
      sumOfScores += matchScore;
    });

    // Average match score for this bucket (value between 1-3)
    const averageScore = sumOfScores / items.length;
    
    console.log(`  ${bucket} bucket average: ${averageScore}, contribution: ${averageScore * bucketWeight}`);
    
    // Contribution to total score
    totalScore += averageScore * bucketWeight;
  });

  return Math.round(totalScore * 100) / 100;
};

// Recalculate data using bucket mode with dynamic weights
export const recalculateDataWithBuckets = <T extends Record<string, any>>(
  data: T[],
  bucketAssignments: BucketAssignment[],
  bucketWeightsPct: { high: number; medium: number } = { high: 60, medium: 40 }
): T[] => {
  console.log('recalculateDataWithBuckets: Input data length:', data.length, 'bucketAssignments:', bucketAssignments.length, 'bucketWeights:', bucketWeightsPct);
  
  // Calculate new scores
  const dataWithNewScores = data.map((row, index) => {
    const newScore = calculateBucketModeScore(row, bucketAssignments, bucketWeightsPct);
    
    // Debug Charlotte specifically
    if (row.MSA && row.MSA.includes('Charlotte')) {
      console.log('Charlotte recalculation:', {
        MSA: row.MSA,
        originalScore: row.Attractiveness_Score,
        newCalculatedScore: newScore,
        bucketAssignmentsUsed: bucketAssignments.length,
        bucketWeights: bucketWeightsPct
      });
    }
    
    return {
      ...row,
      Attractiveness_Score: newScore,
      originalIndex: index,
    };
  });

  // Calculate new categories based on quartiles
  const scores = dataWithNewScores.map((row, index) => ({
    score: row.Attractiveness_Score,
    index,
  }));

  const categories = getCategoriesByQuartiles(scores);

  // Apply new categories
  return dataWithNewScores.map((row, index) => ({
    ...row,
    Attractiveness_Category: categories[index],
  }));
};

// Calculate defensive value for an opportunity
export const calculateDefensiveValue = (
  marketShare: number,
  marketSize: number,
  defendDollars: number
): number => {
  const providerMarketShareDollars = marketShare * marketSize;
  const percentageAtRisk = providerMarketShareDollars === 0 ? 0 : (defendDollars / providerMarketShareDollars);
  const riskPenalty = Math.pow(1 - percentageAtRisk, 3);
  return marketShare * riskPenalty;
};

// Categorize opportunities based on defensive value percentiles
export const categorizeOpportunitiesByPercentile = <T extends { Defensive_Value: number }>(
  opportunities: T[]
): (T & { Opportunity_Category: string })[] => {
  // Sort by Defensive Value Score (descending)
  const sorted = [...opportunities].sort((a, b) => b.Defensive_Value - a.Defensive_Value);
  const total = sorted.length;
  
  // Assign categories based on percentile ranking
  // Top 20% = Excellent, Next 30% (20-50%) = Good, Next 30% (50-80%) = Fair, Bottom 20% = Poor
  return sorted.map((opp, index) => {
    const percentile = (index / total) * 100;
    
    let opportunityCategory = "Poor";
    if (percentile < 20) {
      opportunityCategory = "Excellent";
    } else if (percentile < 50) {
      opportunityCategory = "Good";
    } else if (percentile < 80) {
      opportunityCategory = "Fair";
    }
    
    return {
      ...opp,
      Opportunity_Category: opportunityCategory,
    };
  });
};

// Format currency values for display
export const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return "$0.00";
  }
  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`;
  } else if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`;
  } else if (value >= 1e3) {
    return `$${(value / 1e3).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
};
