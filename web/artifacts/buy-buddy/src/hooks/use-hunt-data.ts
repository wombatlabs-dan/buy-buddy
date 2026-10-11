import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useHuntResult(query: string | undefined, maxPrice: number | undefined) {
  return useQuery({
    queryKey: ["hunt", query, maxPrice],
    queryFn: () => api.startHunt({ query: query!, maxPrice: maxPrice! }),
    enabled: !!query && !!maxPrice,
    staleTime: Infinity,
  });
}

export function useListing(query: string | undefined, id: string) {
  return useQuery({
    queryKey: ["listing", query, id],
    queryFn: () => api.getListing(query!, id),
    enabled: !!query,
    staleTime: Infinity,
  });
}
