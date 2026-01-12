// Custom hooks for fetching data from CSV files
// React hooks and functions for fetching CSV data

import { useState, useEffect } from 'react';
import { csvDataService } from './csvDataService';

// Hook to fetch filter buckets
export const useFilterBuckets = () => {
  const [filterBuckets, setFilterBuckets] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBuckets = async () => {
      try {
        const data = await csvDataService.getFilterBuckets();
        setFilterBuckets(data);
      } catch (err) {
        console.error("Error fetching filter buckets:", err);
        setError(err instanceof Error ? err.message : 'Failed to load filter buckets');
      } finally {
        setLoading(false);
      }
    };

    fetchBuckets();
  }, []);

  return { filterBuckets, loading, error };
};

// Hook to fetch MSA details
export const useMSADetails = (msaName: string | null) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!msaName) {
      setData(null);
      return;
    }

    const fetchMSADetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await csvDataService.getMSADetails(msaName);
        setData(result);
      } catch (err) {
        console.error("Error fetching MSA details:", err);
        setError(err instanceof Error ? err.message : 'Failed to load MSA details');
      } finally {
        setLoading(false);
      }
    };

    fetchMSADetails();
  }, [msaName]);

  return { data, loading, error };
};

// Hook to fetch opportunities
export const useOpportunities = () => {
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOpportunities = async () => {
      try {
        const data = await csvDataService.getOpportunities();
        setOpportunities(data);
      } catch (err) {
        console.error("Error fetching opportunities:", err);
        setError(err instanceof Error ? err.message : 'Failed to load opportunities');
      } finally {
        setLoading(false);
      }
    };

    fetchOpportunities();
  }, []);

  return { opportunities, loading, error };
};

// Hook to fetch raw opportunities
export const useOpportunitiesRaw = () => {
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOpportunities = async () => {
      try {
        const data = await csvDataService.getOpportunitiesRaw();
        setOpportunities(data);
      } catch (err) {
        console.error("Error fetching raw opportunities:", err);
        setError(err instanceof Error ? err.message : 'Failed to load raw opportunities');
      } finally {
        setLoading(false);
      }
    };

    fetchOpportunities();
  }, []);

  return { opportunities, loading, error };
};

// Hook to fetch market data
export const useMarketData = () => {
  const [marketData, setMarketData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const data = await csvDataService.getMarketData();
        setMarketData(data);
      } catch (err) {
        console.error("Error fetching market data:", err);
        setError(err instanceof Error ? err.message : 'Failed to load market data');
      } finally {
        setLoading(false);
      }
    };

    fetchMarketData();
  }, []);

  return { marketData, loading, error };
};

// Hook to fetch deposit data
export const useDepositData = () => {
  const [depositData, setDepositData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDepositData = async () => {
      try {
        const data = await csvDataService.getDepositData();
        setDepositData(data);
      } catch (err) {
        console.error("Error fetching deposit data:", err);
        setError(err instanceof Error ? err.message : 'Failed to load deposit data');
      } finally {
        setLoading(false);
      }
    };

    fetchDepositData();
  }, []);

  return { depositData, loading, error };
};

// Direct API-like functions for components that need them
export const fetchFilterBuckets = () => csvDataService.getFilterBuckets();
export const fetchMSADetails = (msaName: string) => csvDataService.getMSADetails(msaName);
export const fetchOpportunities = () => csvDataService.getOpportunities();
export const fetchOpportunitiesRaw = () => csvDataService.getOpportunitiesRaw();
export const fetchAllOpportunitiesRaw = () => csvDataService.getAllOpportunitiesRaw();
export const fetchMarketData = () => csvDataService.getMarketData();
export const fetchDepositData = () => csvDataService.getDepositData();
