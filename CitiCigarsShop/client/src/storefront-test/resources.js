import { useQuery } from "@tanstack/react-query";
import { loadCatalogue, loadProduct } from "./catalogue";

const verifyOnEntry = {
  staleTime: 0,
  gcTime: 0,
  retry: false,
  networkMode: "always",
  refetchOnMount: "always",
  refetchOnWindowFocus: "always",
  refetchOnReconnect: "always",
};

export function useCatalogue() {
  return useQuery({ ...verifyOnEntry, queryKey: ["test-catalogue"], queryFn: ({ signal }) => loadCatalogue(signal) });
}

export function useProduct(sku) {
  return useQuery({ ...verifyOnEntry, queryKey: ["test-product", sku], queryFn: ({ signal }) => loadProduct(sku, signal) });
}

export function confirmed(resource) {
  return resource.isSuccess && !resource.isFetching ? resource.data : undefined;
}
