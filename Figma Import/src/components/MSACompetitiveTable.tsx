import React, { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Button } from "./ui/button";
import { ChevronDown, ChevronUp, Search, X, Filter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

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
  Weighted_Average_Score?: number;
}

interface MSACompetitiveTableProps {
  opportunities: OpportunityData[];
  limit?: number;
  hideMarketSize?: boolean;
  allOpportunities?: OpportunityData[]; // National-level data for MSAs count
  selectedProviders?: Set<string>;
  onToggleProviderSelection?: (provider: string) => void;
}

type SortField = 'provider' | 'share' | 'risk' | 'satisfaction' | 'msas';
type SortDirection = 'asc' | 'desc' | null;

interface NumericFilter {
  operator: '>' | '<' | '=' | 'all';
  value: string;
}

export function MSACompetitiveTable({ opportunities, limit = 50, hideMarketSize = false, allOpportunities, selectedProviders, onToggleProviderSelection }: MSACompetitiveTableProps) {
  // Filter state
  const [providerSearch, setProviderSearch] = useState("");
  const [shareFilter, setShareFilter] = useState<NumericFilter>({ operator: 'all', value: '' });
  const [riskFilter, setRiskFilter] = useState<NumericFilter>({ operator: 'all', value: '' });
  const [satisfactionFilter, setSatisfactionFilter] = useState<NumericFilter>({ operator: 'all', value: '' });
  const [msasFilter, setMsasFilter] = useState<NumericFilter>({ operator: 'all', value: '' });
  
  // Sort state
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const formatPercentage = (value: number | string) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return "0.0%";
    return `${(num * 100).toFixed(1)}%`;
  };

  // Calculate average satisfaction score per provider
  const providerSatisfactionScores = useMemo(() => {
    const scoresByProvider = new Map<string, number[]>();
    
    opportunities.forEach(opp => {
      let score = opp.Weighted_Average_Score;
      if (score === undefined || score === null) {
        score = (opp as any)["Weighted Average Score"] || (opp as any)["weighted_average_score"];
      }
      
      if (score !== null && score !== undefined) {
        const numScore = Number(score);
        if (!isNaN(numScore)) {
          if (!scoresByProvider.has(opp.Provider)) {
            scoresByProvider.set(opp.Provider, []);
          }
          scoresByProvider.get(opp.Provider)!.push(numScore);
        }
      }
    });
    
    const averageScores = new Map<string, number>();
    scoresByProvider.forEach((scores, provider) => {
      if (scores.length > 0) {
        const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        averageScores.set(provider, average);
      }
    });
    
    return averageScores;
  }, [opportunities]);

  // Calculate MSAs penetrated per provider - use national data if available
  const providerMSAsCounts = useMemo(() => {
    const msasByProvider = new Map<string, Set<string>>();
    
    const dataSource = allOpportunities && allOpportunities.length > 0 ? allOpportunities : opportunities;
    
    dataSource.forEach(opp => {
      if (!msasByProvider.has(opp.Provider)) {
        msasByProvider.set(opp.Provider, new Set());
      }
      msasByProvider.get(opp.Provider)!.add(opp.MSA);
    });
    
    const counts = new Map<string, number>();
    msasByProvider.forEach((msas, provider) => {
      counts.set(provider, msas.size);
    });
    
    return counts;
  }, [opportunities, allOpportunities]);

  // Calculate risk percentage for a provider
  const calculateRiskPercentage = (opp: OpportunityData): number => {
    const marketShare = parseFloat(String(opp["Market Share"] || 0));
    const marketSize = parseFloat(String(opp["Market Size"] || 0));
    const defendDollars = parseFloat(String(opp["Defend $"] || 0));
    const providerMarketShareDollars = marketShare * marketSize;
    
    if (providerMarketShareDollars === 0) return 0;
    
    return (defendDollars / providerMarketShareDollars) * 100;
  };

  // Apply numeric filter
  const applyNumericFilter = (value: number, filter: NumericFilter): boolean => {
    if (filter.operator === 'all' || filter.value === '') return true;
    
    const filterValue = parseFloat(filter.value);
    if (isNaN(filterValue)) return true;
    
    switch (filter.operator) {
      case '>':
        return value > filterValue;
      case '<':
        return value < filterValue;
      case '=':
        return Math.abs(value - filterValue) < 0.01;
      default:
        return true;
    }
  };

  // Filtered and sorted data
  const processedData = useMemo(() => {
    let filtered = opportunities.filter(opp => {
      if (providerSearch && !opp.Provider.toLowerCase().includes(providerSearch.toLowerCase())) {
        return false;
      }
      
      const marketShare = parseFloat(String(opp["Market Share"] || 0)) * 100;
      if (!applyNumericFilter(marketShare, shareFilter)) {
        return false;
      }
      
      const riskPercentage = calculateRiskPercentage(opp);
      if (!applyNumericFilter(riskPercentage, riskFilter)) {
        return false;
      }
      
      const satisfactionScore = providerSatisfactionScores.get(opp.Provider);
      if (satisfactionScore !== undefined) {
        const satisfactionPercentage = satisfactionScore * 20;
        if (!applyNumericFilter(satisfactionPercentage, satisfactionFilter)) {
          return false;
        }
      } else if (satisfactionFilter.operator !== 'all' && satisfactionFilter.value !== '') {
        return false;
      }
      
      const msasCount = providerMSAsCounts.get(opp.Provider) || 0;
      if (!applyNumericFilter(msasCount, msasFilter)) {
        return false;
      }
      
      return true;
    });
    
    if (sortField && sortDirection) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: number | string = 0;
        let bValue: number | string = 0;
        
        switch (sortField) {
          case 'provider':
            aValue = a.Provider;
            bValue = b.Provider;
            break;
          case 'share':
            aValue = parseFloat(String(a["Market Share"] || 0));
            bValue = parseFloat(String(b["Market Share"] || 0));
            break;
          case 'risk':
            aValue = calculateRiskPercentage(a);
            bValue = calculateRiskPercentage(b);
            break;
          case 'satisfaction':
            aValue = providerSatisfactionScores.get(a.Provider) || 0;
            bValue = providerSatisfactionScores.get(b.Provider) || 0;
            break;
          case 'msas':
            aValue = providerMSAsCounts.get(a.Provider) || 0;
            bValue = providerMSAsCounts.get(b.Provider) || 0;
            break;
        }
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        } else {
          const numA = typeof aValue === 'number' ? aValue : 0;
          const numB = typeof bValue === 'number' ? bValue : 0;
          return sortDirection === 'asc' ? numA - numB : numB - numA;
        }
      });
    }
    
    return filtered;
  }, [opportunities, providerSearch, shareFilter, riskFilter, satisfactionFilter, msasFilter, sortField, sortDirection, providerSatisfactionScores, providerMSAsCounts]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const clearFilters = () => {
    setProviderSearch("");
    setShareFilter({ operator: 'all', value: '' });
    setRiskFilter({ operator: 'all', value: '' });
    setSatisfactionFilter({ operator: 'all', value: '' });
    setMsasFilter({ operator: 'all', value: '' });
    setSortField(null);
    setSortDirection(null);
  };

  const hasActiveFilters = providerSearch || 
    shareFilter.operator !== 'all' || 
    riskFilter.operator !== 'all' || 
    satisfactionFilter.operator !== 'all' || 
    msasFilter.operator !== 'all';

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown className="h-3 w-3 opacity-30" />;
    if (sortDirection === 'asc') return <ChevronUp className="h-3 w-3 opacity-100" />;
    if (sortDirection === 'desc') return <ChevronDown className="h-3 w-3 opacity-100" />;
    return null;
  };

  const NumericFilterPopover = ({ 
    label, 
    filter, 
    setFilter,
    unit = '%'
  }: { 
    label: string; 
    filter: NumericFilter; 
    setFilter: (f: NumericFilter) => void;
    unit?: string;
  }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className={`h-6 px-2 ${filter.operator !== 'all' ? 'bg-blue-50 text-blue-700' : ''}`}
        >
          <Filter className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end">
        <div className="space-y-2">
          <Label className="text-xs font-semibold">{label}</Label>
          <div className="flex gap-2">
            <Select 
              value={filter.operator} 
              onValueChange={(value) => setFilter({ ...filter, operator: value as NumericFilter['operator'] })}
            >
              <SelectTrigger className="w-20 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value=">">&gt;</SelectItem>
                <SelectItem value="<">&lt;</SelectItem>
                <SelectItem value="=">=</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              step="0.1"
              placeholder={`Value (${unit})`}
              value={filter.value}
              onChange={(e) => setFilter({ ...filter, value: e.target.value })}
              className="h-8 text-xs flex-1"
              disabled={filter.operator === 'all'}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="space-y-3">
      {/* Filters Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Search providers..."
            value={providerSearch}
            onChange={(e) => setProviderSearch(e.target.value)}
            className="h-8 text-xs pl-7"
          />
        </div>
        
        {hasActiveFilters && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={clearFilters}
            className="h-8 text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Clear Filters
          </Button>
        )}
        
        <div className="text-xs text-muted-foreground ml-auto">
          {processedData.length} of {opportunities.length} providers
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px] text-xs h-8 py-2">#</TableHead>
              <TableHead className="text-xs h-8 py-2">
                <button 
                  onClick={() => handleSort('provider')}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  Provider
                  <SortIcon field="provider" />
                </button>
              </TableHead>
              <TableHead className="text-right text-xs h-8 py-2">
                <div className="flex items-center justify-end gap-1">
                  <button 
                    onClick={() => handleSort('share')}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    Share
                    <SortIcon field="share" />
                  </button>
                  <NumericFilterPopover 
                    label="Market Share Filter" 
                    filter={shareFilter} 
                    setFilter={setShareFilter}
                    unit="%"
                  />
                </div>
              </TableHead>
              <TableHead className="text-right text-xs h-8 py-2">
                <div className="flex items-center justify-end gap-1">
                  <button 
                    onClick={() => handleSort('risk')}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    Risk
                    <SortIcon field="risk" />
                  </button>
                  <NumericFilterPopover 
                    label="Risk Filter" 
                    filter={riskFilter} 
                    setFilter={setRiskFilter}
                    unit="%"
                  />
                </div>
              </TableHead>
              <TableHead className="text-right text-xs h-8 py-2">
                <div className="flex items-center justify-end gap-1">
                  <button 
                    onClick={() => handleSort('satisfaction')}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    Satisfaction
                    <SortIcon field="satisfaction" />
                  </button>
                  <NumericFilterPopover 
                    label="Satisfaction Filter" 
                    filter={satisfactionFilter} 
                    setFilter={setSatisfactionFilter}
                    unit="%"
                  />
                </div>
              </TableHead>
              <TableHead className="text-right text-xs h-8 py-2">
                <div className="flex items-center justify-end gap-1">
                  <button 
                    onClick={() => handleSort('msas')}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    MSAs
                    <SortIcon field="msas" />
                  </button>
                  <NumericFilterPopover 
                    label="MSAs Count Filter" 
                    filter={msasFilter} 
                    setFilter={setMsasFilter}
                    unit="#"
                  />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processedData.length > 0 ? (
              processedData
                .slice(0, limit)
                .map((opp, idx) => {
                  const satisfactionScore = providerSatisfactionScores.get(opp.Provider);
                  const satisfactionDisplay = satisfactionScore !== undefined 
                    ? `${(satisfactionScore * 20).toFixed(1)}%`
                    : "N/A";
                  
                  const msasCount = providerMSAsCounts.get(opp.Provider) || 0;
                  const riskPercentage = calculateRiskPercentage(opp);
                  const isSelected = selectedProviders?.has(opp.Provider);
                  
                  return (
                <TableRow 
                  key={idx} 
                  className={`h-8 transition-colors ${
                    onToggleProviderSelection 
                      ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30' 
                      : ''
                  } ${
                    isSelected 
                      ? 'bg-blue-100 dark:bg-blue-900/40 border-l-4 border-l-blue-500' 
                      : ''
                  }`}
                  onClick={() => onToggleProviderSelection?.(opp.Provider)}
                >
                  <TableCell className="font-medium text-xs py-1">{idx + 1}</TableCell>
                  <TableCell className="text-xs py-1 truncate max-w-[100px]" title={opp.Provider}>
                    <span className={isSelected ? 'font-semibold' : ''}>{opp.Provider}</span>
                  </TableCell>
                  <TableCell className="text-right text-xs py-1">{formatPercentage(opp["Market Share"])}</TableCell>
                  <TableCell className="text-right text-xs py-1">
                     {(() => {
                       let display = `${riskPercentage.toFixed(1)}%`;
                       let colorClass = "";
                       
                       if (riskPercentage < 5) {
                         display = "<5%";
                         colorClass = "bg-green-50 text-green-700 border-green-300";
                       } else if (riskPercentage > 25) {
                         display = ">25%";
                         colorClass = "bg-red-50 text-red-700 border-red-300";
                       }
                       
                       if (colorClass) {
                         return <Badge variant="outline" className={`text-[10px] px-1 py-0 ${colorClass}`}>{display}</Badge>;
                       }
                       return <span className="text-xs">{display}</span>;
                     })()}
                  </TableCell>
                  <TableCell className="text-right text-xs py-1">{satisfactionDisplay}</TableCell>
                  <TableCell className="text-right text-xs py-1">{msasCount}</TableCell>
                </TableRow>
                  );
                })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-16 text-muted-foreground text-xs">
                  No matching providers found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
