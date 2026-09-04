export type Signal = {
  id: string;
  priority: 'HAUTE' | 'MOYENNE' | 'BASSE';
  domain: string;
  title: string;
  reason: string;
  source: string;
  freshness: string;
  state: 'ACTIF' | 'RÉSOLU' | 'EN_ATTENTE';
  targetType: 'STOCK' | 'FOURNISSEUR' | 'CLIENT';
  targetId: string;
};

export type Approval = {
  id: string;
  level: 'A3' | 'A4' | 'A5';
  category: 'Agents' | 'Achats' | 'Campagnes' | 'CRM' | 'Stock' | 'Autres';
  risk: 'Faible' | 'Modéré' | 'Élevé' | 'Critique';
  requester: string;
  object: string;
  amount?: string;
  evidence: string[];
  state: 'REQUIERT_DÉCISION' | 'APPROUVÉ' | 'REJETÉ';
  expiration: string;
};

export type Order = {
  id: string;
  date: string;
  totalXAF: number;
  status: 'LIVRÉ' | 'EN_COURS' | 'ANNULÉ';
  items: string;
};

export type Interaction = {
  date: string;
  type: string;
  summary: string;
  agent: string;
};

export type Client360 = {
  id: string;
  ctcgLinked: boolean;
  identity: { name: string; email: string; phone?: string };
  dna: string[];
  activity: string;
  recommendations: { sku: string; availability: string; source: string }[];
  kpis: { lifetimeValueXAF: number; totalOrders: number; averageOrderValueXAF: number; lastOrderDate: string };
  orders: Order[];
  interactions: Interaction[];
};

export type SupplierOpportunity = {
  id: string;
  supplierName: string;
  emailSource: string;
  attachments: string[];
  matching: number;
  proposedEconomics: { currency: string; amount: number };
  confidence: number;
  shadowState: 'DRAFT_SHADOW' | 'EVALUATION';
  canonicalProfile: {
    category: string;
    rating: string;
    paymentTerms: string;
  };
  poHistory: {
    poId: string;
    date: string;
    status: string;
    totalXAF: number;
    items: { sku: string; qty: number; unitPriceXAF: number }[];
  }[];
};

export type Stock360 = {
  sku: string;
  brand: string;
  type: string;
  packSize: number;
  aggregate: number;
  reserved: number;
  allocated: number;
  location: string;
  lot: string;
  provenance: string;
  freshness: string;
  unitValueXAF: number;
  immobilizedValueXAF: number;
  rotationCategory: 'Rapide' | 'Moyenne' | 'Lente';
  age: string;
  lotDetails: {
    id: string;
    lot: string;
    location: string;
    quantity: number;
    status: string;
  }[];
};

export type Capability = {
  id: string;
  agent: string;
  tool: string;
  risk: 'R0' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5';
  state: 'ACTIVE' | 'SHADOW' | 'DRAFT' | 'SUSPENDED';
  approval: string;
};

export type Replay = {
  id: string;
  timestamp: string;
  inputs: string;
  evidence: string;
  rules: string;
  model: string;
  decision: string;
  result: string;
  details: string;
};

export type HumanGovernance = {
  id: string;
  name: string;
  role: string;
  rights: string[];
  delegations: string[];
  restrictions: string[];
};

export const FIXTURES = {
  signals: [
    {
      id: 'SIG-20260904-01',
      priority: 'HAUTE',
      domain: 'Stock Central',
      title: 'Divergence d\'inventaire critique',
      reason: 'Écart détecté entre les allocations physiques et le grand livre sur Partagás Serie D No. 4',
      source: 'Agent Inventaire',
      freshness: 'Il y a 2 min',
      state: 'ACTIF',
      targetType: 'STOCK',
      targetId: 'CTCG001020'
    },
    {
      id: 'SIG-20260904-02',
      priority: 'MOYENNE',
      domain: 'Supplier Watcher',
      title: 'Nouvelle offre fournisseur interceptée',
      reason: 'Email de distribution Habanos SA avec fichier PDF joint',
      source: "Passerelle d'ingestion des courriels",
      freshness: 'Il y a 14 min',
      state: 'EN_ATTENTE',
      targetType: 'FOURNISSEUR',
      targetId: 'OPP-112'
    },
    {
      id: 'SIG-20260904-03',
      priority: 'MOYENNE',
      domain: 'CRM',
      title: 'Conflit de profil client',
      reason: 'Deux profils partagent le même numéro WhatsApp',
      source: 'Agent Qualité des données',
      freshness: 'Il y a 1 heure',
      state: 'ACTIF',
      targetType: 'CLIENT',
      targetId: 'CLI-8821'
    }
  ] as Signal[],

  approvals: [
    {
      id: 'APP-094-102',
      level: 'A4',
      category: 'Achats',
      risk: 'Élevé',
      requester: 'Agent Achats (observation)',
      object: 'Bon de commande #PO-4092 - Habanos SA',
      amount: '9 511 376 FCFA',
      evidence: ['Facture proforma PDF', 'Politique de réapprovisionnement R-04', 'Historique des prix stable'],
      state: 'REQUIERT_DÉCISION',
      expiration: 'Expire dans 4 heures'
    },
    {
      id: 'APP-094-103',
      level: 'A5',
      category: 'Agents',
      risk: 'Critique',
      requester: 'Capability Control Center',
      object: 'Activation de l\'action "purchaseOrder.issueApproved"',
      evidence: ['Rapport d\'évaluation Q3', 'Validation de sécurité (0 incidents)'],
      state: 'REQUIERT_DÉCISION',
      expiration: 'Expire dans 2 jours'
    },
    {
      id: 'APP-094-105',
      level: 'A3',
      category: 'Campagnes',
      risk: 'Faible',
      requester: 'Agent CRM / Suivi',
      object: 'Envoi d\'une campagne WhatsApp segmentée (42 clients)',
      evidence: ['Consentement vérifié', 'Validation des stocks ciblés'],
      state: 'REQUIERT_DÉCISION',
      expiration: 'Expire dans 12 heures'
    }
  ] as Approval[],

  clients: [
    {
      id: 'CLI-8821',
      ctcgLinked: true,
      identity: { name: 'Jean-Baptiste L.', email: 'jbl@example.com', phone: '+33 6 12 34 56 78' },
      dna: ['Préférence Maduro', 'Achat régulier de robustos', 'Sensible aux éditions limitées'],
      activity: 'Dernier achat il y a 14 jours (Boutique)',
      recommendations: [
        { sku: 'CTCG001020', availability: '14 boîtes', source: 'Stock Central — inférence simulée' }
      ],
      kpis: { lifetimeValueXAF: 4500000, totalOrders: 12, averageOrderValueXAF: 375000, lastOrderDate: '2026-08-20' },
      orders: [
        { id: 'ORD-2026-08-20', date: '2026-08-20', totalXAF: 420000, status: 'LIVRÉ', items: '2x Partagás Serie D No. 4' },
        { id: 'ORD-2026-05-11', date: '2026-05-11', totalXAF: 330000, status: 'LIVRÉ', items: '1x Cohiba Siglo II, Accessoires' }
      ],
      interactions: [
        { date: '2026-09-01', type: 'Email', summary: 'Campagne nouveautés envoyée', agent: 'Agent CRM' },
        { date: '2026-08-22', type: 'WhatsApp', summary: 'Confirmation de livraison', agent: 'Support Client' }
      ]
    },
    {
      id: 'CLI-8822',
      ctcgLinked: false,
      identity: { name: 'Marc V.', email: 'marcv@example.com' },
      dna: ['Explorateur', 'Budget modéré', 'Format Corona privilégié'],
      activity: 'Dernier clic sur campagne email hier',
      recommendations: [
        { sku: 'CTCG001045', availability: '42 boîtes', source: 'Stock Central — inférence simulée' }
      ],
      kpis: { lifetimeValueXAF: 125000, totalOrders: 1, averageOrderValueXAF: 125000, lastOrderDate: '2025-11-10' },
      orders: [
        { id: 'ORD-2025-11-10', date: '2025-11-10', totalXAF: 125000, status: 'LIVRÉ', items: '1x Romeo y Julieta Mille Fleurs' }
      ],
      interactions: [
        { date: '2026-09-03', type: 'Email', summary: 'Clic sur newsletter', agent: 'Système' }
      ]
    }
  ] as Client360[],

  stock: [
    {
      sku: 'CTCG001020',
      brand: 'Partagás',
      type: 'Serie D No. 4',
      packSize: 25,
      aggregate: 150,
      reserved: 20,
      allocated: 30,
      location: 'WH-Principal (Genève)',
      lot: 'L-2025-08',
      provenance: 'Habanos SA Direct',
      freshness: 'Immédiat',
      unitValueXAF: 15700,
      immobilizedValueXAF: 2355000,
      rotationCategory: 'Rapide',
      age: '2 mois',
      lotDetails: [
        { id: 'LD-1', lot: 'L-2025-08', location: 'WH-Principal (Genève)', quantity: 100, status: 'Disponible' },
        { id: 'LD-2', lot: 'L-2025-07', location: 'WH-Secondaire (Paris)', quantity: 50, status: 'Réservé' }
      ]
    },
    {
      sku: 'CTCG001045',
      brand: 'Cohiba',
      type: 'Siglo II',
      packSize: 25,
      aggregate: 30,
      reserved: 10,
      allocated: 0,
      location: 'WH-Réserve (Vault)',
      lot: 'L-2024-11',
      provenance: 'Marché secondaire vérifié',
      freshness: 'Immédiat',
      unitValueXAF: 29500,
      immobilizedValueXAF: 885000,
      rotationCategory: 'Lente',
      age: '8 mois',
      lotDetails: [
        { id: 'LD-3', lot: 'L-2024-11', location: 'WH-Réserve (Vault)', quantity: 30, status: 'Disponible' }
      ]
    },
    {
      sku: 'CTCG001102',
      brand: 'Romeo y Julieta',
      type: 'Wide Churchills',
      packSize: 10,
      aggregate: 0,
      reserved: 0,
      allocated: 0,
      location: 'N/A',
      lot: 'N/A',
      provenance: 'Rupture',
      freshness: 'Immédiat',
      unitValueXAF: 18300,
      immobilizedValueXAF: 0,
      rotationCategory: 'Moyenne',
      age: 'N/A',
      lotDetails: []
    }
  ] as Stock360[],

  suppliers: [
    {
      id: 'OPP-112',
      supplierName: 'Distributeur A (Espagne)',
      emailSource: 'offre-speciale-sep@distributeur-a.es',
      attachments: ['liste_prix_q4.pdf'],
      matching: 98.5,
      proposedEconomics: { currency: 'EUR', amount: 4500 },
      confidence: 94,
      shadowState: 'EVALUATION',
      canonicalProfile: {
        category: 'Distributeur Agréé',
        rating: 'A (Très Fiable)',
        paymentTerms: '30 Jours Fin de Mois'
      },
      poHistory: [
        { poId: 'PO-4091', date: '2026-06-15', status: 'LIVRÉ', totalXAF: 2850000, items: [{ sku: 'CTCG001020', qty: 200, unitPriceXAF: 14250 }] }
      ]
    },
    {
      id: 'OPP-113',
      supplierName: 'Grossiste Inconnu',
      emailSource: 'sales@cigars-wholesale-cheap.com',
      attachments: ['catalog.xlsx'],
      matching: 12.0,
      proposedEconomics: { currency: 'USD', amount: 0 },
      confidence: 5,
      shadowState: 'DRAFT_SHADOW',
      canonicalProfile: {
        category: 'Grossiste Non-Vérifié',
        rating: 'D (Risqué)',
        paymentTerms: 'Paiement Avance'
      },
      poHistory: []
    }
  ] as SupplierOpportunity[],

  capabilities: [
    {
      id: 'CAP-READ-INV',
      agent: 'Agent Inventaire',
      tool: 'inventory.getReconciledPosition',
      risk: 'R0',
      state: 'ACTIVE',
      approval: 'A0 (Lecture seule)'
    },
    {
      id: 'CAP-PROP-PUR',
      agent: 'Supplier Watcher',
      tool: 'purchaseOpportunity.createDraft',
      risk: 'R2',
      state: 'SHADOW',
      approval: 'A1 (politique automatique)'
    },
    {
      id: 'CAP-ACT-PO',
      agent: 'Agent Achats',
      tool: 'purchaseOrder.issueApproved',
      risk: 'R4',
      state: 'SUSPENDED',
      approval: 'A4 (Owner)'
    }
  ] as Capability[],

  replay: [
    {
      id: 'REP-84992',
      timestamp: '2026-09-04 08:12:45',
      inputs: 'Email reçu de Distributeur A avec PDF',
      evidence: 'Hash PDF: a8f4...e9',
      rules: 'Politique Supplier Watcher v1.2',
      model: 'Extraction v4 (ancrée dans les preuves)',
      decision: 'Création d\'un brouillon d\'opportunité (OPP-112)',
      result: "Exécuté avec succès en mode d'observation",
      details: "L'agent a lu le PDF, extrait les références croisées avec le stock actuel, validé les règles de réassort (R-04) et statué qu'une opportunité devait être créée en Shadow pour l'évaluation A4."
    },
    {
      id: 'REP-84991',
      timestamp: '2026-09-04 07:30:10',
      inputs: 'Demande CRM pour campagne',
      evidence: 'Consentement client vérifié en DB',
      rules: 'Politique de communication v2.0',
      model: 'N/A (Règle déterministe)',
      decision: 'Requiert approbation A3',
      result: 'En attente d\'approbation',
      details: "Identification du sous-segment (42 profils) basé sur la tolérance de communication. Blocage strict car le seuil de 30 profils pour une campagne automatisée est dépassé. Escalade vers A3."
    }
  ] as Replay[],

  humans: [
    {
      id: 'HUM-001',
      name: 'Owner (Système)',
      role: 'Administrateur Suprême',
      rights: ['Accès R1 (Lecture seule)', 'Dérogation A5', 'Désactivation Agents'],
      delegations: [],
      restrictions: ['Mutations directes désactivées (R1)']
    },
    {
      id: 'HUM-002',
      name: 'Opérateur Achats',
      role: 'Valideur Niveau 1',
      rights: ['Validation A3'],
      delegations: ['Achats mineurs < 2000 EUR délégués au Supplier Watcher'],
      restrictions: ['Approbation A4 requise pour nouveaux fournisseurs']
    }
  ] as HumanGovernance[]
};
