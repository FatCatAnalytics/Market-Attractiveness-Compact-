import { BucketAssignment } from "./scoreCalculation";
import { getRegionForMSASync, getRegionFromCoordinates } from "./stateToRegionMapping";

// Re-export for backward compatibility
export { getRegionFromCoordinates };

// Apply global filters to a dataset
export function applyGlobalFilters<T extends {
  "Market Size"?: number;
  "Revenue per Company"?: number;
  MSA?: string;
  LAT?: number;
  LON?: number;
  Latitude?: number;
  Longitude?: number;
  [key: string]: any;
}>(
  data: T[],
  filters: {
    marketSizeRange: [number, number];
    revenuePerCompanyRange: [number, number];
    selectedRegions: string[];
    selectedIndustries: string[];
  },
  bucketAssignments: BucketAssignment[],
  filterBuckets?: {
    marketSize?: { range: { min: number; max: number } };
    revenuePerCompany?: { range: { min: number; max: number } };
  }
): T[] {
  return data.filter((row) => {
    // Market Size filter
    let matchesMarketSize = true;
    if (filterBuckets?.marketSize?.range) {
      const value = row["Market Size"];
      const isFullRange = filters.marketSizeRange[0] === filterBuckets.marketSize.range.min && 
                         filters.marketSizeRange[1] === filterBuckets.marketSize.range.max;
      // Treat [0, 0] as "no filter applied" rather than a specific range
      const isDefaultNoFilter = filters.marketSizeRange[0] === 0 && filters.marketSizeRange[1] === 0;
      if (!isFullRange && !isDefaultNoFilter) {
        matchesMarketSize = value !== undefined && value !== null && 
          value >= filters.marketSizeRange[0] && value <= filters.marketSizeRange[1];
      }
    }
    
    // Revenue per Company filter
    let matchesRevenuePerCompany = true;
    if (filterBuckets?.revenuePerCompany?.range) {
      const value = row["Revenue per Company"];
      const isFullRange = filters.revenuePerCompanyRange[0] === filterBuckets.revenuePerCompany.range.min && 
                         filters.revenuePerCompanyRange[1] === filterBuckets.revenuePerCompany.range.max;
      // Treat [0, 0] as "no filter applied" rather than a specific range
      const isDefaultNoFilter = filters.revenuePerCompanyRange[0] === 0 && filters.revenuePerCompanyRange[1] === 0;
      if (!isFullRange && !isDefaultNoFilter) {
        matchesRevenuePerCompany = value !== undefined && value !== null && 
          value >= filters.revenuePerCompanyRange[0] && value <= filters.revenuePerCompanyRange[1];
      }
    }
    
    // Geography filter - use MSA name mapping first, then fallback to coordinates
    let matchesRegion = true;
    if (filters.selectedRegions.length > 0) {
      const msaName = row.MSA;
      const lat = row.LAT ?? row.Latitude;
      const lon = row.LON ?? row.Longitude;
      // Use MSA name first (from geo_maps.csv), fallback to coordinates
      const msaRegion = getRegionForMSASync(msaName, lat, lon);
      matchesRegion = filters.selectedRegions.includes(msaRegion);
    }
    
    // Industry filter (placeholder)
    let matchesIndustry = true;
    if (filters.selectedIndustries.length > 0) {
      // Placeholder: will be implemented when industry data is available
      matchesIndustry = true;
    }
    
    // Exclusions filter - filter out MSAs that match excluded parameter values
    let passesExclusions = true;
    const exclusionAssignments = bucketAssignments.filter(a => a.bucket === "exclusions");
    if (exclusionAssignments.length > 0) {
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
    
    return matchesMarketSize && matchesRevenuePerCompany && matchesRegion && 
           matchesIndustry && passesExclusions;
  });
}
