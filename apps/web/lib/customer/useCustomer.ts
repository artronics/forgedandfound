"use client";

import {useCallback, useEffect, useState} from "react";
import {type CustomerResponse, fetchCustomer} from "@/lib/shopify/client/customer-client";

export function useCustomer() {
  const [data, setData] = useState<CustomerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchCustomer();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  return {
    data,
    loading,
    error,
    refetch: load,
  };
}