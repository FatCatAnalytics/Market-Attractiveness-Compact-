// State to Region Mapping - Maps US state codes to regions

// Based on Bureau of Economic Analysis (BEA) regions with some modifications
// https://www.bea.gov/regional/docs/regions.cfm

export const STATE_TO_REGION: Record<string, string> = {
  // New England
  'CT': 'New England',
  'ME': 'New England', 
  'MA': 'New England',
  'NH': 'New England',
  'RI': 'New England',
  'VT': 'New England',
  
  // Mideast
  'DE': 'Mideast',
  'DC': 'Mideast',
  'MD': 'Mideast',
  'NJ': 'Mideast',
  'NY': 'Mideast',
  'PA': 'Mideast',
  
  // Great Lakes
  'IL': 'Great Lakes',
  'IN': 'Great Lakes',
  'MI': 'Great Lakes',
  'OH': 'Great Lakes',
  'WI': 'Great Lakes',
  
  // Plains
  'IA': 'Plains',
  'KS': 'Plains',
  'MN': 'Plains',
  'MO': 'Plains',
  'NE': 'Plains',
  'ND': 'Plains',
  'SD': 'Plains',
  
  // Southeast
  'AL': 'Southeast',
  'AR': 'Southeast',
  'FL': 'Southeast',
  'GA': 'Southeast',
  'KY': 'Southeast',
  'LA': 'Southeast',
  'MS': 'Southeast',
  'NC': 'Southeast',
  'SC': 'Southeast',
  'TN': 'Southeast',
  'VA': 'Southeast',
  'WV': 'Southeast',
  
  // Southwest
  'AZ': 'Southwest',
  'NM': 'Southwest',
  'OK': 'Southwest',
  'TX': 'Southwest',
  
  // Rocky Mountain
  'CO': 'Rocky Mountain',
  'ID': 'Rocky Mountain',
  'MT': 'Rocky Mountain',
  'UT': 'Rocky Mountain',
  'WY': 'Rocky Mountain',
  
  // Far West
  'AK': 'Far West',
  'CA': 'Far West',
  'HI': 'Far West',
  'NV': 'Far West',
  'OR': 'Far West',
  'WA': 'Far West',
};

/**
 * Extract state codes from MSA name
 * Examples:
 * - "AL-Birmingham" -> ["AL"]
 * - "NC-SC-Charlotte-Concord-Gastonia" -> ["NC", "SC"]
 * - "PA-NJ-DE-MD-Philadelphia-Camden-Wilmington" -> ["PA", "NJ", "DE", "MD"]
 */
export function extractStateCodesFromMSA(msaName: string): string[] {
  if (!msaName) return [];
  
  // Look for state codes at the beginning of the MSA name
  // Pattern: starts with 2-letter state codes separated by hyphens
  const statePattern = /^([A-Z]{2}(?:-[A-Z]{2})*)-/;
  const match = msaName.match(statePattern);
  
  if (match && match[1]) {
    // Split the state codes and return as array
    return match[1].split('-');
  }
  
  return [];
}

/**
 * Get region for an MSA based on its state codes
 * If MSA spans multiple states in different regions, returns the first state's region
 * If no state codes found, returns "Other"
 */
export function getRegionFromStateCodes(msaName: string): string {
  const stateCodes = extractStateCodesFromMSA(msaName);
  
  if (stateCodes.length === 0) {
    return "Other";
  }
  
  // Use the first state's region (primary state)
  const primaryState = stateCodes[0];
  return STATE_TO_REGION[primaryState] || "Other";
}

/**
 * Get all unique regions from an MSA that spans multiple states
 * Useful for understanding cross-region MSAs
 */
export function getAllRegionsFromMSA(msaName: string): string[] {
  const stateCodes = extractStateCodesFromMSA(msaName);
  const regions = new Set<string>();
  
  for (const stateCode of stateCodes) {
    const region = STATE_TO_REGION[stateCode];
    if (region) {
      regions.add(region);
    }
  }
  
  return Array.from(regions);
}

/**
 * Check if an MSA spans multiple regions
 */
export function isCrossRegionalMSA(msaName: string): boolean {
  return getAllRegionsFromMSA(msaName).length > 1;
}

/**
 * Gets region for an MSA by name synchronously
 * Priority order:
 * 1. State-based mapping (most reliable for MSAs with state codes)
 * 2. Coordinate-based mapping (fallback when MSA name is missing or has no state codes)
 */
export function getRegionForMSASync(
  msaName: string | undefined,
  lat?: number | undefined,
  lon?: number | undefined
): string {
  if (!msaName) {
    return getRegionFromCoordinates(lat, lon);
  }
  
  // Try state-based mapping first (most reliable)
  const stateBasedRegion = getRegionFromStateCodes(msaName);
  if (stateBasedRegion !== "Other") {
    return stateBasedRegion;
  }
  
  // Fallback to coordinate-based mapping
  return getRegionFromCoordinates(lat, lon);
}

/**
 * Helper function to map geographic coordinates to regions
 * Used as fallback when MSA name matching fails
 */
export function getRegionFromCoordinates(lat: number | undefined, lon: number | undefined): string {
  if (lat === undefined || lon === undefined || isNaN(lat) || isNaN(lon)) {
    return "Other";
  }
  
  // Far West: Alaska, California, Hawaii, Oregon, Washington, Nevada
  if (lat > 50 || (lat >= 19 && lat <= 22 && lon >= -160 && lon <= -154)) {
    return "Far West";
  }
  if (lon < -114 && lat > 32) {
    return "Far West";
  }
  
  // Rocky Mountain: Arizona, Colorado, Idaho, Montana, Nevada, New Mexico, Utah, Wyoming
  if (lon >= -114 && lon < -102 && lat > 31) {
    return "Rocky Mountain";
  }
  
  // Southwest: Arkansas, Louisiana, Oklahoma, Texas
  if (lon >= -107 && lon < -88 && lat >= 25.5 && lat < 37) {
    return "Southwest";
  }
  
  // Plains: Iowa, Kansas, Minnesota, Missouri, Nebraska, North Dakota, South Dakota
  if (lon >= -104 && lon < -89 && lat >= 37 && lat < 49) {
    return "Plains";
  }
  
  // Great Lakes: Illinois, Indiana, Michigan, Ohio, Wisconsin
  if (lon >= -92 && lon < -80 && lat >= 37 && lat <= 48) {
    return "Great Lakes";
  }
  
  // Southeast: Alabama, Kentucky, Mississippi, Tennessee, plus South Atlantic states
  if (lon >= -92 && lon < -81 && lat >= 30 && lat < 37) {
    return "Southeast";
  }
  
  // South Atlantic: Delaware, Florida, Georgia, Maryland, North Carolina, South Carolina, Virginia, West Virginia, DC
  if (lon >= -83 && lon <= -75 && lat >= 24 && lat <= 40) {
    return "Southeast";
  }
  
  // New England: Connecticut, Maine, Massachusetts, New Hampshire, Rhode Island, Vermont
  if (lon >= -73.5 && lon <= -66.5 && lat >= 41 && lat <= 48) {
    return "New England";
  }
  
  // Mideast: New Jersey, New York, Pennsylvania
  if (lon >= -80 && lon <= -73.5 && lat >= 39 && lat <= 45) {
    return "Mideast";
  }
  
  return "Other";
}
