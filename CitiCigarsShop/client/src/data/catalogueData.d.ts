export interface CatalogueSeedProduct {
  sku: string;
  marque: string;
  ligne?: string;
  pays?: string;
  modele?: string;
  vitole?: string;
  format?: string;
  dimensions?: string;
  qteBoite?: number;
  typePack?: number;
  puissance?: number;
  rating?: number;
  top25?: boolean;
  rank?: number;
  year?: number;
  prixUnitaire?: number;
  prixBoite?: number;
  prixPack?: number;
  inCatalogue?: boolean;
}

export const catalogueData: CatalogueSeedProduct[];
