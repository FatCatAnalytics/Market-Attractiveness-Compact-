import { useState, useMemo, useEffect } from "react";
import { Card } from "./ui/card";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { ArrowLeft, Check, ChevronsUpDown, Building2, TrendingUp, Globe, MapPin, AlertTriangle, Newspaper, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "./ui/utils";
import { Input } from "./ui/input";
import { Slider } from "./ui/slider";
import { ScrollArea } from "./ui/scroll-area";
import { fetchMarketData as fetchMarketDataFromCSV, fetchDepositData } from "../utils/csvDataHooks";

interface OpportunityData {
  Provider: string;
  MSA: string;
  Product: string;
  "Market Share": string | number;
  "Defend $": string | number;
  "Market Size": string | number;
  Opportunity_Category: string;
  Attractiveness_Category: string;
}

interface DepositData {
  MSA: string;
  Provider: string;
  "Market Share": string | number;
}

interface AcquisitionAnalysisProps {
  selectedFranchises: OpportunityData[];
  allProviders: string[];
  marketData: OpportunityData[];
  depositData: DepositData[];
  selectedMSA?: string;
  onBack: () => void;
}

export function AcquisitionAnalysis({ 
  selectedFranchises, 
  allProviders: initialAllProviders, 
  marketData: initialMarketData,
  depositData: initialDepositData,
  selectedMSA = "all",
  onBack 
}: AcquisitionAnalysisProps) {
  const [acquiringProvider, setAcquiringProvider] = useState("");
  const [acquirerComboboxOpen, setAcquirerComboboxOpen] = useState(false);
  const [haircutPercentage, setHaircutPercentage] = useState(10);
  const [selectedFranchise, setSelectedFranchise] = useState<string | null>(null);
  // Acquisition type is always "full" - acquiring entire provider footprint
  const acquisitionType = "full";
  const [newsArticles, setNewsArticles] = useState<Record<string, any[]>>({});
  const [loadingNews, setLoadingNews] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [allProviders, setAllProviders] = useState<string[]>(initialAllProviders || []);
  const [marketData, setMarketData] = useState<OpportunityData[]>(initialMarketData || []);
  const [depositData, setDepositData] = useState<DepositData[]>(initialDepositData || []);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Fetch market data if not provided
  useEffect(() => {
    const fetchMarketData = async () => {
      if (allProviders.length > 0) {
        // Data already loaded from parent
        return;
      }

      setIsLoadingData(true);
      try {
        const [marketDataResponse, depositDataResponse] = await Promise.all([
          fetchMarketDataFromCSV(),
          fetchDepositData()
        ]);

        // Ensure we have valid data arrays
        if (!marketDataResponse || !Array.isArray(marketDataResponse)) {
          console.error('Invalid market data received:', marketDataResponse);
          throw new Error('Failed to fetch valid market data');
        }
        
        if (!depositDataResponse || !Array.isArray(depositDataResponse)) {
          console.error('Invalid deposit data received:', depositDataResponse);
          throw new Error('Failed to fetch valid deposit data');
        }

        setMarketData(marketDataResponse);
        
        // Extract unique providers
        const providerSet = new Set(marketDataResponse.map((d: OpportunityData) => d.Provider));
        const providers = Array.from(providerSet).sort() as string[];
        setAllProviders(providers);

        setDepositData(depositDataResponse);
      } catch (error) {
        console.error('Error fetching market data:', error);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchMarketData();
  }, []);

  // Get unique providers being acquired from selected franchises
  const providersBeingAcquired = useMemo(() => {
    console.log('AcquisitionAnalysis - selectedFranchises received:', {
      count: selectedFranchises.length,
      sample: selectedFranchises.slice(0, 2),
      allData: selectedFranchises
    });
    
    const providers = new Set<string>();
    selectedFranchises.forEach(franchise => {
      if (franchise.Provider && typeof franchise.Provider === 'string') {
        providers.add(franchise.Provider);
      }
    });
    
    console.log('AcquisitionAnalysis - providersBeingAcquired extracted:', Array.from(providers));
    return Array.from(providers);
  }, [selectedFranchises]);

  // Get available acquiring providers (exclude providers being acquired)
  const availableAcquiringProviders = useMemo(() => {
    if (!allProviders || !Array.isArray(allProviders)) {
      return [];
    }
    const acquiredSet = new Set(providersBeingAcquired);
    const available = allProviders.filter(provider => !acquiredSet.has(provider));
    console.log('Acquiring Provider Dropdown:', {
      totalProviders: allProviders.length,
      providersBeingAcquired: providersBeingAcquired.length,
      availableForAcquisition: available.length,
      available: available.slice(0, 5) // Show first 5 for debugging
    });
    return available;
  }, [allProviders, providersBeingAcquired]);

  // Fetch news articles from GDELT API for the franchises being acquired
  useEffect(() => {
    if (!acquiringProvider || providersBeingAcquired.length === 0) {
      setNewsArticles({});
      return;
    }

    const fetchNewsForProviders = async () => {
      setLoadingNews(true);
      setNewsError(null);
      const articles: Record<string, any[]> = {};

      try {
        // Fetch news for each franchise provider being acquired
        for (const provider of providersBeingAcquired) {
          try {
            // GDELT API endpoint - search for provider news from USA sources
            // Simple query: just the provider name
            const searchQuery = `"${provider}"`;
            const query = encodeURIComponent(searchQuery);
            const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=artlist&maxrecords=20&timespan=30d&format=json&sort=datedesc&sourcelang=eng`;
            
            console.log('Fetching news for franchise:', provider, 'URL:', url);
            const response = await fetch(url);
            console.log('GDELT response status:', response.status, 'Content-Type:', response.headers.get("content-type"));
            
            if (!response.ok) {
              // Silently handle HTTP errors - GDELT may rate limit or be unavailable
              console.log('GDELT HTTP error:', response.status, response.statusText);
              articles[provider] = [];
            } else {
              const contentType = response.headers.get("content-type");
              if (!contentType || !contentType.includes("application/json")) {
                // GDELT sometimes returns non-JSON for certain queries - handle gracefully
                console.log('GDELT returned non-JSON response:', contentType);
                articles[provider] = [];
              } else {
                try {
                  const data = await response.json();
                  console.log('GDELT data received for', provider, ':', data);
                  
                  // GDELT returns articles in the "articles" array
                  if (data && data.articles && Array.isArray(data.articles)) {
                    console.log('Found', data.articles.length, 'articles before filtering for', provider);
                    
                    // Filter to USA-based sources and ensure provider name is in title
                    const filteredArticles = data.articles.filter((article: any) => {
                      const title = (article.title || '').toLowerCase();
                      const url = (article.url || '').toLowerCase();
                      const providerLower = provider.toLowerCase();
                      
                      // Check if the title contains the provider name
                      // Also prefer .com, .us, .gov domains (USA sources)
                      const isUSASource = url.includes('.com') || url.includes('.us') || 
                                         url.includes('.gov') || url.includes('.org');
                      
                      return title.includes(providerLower) && isUSASource;
                    });
                    
                    console.log('After filtering:', filteredArticles.length, 'articles for', provider);
                    articles[provider] = filteredArticles;
                  } else {
                    console.log('No articles array in response for', provider);
                    articles[provider] = [];
                  }
                } catch (jsonError) {
                  // JSON parsing failed - handle gracefully
                  console.error('JSON parsing error for', provider, ':', jsonError);
                  articles[provider] = [];
                }
              }
            }
          } catch (error) {
            // Network or other error - handle gracefully
            console.error('Error fetching news for franchise:', provider, error);
            articles[provider] = [];
          }
        }

        console.log('Setting news articles for all franchises:', articles);
        setNewsArticles(articles);
      } catch (error) {
        // Only set error state for critical failures
        setNewsError("Unable to load news at this time");
      } finally {
        setLoadingNews(false);
      }
    };

    fetchNewsForProviders();
  }, [acquiringProvider, providersBeingAcquired]);

  // Get acquiring provider's footprint across top 50 MSAs with acquisition impact
  const acquirerFootprint = useMemo(() => {
    if (!acquiringProvider || !marketData || !depositData || !selectedFranchise) return [];
    
    // Get all credit/cash management data for the acquiring provider to get Market Size and Defend $
    const providerData = marketData.filter(item => item.Provider === acquiringProvider);
    
    // Group by MSA - start with Market Size and Defend $ from credit/cash management
    const msaMap = new Map<string, { 
      msa: string; 
      currentMarketShare: number; 
      marketSize: number; 
      defendDollars: number;
      acquiredMarketShare: number;
      currentHHI: number;
      newHHI: number;
    }>();
    
    // Initialize MSAs from credit/cash management data (for Market Size and Defend $)
    providerData.forEach(item => {
      const msa = item.MSA;
      const marketSize = parseFloat(String(item["Market Size"] || 0));
      const defendDollars = parseFloat(String(item["Defend $"] || 0));
      
      const existing = msaMap.get(msa);
      if (existing) {
        existing.marketSize += marketSize;
        existing.defendDollars += defendDollars;
      } else {
        msaMap.set(msa, { 
          msa, 
          currentMarketShare: 0, // Will populate from deposit data
          marketSize, 
          defendDollars,
          acquiredMarketShare: 0,
          currentHHI: 0,
          newHHI: 0
        });
      }
    });
    
    // Get current CREDIT/CASH market share for the acquiring provider
    // Sum up market share across credit and cash management products
    providerData.forEach(item => {
      const msa = item.MSA;
      let marketShare = parseFloat(String(item["Market Share"] || 0));
      
      // Normalize market share if it's a decimal
      if (marketShare < 1 && marketShare > 0) {
        marketShare = marketShare * 100;
      }
      
      const existing = msaMap.get(msa);
      if (existing) {
        existing.currentMarketShare += marketShare;
      }
    });
    
    // Add acquired market share from CREDIT/CASH MANAGEMENT data based on acquisition type
    if (acquisitionType === "full") {
      // Full Acquisition: Get ALL CREDIT/CASH market share for the selected franchise provider only
      // Filter to only include the selected franchise
      const franchisesToInclude = selectedFranchise ? [selectedFranchise] : [];
      
      franchisesToInclude.forEach(providerName => {
        const acquiredProviderMarketData = marketData.filter(item => item.Provider === providerName);
        
        acquiredProviderMarketData.forEach(item => {
          const msa = item.MSA;
          let marketShare = parseFloat(String(item["Market Share"] || 0));
          
          // Normalize market share if it's a decimal
          if (marketShare < 1 && marketShare > 0) {
            marketShare = marketShare * 100;
          }
          
          const existing = msaMap.get(msa);
          if (existing) {
            existing.acquiredMarketShare += marketShare;
          } else {
            // MSA not in current footprint, but will be acquired
            const marketSize = parseFloat(String(item["Market Size"] || 0));
            const defendDollars = parseFloat(String(item["Defend $"] || 0));
            
            msaMap.set(msa, {
              msa,
              currentMarketShare: 0,
              marketSize,
              defendDollars,
              acquiredMarketShare: marketShare,
              currentHHI: 0,
              newHHI: 0
            });
          }
        });
      });
    } else {
      // Local Acquisition: Get DEPOSIT market share for the providers in the selected franchises
      // Use a Set to track which providers are being acquired in each MSA
      const msaProviderMap = new Map<string, Set<string>>();
      selectedFranchises.forEach(franchise => {
        const msa = franchise.MSA;
        const provider = franchise.Provider;
        
        if (!msaProviderMap.has(msa)) {
          msaProviderMap.set(msa, new Set());
        }
        msaProviderMap.get(msa)!.add(provider);
      });
      
      // For each MSA-provider combination, get their deposit market share
      msaProviderMap.forEach((providers, msa) => {
        providers.forEach(provider => {
          const depositRecord = depositData.find(d => d.MSA === msa && d.Provider === provider);
          if (depositRecord) {
            let depositShare = parseFloat(String(depositRecord["Market Share"] || 0));
            
            // Normalize market share if it's a decimal
            if (depositShare < 1 && depositShare > 0) {
              depositShare = depositShare * 100;
            }
            
            const existing = msaMap.get(msa);
            if (existing) {
              existing.acquiredMarketShare += depositShare;
            } else {
              // MSA not in current footprint, but will be acquired
              // Try to get Market Size and Defend $ from credit/cash data
              const creditData = selectedFranchises.find(f => f.MSA === msa && f.Provider === provider);
              const marketSize = creditData ? parseFloat(String(creditData["Market Size"] || 0)) : 0;
              const defendDollars = creditData ? parseFloat(String(creditData["Defend $"] || 0)) : 0;
              
              msaMap.set(msa, {
                msa,
                currentMarketShare: 0,
                marketSize,
                defendDollars,
                acquiredMarketShare: depositShare,
                currentHHI: 0,
                newHHI: 0
              });
            }
          }
        });
      });
    }
    
    // Calculate HHI for each MSA using DEPOSIT data (regulatory standard)
    Array.from(msaMap.keys()).forEach(msa => {
      const msaEntry = msaMap.get(msa)!;
      
      // Get all providers in this MSA and their DEPOSIT market shares for HHI calculation
      const providersInMSA = depositData.filter(item => item.MSA === msa);
      const providerSharesMap = new Map<string, number>();
      
      providersInMSA.forEach(item => {
        let share = parseFloat(String(item["Market Share"] || 0));
        // Normalize market share if it's a decimal
        if (share < 1 && share > 0) {
          share = share * 100;
        }
        
        const currentShare = providerSharesMap.get(item.Provider) || 0;
        providerSharesMap.set(item.Provider, currentShare + share);
      });
      
      // Calculate Current HHI (sum of squares of all provider shares)
      let currentHHI = 0;
      providerSharesMap.forEach(share => {
        currentHHI += share * share;
      });
      
      // Calculate New HHI after acquisition
      // The acquiring provider gets additional DEPOSIT market share from acquired providers
      // Other providers remain the same, except the acquired ones are removed
      let newHHI = 0;
      const acquirerCurrentShare = providerSharesMap.get(acquiringProvider) || 0;
      
      // Calculate acquired DEPOSIT market share in this MSA for HHI calculation
      let acquiredDepositShare = 0;
      if (acquisitionType === "full") {
        // Full acquisition: get deposit share from selected franchise only
        const franchisesToInclude = selectedFranchise ? [selectedFranchise] : [];
        franchisesToInclude.forEach(providerName => {
          const depositShare = providerSharesMap.get(providerName) || 0;
          acquiredDepositShare += depositShare;
        });
      } else {
        // Local acquisition: get deposit share only for specifically acquired franchises in this MSA
        // Use a Set to avoid double-counting if multiple franchises from same provider in same MSA
        const acquiredProvidersInMSA = new Set<string>();
        selectedFranchises.forEach(franchise => {
          if (franchise.MSA === msa) {
            acquiredProvidersInMSA.add(franchise.Provider);
          }
        });
        
        // Sum up deposit shares for each unique provider
        acquiredProvidersInMSA.forEach(providerName => {
          const depositShare = providerSharesMap.get(providerName) || 0;
          acquiredDepositShare += depositShare;
        });
      }
      
      // For HHI calculation, DO NOT apply haircut - HHI measures market concentration
      // The haircut represents customer attrition that gets redistributed, not market share that vanishes
      const acquirerNewShareForHHI = acquirerCurrentShare + acquiredDepositShare;
      
      // For display purposes, apply haircut (note: haircut not used in HHI calculation)
      const haircutAdjustedShare = acquiredDepositShare * (1 - haircutPercentage / 100);
      const acquirerNewShareForDisplay = acquirerCurrentShare + haircutAdjustedShare;
      

      
      // FIXED: Add acquirer's new share first (even if they weren't in the market before)
      // Use the non-haircutted share for HHI calculation
      if (acquirerNewShareForHHI > 0) {
        newHHI += acquirerNewShareForHHI * acquirerNewShareForHHI;
      }
      
      // Then add all other providers (excluding the acquirer and acquired providers)
      providerSharesMap.forEach((share, provider) => {
        if (provider === acquiringProvider) {
          // Already handled above
          return;
        }
        
        if (acquisitionType === "full" && provider === selectedFranchise) {
          // In full acquisition, this provider is completely acquired, so skip them
          // (their share is now part of the acquirer's share)
          return;
        }
        
        if (acquisitionType === "local") {
          // In local acquisition, check if this specific franchise in this MSA is being acquired
          const isAcquiredInThisMSA = selectedFranchises.some(
            f => f.Provider === provider && f.MSA === msa
          );
          if (isAcquiredInThisMSA) {
            // This franchise is acquired, so its share goes to the acquirer
            // Already accounted for in acquirerNewShare, so skip
            return;
          }
        }
        
        // Provider not involved in acquisition - keep their share
        newHHI += share * share;
      });
      
      msaEntry.currentHHI = Math.round(currentHHI);
      msaEntry.newHHI = Math.round(newHHI);
      
      // Note: msaEntry.acquiredMarketShare already contains the raw acquired share (before haircut)
      // We'll apply the haircut when displaying, not when calculating HHI
    });
    
    // Get top 50 MSAs by market size
    return Array.from(msaMap.values())
      .sort((a, b) => b.marketSize - a.marketSize)
      .slice(0, 50);
  }, [marketData, depositData, acquiringProvider, selectedFranchise, acquisitionType, selectedFranchises, haircutPercentage]);

  // Calculate selected franchise data for the Impact Summary
  const selectedFranchiseData = useMemo(() => {
    if (!acquiringProvider || !selectedFranchise || !marketData) return null;
    
    // Calculate total national market size (unique MSAs - avoid double counting)
    // We need to sum each MSA's market size only once, not for every provider
    const msaMarketSizeMap = new Map<string, number>();
    marketData.forEach(item => {
      const msa = item.MSA;
      const marketSize = parseFloat(String(item["Market Size"] || 0));
      // Take the max market size for each MSA (in case there are slight variations)
      msaMarketSizeMap.set(msa, Math.max(msaMarketSizeMap.get(msa) || 0, marketSize));
    });
    const totalNationalMarketSize = Array.from(msaMarketSizeMap.values()).reduce((sum, size) => sum + size, 0);
    
    // Calculate baseline (acquirer's current position)
    const baselineData = marketData.filter(item => item.Provider === acquiringProvider);
    const baselineMSAs = new Set(baselineData.map(item => item.MSA));
    let baselineShareDollars = 0;
    
    baselineData.forEach(item => {
      const marketSize = parseFloat(String(item["Market Size"] || 0));
      let marketShare = parseFloat(String(item["Market Share"] || 0));
      if (marketShare < 1 && marketShare > 0) {
        marketShare = marketShare * 100;
      }
      baselineShareDollars += (marketShare / 100) * marketSize;
    });
    
    const baselineMarketSharePct = totalNationalMarketSize > 0 
      ? (baselineShareDollars / totalNationalMarketSize) * 100 
      : 0;
    
    // Calculate selected franchise data
    const franchiseData = marketData.filter(item => item.Provider === selectedFranchise);
    const franchiseMSAs = new Set(franchiseData.map(item => item.MSA));
    let franchiseShareDollars = 0;
    
    franchiseData.forEach(item => {
      const marketSize = parseFloat(String(item["Market Size"] || 0));
      let marketShare = parseFloat(String(item["Market Share"] || 0));
      if (marketShare < 1 && marketShare > 0) {
        marketShare = marketShare * 100;
      }
      franchiseShareDollars += (marketShare / 100) * marketSize;
    });
    
    const franchiseMarketSharePct = totalNationalMarketSize > 0 
      ? (franchiseShareDollars / totalNationalMarketSize) * 100 
      : 0;
    
    // Calculate total "at risk" dollars (Defend $) for the franchise
    let totalAtRiskDollars = 0;
    franchiseData.forEach(item => {
      totalAtRiskDollars += parseFloat(String(item["Defend $"] || 0));
    });
    
    // Calculate percentage at risk: (Total Defend $ / Total Franchise Share Dollars) * 100
    const franchisePercentageAtRisk = franchiseShareDollars > 0 
      ? (totalAtRiskDollars / franchiseShareDollars) * 100 
      : 0;
    
    // Calculate impact
    const msasImpacted = Array.from(franchiseMSAs).filter(msa => baselineMSAs.has(msa)).length;
    const newMarketsEntered = Array.from(franchiseMSAs).filter(msa => !baselineMSAs.has(msa)).length;
    
    // After metrics
    const afterShareDollars = baselineShareDollars + franchiseShareDollars;
    const afterMarketSharePct = totalNationalMarketSize > 0 
      ? (afterShareDollars / totalNationalMarketSize) * 100 
      : 0;
    const afterMSAs = baselineMSAs.size + newMarketsEntered;
    
    // Calculate Total Addressable Market after acquisition
    // Combine all unique MSAs from acquirer and franchise
    const allMSAsAfterAcquisition = new Set([...baselineMSAs, ...franchiseMSAs]);
    
    // Get market sizes for acquirer's MSAs
    const acquirerMSAMarketSizeMap = new Map<string, number>();
    baselineData.forEach(item => {
      const msa = item.MSA;
      const marketSize = parseFloat(String(item["Market Size"] || 0));
      acquirerMSAMarketSizeMap.set(msa, Math.max(acquirerMSAMarketSizeMap.get(msa) || 0, marketSize));
    });
    
    // Calculate baseline Total Addressable Market (sum of market sizes for all MSAs where acquirer operates)
    const baselineTotalAddressableMarket = Math.ceil(
      Array.from(acquirerMSAMarketSizeMap.values()).reduce((sum, size) => sum + size, 0)
    );
    
    // Get market sizes for franchise's MSAs
    const franchiseMSAMarketSizeMap = new Map<string, number>();
    franchiseData.forEach(item => {
      const msa = item.MSA;
      const marketSize = parseFloat(String(item["Market Size"] || 0));
      franchiseMSAMarketSizeMap.set(msa, Math.max(franchiseMSAMarketSizeMap.get(msa) || 0, marketSize));
    });
    
    // Sum market sizes for all unique MSAs after acquisition
    let totalAddressableMarketAfter = 0;
    allMSAsAfterAcquisition.forEach(msa => {
      // Try acquirer's market size first, then franchise's
      const marketSize = acquirerMSAMarketSizeMap.get(msa) || franchiseMSAMarketSizeMap.get(msa) || 0;
      totalAddressableMarketAfter += marketSize;
    });
    totalAddressableMarketAfter = Math.ceil(totalAddressableMarketAfter);
    
    // Calculate TAM from new markets only (markets franchise has that acquirer doesn't)
    let tamFromNewMarkets = 0;
    Array.from(franchiseMSAs).forEach(msa => {
      if (!baselineMSAs.has(msa)) {
        tamFromNewMarkets += franchiseMSAMarketSizeMap.get(msa) || 0;
      }
    });
    tamFromNewMarkets = Math.ceil(tamFromNewMarkets);
    
    return {
      baselineShareDollars,
      baselineMarketSharePct,
      baselineMSAs: baselineMSAs.size,
      baselineTotalAddressableMarket,
      franchiseShareDollars,
      franchiseMarketSharePct,
      franchiseMSAs: franchiseMSAs.size,
      franchisePercentageAtRisk,
      msasImpacted,
      newMarketsEntered,
      afterShareDollars,
      afterMarketSharePct,
      afterMSAs,
      totalAddressableMarketAfter,
      tamFromNewMarkets
    };
  }, [acquiringProvider, selectedFranchise, marketData]);

  // Initialize haircut percentage to franchise's at-risk percentage when a franchise is selected
  useEffect(() => {
    if (selectedFranchise && selectedFranchiseData && selectedFranchiseData.franchisePercentageAtRisk > 0) {
      // Round to 2 decimal places and clamp between 0 and 20
      const atRiskPct = Math.round(selectedFranchiseData.franchisePercentageAtRisk * 100) / 100;
      setHaircutPercentage(Math.min(Math.max(atRiskPct, 0), 20));
    }
  }, [selectedFranchise, selectedFranchiseData]);

  const getOpportunityBadgeColor = (category: string) => {
    if (category === "Excellent") return "bg-green-100 text-green-800 border-green-300";
    if (category === "Good") return "bg-blue-100 text-blue-800 border-blue-300";
    if (category === "Fair") return "bg-yellow-100 text-yellow-800 border-yellow-300";
    return "bg-orange-100 text-orange-800 border-orange-300";
  };

  const formatCurrency = (value: number) => {
    // Round up and format with no decimals
    const rounded = Math.ceil(value);
    if (rounded >= 1e9) return `$${Math.ceil(rounded / 1e9)}B`;
    if (rounded >= 1e6) return `$${Math.ceil(rounded / 1e6)}M`;
    if (rounded >= 1e3) return `$${Math.ceil(rounded / 1e3)}K`;
    return `$${rounded}`;
  };

  // Show loading state while fetching data
  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If no franchises selected, show empty state
  if (!selectedFranchises || selectedFranchises.length === 0) {
    return (
      <div className="space-y-4">
        <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={onBack} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Opportunities
              </Button>
              <div>
                <h2 className="mb-1">Proforma Acquisition Analysis</h2>
                <p className="text-sm text-muted-foreground">
                  Select franchises from the "Analyse a Competitor" tab to begin analysis
                </p>
              </div>
            </div>
            <div className="p-3 bg-primary/10 rounded-lg">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          </div>
        </Card>
        <Card className="p-12">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="mb-2">No Franchises Selected</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Go to the "Analyse a Competitor" tab, select the franchises you want to analyze, and click "Analyze Selected" to begin your proforma acquisition analysis.
              </p>
            </div>
            <Button onClick={onBack} variant="default" className="mt-4">
              Go to Analyse a Competitor
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={onBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Opportunities
            </Button>
            <div>
              <h2 className="mb-1">Proforma Acquisition Analysis</h2>
              <p className="text-sm text-muted-foreground">
                Analyze the acquisition of {selectedFranchises.length} selected franchise{selectedFranchises.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="p-3 bg-primary/10 rounded-lg">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
        </div>
      </Card>

      {/* Acquiring Provider Selection */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="mb-1">Who is acquiring these franchises?</h3>
            <p className="text-sm text-muted-foreground">
              Select the provider to view their current footprint across the top 50 MSAs
            </p>
          </div>
          
          <div className="max-w-lg">
            <Popover open={acquirerComboboxOpen} onOpenChange={setAcquirerComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={acquirerComboboxOpen}
                  className="w-full justify-between h-12"
                >
                  {acquiringProvider || "Select acquiring provider..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[500px] p-0">
                <Command>
                  <CommandInput placeholder="Search provider..." />
                  <CommandList>
                    <CommandEmpty>
                      {availableAcquiringProviders.length === 0 
                        ? "No providers available. All providers are selected as acquisition targets."
                        : "No provider found."}
                    </CommandEmpty>
                    <CommandGroup>
                      {(availableAcquiringProviders || []).map((provider) => (
                        <CommandItem
                          key={provider}
                          value={provider}
                          onSelect={(currentValue) => {
                            setAcquiringProvider(currentValue === acquiringProvider ? "" : currentValue);
                            setAcquirerComboboxOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              acquiringProvider === provider ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {provider}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </Card>



      {/* Before & After Comparison: Per-Franchise Impact on Acquirer */}
      {acquiringProvider && (
        <Card className="p-6 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
          <div className="space-y-6">
            <div>
              <h3 className="mb-1">Acquisition Impact Analysis: Before & After</h3>
              <p className="text-sm text-muted-foreground">
                Compare {acquiringProvider}'s current national position with the impact of each franchise acquisition
              </p>
            </div>

            {/* Calculate Before (Baseline) Metrics */}
            {(() => {
              // Calculate total national market size (unique MSAs for Credit and Cash Management)
              // We need to sum each MSA's market size only once, not for every provider
              const msaMarketSizeMap = new Map<string, number>();
              marketData.forEach(item => {
                const msa = item.MSA;
                const marketSize = parseFloat(String(item["Market Size"] || 0));
                // Take the max market size for each MSA (in case there are slight variations)
                msaMarketSizeMap.set(msa, Math.max(msaMarketSizeMap.get(msa) || 0, marketSize));
              });
              const totalNationalMarketSize = Array.from(msaMarketSizeMap.values()).reduce((sum, size) => sum + size, 0);
              
              console.log('Total National Market Size:', totalNationalMarketSize, '($' + (totalNationalMarketSize / 1e9).toFixed(2) + 'B)');
              
              // Get all credit/cash management data for the acquiring provider to calculate market share
              const acquirerMarketData = marketData.filter(item => item.Provider === acquiringProvider);
              
              // Get unique MSAs
              const baselineMSAs = new Set(acquirerMarketData.map(item => item.MSA));
              
              // Calculate baseline market share in $
              // For each record in credit/cash management data: Market Share % * Market Size = $ Share
              let baselineShareDollars = 0;
              
              acquirerMarketData.forEach(item => {
                const marketSize = parseFloat(String(item["Market Size"] || 0));
                let marketShare = parseFloat(String(item["Market Share"] || 0));
                
                // Normalize market share if it's a decimal
                if (marketShare < 1 && marketShare > 0) {
                  marketShare = marketShare * 100;
                }
                
                // $ Share = Market Share % * Market Size
                baselineShareDollars += (marketShare / 100) * marketSize;
              });
              
              // Calculate % share: ($ Share / Total National Market Size) * 100
              const baselineMarketSharePct = totalNationalMarketSize > 0 
                ? (baselineShareDollars / totalNationalMarketSize) * 100 
                : 0;

              // Calculate baseline Total Addressable Market (sum of market sizes for all MSAs where acquirer operates)
              const acquirerMSAMarketSizeMap = new Map<string, number>();
              acquirerMarketData.forEach(item => {
                const msa = item.MSA;
                const marketSize = parseFloat(String(item["Market Size"] || 0));
                acquirerMSAMarketSizeMap.set(msa, Math.max(acquirerMSAMarketSizeMap.get(msa) || 0, marketSize));
              });
              const baselineTotalAddressableMarket = Math.ceil(
                Array.from(acquirerMSAMarketSizeMap.values()).reduce((sum, size) => sum + size, 0)
              );

              // Group franchises by provider for analysis
              const franchisesByProvider = providersBeingAcquired
                .filter(provider => provider && typeof provider === 'string')
                .map(providerName => {
                  // Get all credit/cash management data for this provider
                  const providerMarketData = marketData.filter(item => item.Provider === providerName);
                  
                  // Calculate provider's MSAs
                  const providerMSAs = new Set(providerMarketData.map(item => item.MSA));
                  
                  // Calculate Total Addressable Market: sum of all market sizes for all MSAs the franchise is in
                  // Use a Map to avoid double-counting MSAs (in case there are multiple products per MSA)
                  const msaMarketSizeMap = new Map<string, number>();
                  providerMarketData.forEach(item => {
                    const msa = item.MSA;
                    const marketSize = parseFloat(String(item["Market Size"] || 0));
                    // Take the max market size for each MSA (in case there are slight variations)
                    msaMarketSizeMap.set(msa, Math.max(msaMarketSizeMap.get(msa) || 0, marketSize));
                  });
                  const franchiseTotalAddressableMarket = Math.ceil(
                    Array.from(msaMarketSizeMap.values()).reduce((sum, size) => sum + size, 0)
                  );
                  
                  // Calculate franchise $ share from credit/cash management data (for market share % calculation)
                  let franchiseShareDollars = 0;
                  
                  providerMarketData.forEach(item => {
                    const marketSize = parseFloat(String(item["Market Size"] || 0));
                    let marketShare = parseFloat(String(item["Market Share"] || 0));
                    
                    // Normalize market share if it's a decimal
                    if (marketShare < 1 && marketShare > 0) {
                      marketShare = marketShare * 100;
                    }
                    
                    // $ Share = Market Share % * Market Size
                    franchiseShareDollars += (marketShare / 100) * marketSize;
                  });
                  
                  // Calculate % share: ($ Share / Total National Market Size) * 100
                  const franchiseMarketSharePct = totalNationalMarketSize > 0 
                    ? (franchiseShareDollars / totalNationalMarketSize) * 100 
                    : 0;
                  
                  // Calculate impact on acquirer
                  const msasImpacted = Array.from(providerMSAs).filter(msa => baselineMSAs.has(msa)).length;
                  const newMarketsEntered = Array.from(providerMSAs).filter(msa => !baselineMSAs.has(msa)).length;
                  
                  // After metrics (acquirer + this provider)
                  const afterShareDollars = baselineShareDollars + franchiseShareDollars;
                  // Calculate % share against total national market
                  const afterMarketSharePct = totalNationalMarketSize > 0 
                    ? (afterShareDollars / totalNationalMarketSize) * 100 
                    : 0;
                  const afterMSAs = baselineMSAs.size + newMarketsEntered;
                  
                  // Calculate Total Addressable Market after acquisition
                  // Combine all unique MSAs from acquirer and franchise
                  const allMSAsAfterAcquisition = new Set([...baselineMSAs, ...providerMSAs]);
                  const acquirerMSAMarketSizeMap = new Map<string, number>();
                  const acquirerMarketData = marketData.filter(item => item.Provider === acquiringProvider);
                  acquirerMarketData.forEach(item => {
                    const msa = item.MSA;
                    const marketSize = parseFloat(String(item["Market Size"] || 0));
                    acquirerMSAMarketSizeMap.set(msa, Math.max(acquirerMSAMarketSizeMap.get(msa) || 0, marketSize));
                  });
                  
                  // Sum market sizes for all unique MSAs after acquisition
                  let totalAddressableMarketAfter = 0;
                  allMSAsAfterAcquisition.forEach(msa => {
                    // Try acquirer's market size first, then franchise's
                    const marketSize = acquirerMSAMarketSizeMap.get(msa) || msaMarketSizeMap.get(msa) || 0;
                    totalAddressableMarketAfter += marketSize;
                  });
                  totalAddressableMarketAfter = Math.ceil(totalAddressableMarketAfter);
                  
                  // Calculate TAM from new markets only (markets franchise has that acquirer doesn't)
                  let tamFromNewMarkets = 0;
                  Array.from(providerMSAs).forEach(msa => {
                    if (!baselineMSAs.has(msa)) {
                      tamFromNewMarkets += msaMarketSizeMap.get(msa) || 0;
                    }
                  });
                  tamFromNewMarkets = Math.ceil(tamFromNewMarkets);
                  
                  return {
                    providerName,
                    providerMSAs: providerMSAs.size,
                    franchiseShareDollars,
                    franchiseMarketSharePct,
                    franchiseTotalAddressableMarket,
                    msasImpacted,
                    newMarketsEntered,
                    afterShareDollars,
                    afterMarketSharePct,
                    afterMSAs,
                    totalAddressableMarketAfter,
                    tamFromNewMarkets
                  };
                });

              const formatCurrency = (value: number) => {
                // Round up and format with no decimals
                const rounded = Math.ceil(value);
                if (rounded >= 1e9) return `$${Math.ceil(rounded / 1e9)}B`;
                if (rounded >= 1e6) return `$${Math.ceil(rounded / 1e6)}M`;
                if (rounded >= 1e3) return `$${Math.ceil(rounded / 1e3)}K`;
                return `$${rounded}`;
              };

              return (
                <div className="space-y-6">
                  {/* Before Card */}
                  <div className="bg-white rounded-lg border-2 border-amber-300 p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Badge className="bg-amber-100 text-amber-800 border-amber-300">BEFORE</Badge>
                      <h4 className="font-medium">{acquiringProvider} - Current Position</h4>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Market Share (%)</p>
                        <p className="text-xl font-semibold text-amber-900">{baselineMarketSharePct.toFixed(2)}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Active MSAs</p>
                        <p className="text-xl font-semibold text-amber-900">{baselineMSAs.size}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Total Addressable Market</p>
                        <p className="text-xl font-semibold text-amber-900">{formatCurrency(baselineTotalAddressableMarket)}</p>
                      </div>
                    </div>
                  </div>

                  {/* After Cards - One per Franchise */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium flex items-center gap-2">
                        <Badge className="bg-green-100 text-green-800 border-green-300">AFTER</Badge>
                        Impact of Each Franchise Acquisition
                      </h4>
                      {!selectedFranchise && (
                        <p className="text-sm text-muted-foreground italic">
                          Click a franchise card to view detailed impact analysis
                        </p>
                      )}
                    </div>
                    
                    <div className={`grid gap-4 ${franchisesByProvider.length === 1 ? 'grid-cols-1 max-w-2xl' : franchisesByProvider.length === 2 ? 'grid-cols-2' : franchisesByProvider.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
                      {franchisesByProvider.map((franchise, idx) => (
                        <div 
                          key={franchise.providerName} 
                          onClick={() => setSelectedFranchise(franchise.providerName)}
                          className={`bg-white rounded-lg border-2 p-5 space-y-4 cursor-pointer transition-all hover:shadow-lg ${
                            selectedFranchise === franchise.providerName 
                              ? 'border-green-500 ring-2 ring-green-300 shadow-lg' 
                              : 'border-green-300 hover:border-green-400'
                          }`}>
                          {/* Franchise Details */}
                          <div className="pb-3 border-b border-green-200">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-green-600" />
                                <p className="font-medium text-green-900">{franchise.providerName}</p>
                              </div>
                              {selectedFranchise === franchise.providerName && (
                                <Badge className="bg-green-500 text-white border-green-600">
                                  <Check className="h-3 w-3 mr-1" />
                                  Selected
                                </Badge>
                              )}
                            </div>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Total Addressable Market:</span>
                                <span className="font-medium">{formatCurrency(franchise.franchiseTotalAddressableMarket)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Market Share (%):</span>
                                <span className="font-medium">{franchise.franchiseMarketSharePct.toFixed(2)}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">MSAs:</span>
                                <span className="font-medium">{franchise.providerMSAs}</span>
                              </div>
                            </div>
                          </div>

                          {/* After Position for Acquirer */}
                          <div>
                            <p className="text-xs font-medium text-green-700 mb-2">{acquiringProvider} AFTER ACQUISITION</p>
                            <div className="space-y-3">
                              <div>
                                <p className="text-xs text-muted-foreground">Market Share (%)</p>
                                <p className="font-semibold text-green-900">{franchise.afterMarketSharePct.toFixed(2)}%</p>
                                <p className="text-xs text-green-600">+{(franchise.afterMarketSharePct - baselineMarketSharePct).toFixed(2)}% from acquisition</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Active MSAs</p>
                                <p className="font-semibold text-green-900">{franchise.afterMSAs} total</p>
                                <p className="text-xs text-muted-foreground">
                                  <span className="text-orange-600">{franchise.msasImpacted} shared</span>
                                  {franchise.newMarketsEntered > 0 && (
                                    <span className="text-green-600"> · +{franchise.newMarketsEntered} new markets</span>
                                  )}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Total Addressable Market</p>
                                <p className="font-semibold text-green-900">{formatCurrency(franchise.totalAddressableMarketAfter)}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatCurrency(baselineTotalAddressableMarket)}
                                  {franchise.newMarketsEntered > 0 && franchise.tamFromNewMarkets > 0 && (
                                    <span className="text-green-600"> + {formatCurrency(franchise.tamFromNewMarkets)} ({franchise.newMarketsEntered} MSAs new from {franchise.providerName})</span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </Card>
      )}

      {/* Acquisition Impact Summary */}
      {acquiringProvider && selectedFranchise && selectedFranchiseData && (
        <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <h3 className="mb-4">Acquisition Impact Summary - {acquiringProvider} after acquiring {selectedFranchise}</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 border border-green-100">
              <p className="text-sm text-muted-foreground mb-1">Market Share (%)</p>
              <p className="text-2xl font-semibold text-green-700">
                {selectedFranchiseData.afterMarketSharePct.toFixed(2)}%
              </p>
              <p className="text-xs text-green-600 mt-1">
                +{(selectedFranchiseData.afterMarketSharePct - selectedFranchiseData.baselineMarketSharePct).toFixed(2)}% from acquisition
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-green-100">
              <p className="text-sm text-muted-foreground mb-1">Active MSAs</p>
              <p className="text-2xl font-semibold text-green-700">
                {selectedFranchiseData.afterMSAs}
              </p>
              <p className="text-xs text-green-600 mt-1">
                +{selectedFranchiseData.newMarketsEntered} new market{selectedFranchiseData.newMarketsEntered !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-green-100">
              <p className="text-sm text-muted-foreground mb-1">Total Addressable Market</p>
              <p className="text-2xl font-semibold text-green-700">
                {formatCurrency(selectedFranchiseData.totalAddressableMarketAfter)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(selectedFranchiseData.baselineTotalAddressableMarket)}
                {selectedFranchiseData.newMarketsEntered > 0 && selectedFranchiseData.tamFromNewMarkets > 0 && (
                  <span className="text-green-600"> + {formatCurrency(selectedFranchiseData.tamFromNewMarkets)} ({selectedFranchiseData.newMarketsEntered} new from {selectedFranchise})</span>
                )}
              </p>
            </div>
          </div>
          {acquirerFootprint.filter(item => (item.newHHI - item.currentHHI) >= 200 && item.newHHI >= 1800).length > 0 && (
            <div className="mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-lg flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-red-900">
                  Regulatory Risk Detected: {acquirerFootprint.filter(item => (item.newHHI - item.currentHHI) >= 200 && item.newHHI >= 1800).length} MSA{acquirerFootprint.filter(item => (item.newHHI - item.currentHHI) >= 200 && item.newHHI >= 1800).length !== 1 ? 's' : ''}
                </p>
                <p className="text-sm text-red-700 mt-1">
                  These markets exceed regulatory thresholds (HHI change ≥200 and New HHI ≥1,800) and may require deposit divestitures for acquisition approval.
                </p>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Acquirer's Current Footprint with Acquisition Impact */}
      {acquiringProvider && selectedFranchise && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="mb-1">Market Share Impact Analysis - {acquiringProvider} acquiring {selectedFranchise}</h3>
              <p className="text-sm text-muted-foreground">
                Top 50 MSAs showing current footprint and projected market share after acquisition
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <Label htmlFor="haircut-compact" className="text-xs whitespace-nowrap">
                  Retention Haircut:
                </Label>
                <Input
                  id="haircut-compact"
                  type="number"
                  min="0"
                  max="20"
                  step="0.01"
                  value={haircutPercentage.toFixed(2)}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value) && value >= 0 && value <= 20) {
                      setHaircutPercentage(value);
                    }
                  }}
                  className="w-20 h-7 text-center text-sm"
                />
                <span className="text-xs">%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Haircut adjusts projected share to account for customer attrition during the acquisition.
              </p>
            </div>
          </div>
          {acquirerFootprint.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[20%]">MSA</TableHead>
                    <TableHead className="text-right">Current Share</TableHead>
                    <TableHead className="text-right">Acquired Share</TableHead>
                    <TableHead className="text-right">Projected Share</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                    <TableHead className="text-right">HHI Δ</TableHead>
                    <TableHead className="text-right">Market Size</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {acquirerFootprint.map((item) => {
                    // Apply haircut to acquired share for projected calculations
                    const haircutAdjustedAcquiredShare = item.acquiredMarketShare * (1 - haircutPercentage / 100);
                    const projectedShare = item.currentMarketShare + haircutAdjustedAcquiredShare;
                    const change = haircutAdjustedAcquiredShare;
                    const hasChange = item.acquiredMarketShare > 0;
                    const hhiChange = item.newHHI - item.currentHHI;
                    
                    return (
                      <TableRow key={item.msa} className={hasChange ? "bg-green-50/50" : ""}>
                        <TableCell className="font-medium">
                          {item.msa}
                          {hasChange && (
                            <TrendingUp className="inline-block ml-2 h-4 w-4 text-green-600" />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.currentMarketShare > 0 ? `${item.currentMarketShare.toFixed(1)}%` : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.acquiredMarketShare > 0 ? (
                            <div className="space-y-0.5">
                              <div className="text-green-600 font-medium">
                                +{item.acquiredMarketShare.toFixed(1)}%
                              </div>
                              {haircutPercentage > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  ({haircutAdjustedAcquiredShare.toFixed(1)}% after {haircutPercentage.toFixed(2)}% haircut)
                                </div>
                              )}
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {projectedShare.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right">
                          {hasChange ? (
                            <Badge className="bg-green-100 text-green-800 border-green-300">
                              +{change.toFixed(1)}%
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {hhiChange !== 0 ? (
                            <Badge 
                              variant="outline"
                              className={
                                hhiChange > 200 ? "bg-red-50 text-red-700 border-red-300" :
                                hhiChange > 100 ? "bg-amber-50 text-amber-700 border-amber-300" :
                                "bg-blue-50 text-blue-700 border-blue-300"
                              }
                            >
                              {hhiChange > 0 ? "+" : ""}{hhiChange}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(item.marketSize)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No footprint data available for {acquiringProvider}</p>
            </div>
          )}
        </Card>
      )}

      {/* News Section */}
      {acquiringProvider && providersBeingAcquired.length > 0 && (
        <Card className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Newspaper className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="mb-0">Recent News & Updates</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Latest news articles about the franchises being acquired (last 30 days)
              </p>
            </div>
          </div>

          {loadingNews ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-blue-600" />
                <p className="text-sm">Loading news articles...</p>
              </div>
            </div>
          ) : newsError ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">{newsError}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {providersBeingAcquired.map((provider) => {
                const articles = newsArticles[provider] || [];
                return (
                  <div key={provider} className="bg-white rounded-lg border border-blue-200 p-4">
                    <h4 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {provider}
                      <Badge variant="outline" className="ml-auto">
                        {articles.length} article{articles.length !== 1 ? 's' : ''}
                      </Badge>
                    </h4>
                    
                    {articles.length > 0 ? (
                      <ScrollArea className="h-[300px] pr-4">
                        <div className="space-y-3">
                          {articles.map((article) => (
                            <div 
                              key={article.url || article.title} 
                              className="p-3 bg-gradient-to-r from-blue-50/50 to-cyan-50/50 rounded-lg border border-blue-100 hover:border-blue-300 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <a 
                                    href={article.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="font-medium text-sm text-blue-900 hover:text-blue-600 hover:underline line-clamp-2"
                                  >
                                    {article.title}
                                  </a>
                                  {article.domain && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {article.domain}
                                    </p>
                                  )}
                                  {article.seendate && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {new Date(
                                        article.seendate.substring(0, 4) + '-' +
                                        article.seendate.substring(4, 6) + '-' +
                                        article.seendate.substring(6, 8)
                                      ).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                                <a
                                  href={article.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-shrink-0"
                                >
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <ExternalLink className="h-4 w-4 text-blue-600" />
                                  </Button>
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        No recent news articles found for this provider
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
