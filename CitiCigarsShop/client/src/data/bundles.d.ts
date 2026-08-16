export interface BundleSeedProduct {
  sku: string;
  marque: string;
  modele?: string;
  description?: string;
  prixBundle?: number;
  prixUnitaire?: number;
  composition?: unknown[];
}

export const bundlesData: BundleSeedProduct[];
