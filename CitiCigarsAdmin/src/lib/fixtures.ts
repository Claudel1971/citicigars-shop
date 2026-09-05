export type Account = {
  id: string;
  name: string;
  type: 'B2B' | 'B2C_Group';
  status: 'Actif' | 'Inactif';
  industry?: string;
  contacts: string[];
  leads: string[];
};

export type Signal = {
  id: string;
  priority: 'HAUTE' | 'MOYENNE' | 'BASSE';
  domain: string;
  title: string;
  reason: string;
  source: string;
  freshness: string;
  state: 'ACTIF' | 'RÉSOLU' | 'EN_ATTENTE';
  targetType: 'STOCK' | 'FOURNISSEUR' | 'CLIENT' | 'LEAD' | 'ACCOUNT';
  targetId: string;
};

export type LeadOwner = {
  current: string;
  conversation: string;
  commercialDecision: string;
  physicalExecution: string;
};

export type AcceptanceProof = {
  type: string;
  timestamp: string;
  evidence: string;
};

export type Handoff = {
  id: string;
  from: string;
  to: string;
  incomingOwnerId: string;
  context: string;
  source: string;
  promise: string;
  interests: string[];
  consentChannel: string;
  step: string;
  expectedDecision: string;
  deadline: string;
  acceptedAt?: string;
  acceptanceProof?: AcceptanceProof;
  evidence?: string;
};

export type AttributionEvidence = {
  id: string;
  type: string;
  timestamp: string;
  source: string;
  proof: string;
  confidence: number;
};

export type Attribution = {
  attributionStatus: 'attributed' | 'unattributed' | 'partially_attributed' | 'offline_unverified';
  unattributedReason?: string;
  initialSource: string;
  leadCreationSource: string;
  conversionSource: string;
  influences: string[];
  campaignId: string;
  experimentId: string;
  touchpointId: string;
  relationshipOrigin: string;
  relationshipDistance: '0' | '1' | '2' | '3' | 'unknown';
  claudelIntervention: 'none' | 'light' | 'significant' | 'closing';
  confidence: number;
  evidence: AttributionEvidence[];
};

export type NextAction = {
  type: string;
  description: string;
  ownerId: string;
  dueAt: string;
  mandatory: boolean;
};

export type Consent = {
  version: string;
  status: 'granted' | 'pending' | 'withdrawn';
  purpose: string;
  channels: string[];
  textVersion: string;
  capturedAt: string;
  source: string;
  proof: string;
  capturedBy: string;
  withdrawnAt?: string;
  adultVerified: boolean;
};

export type StageHistoryEntry = {
  changedAt: string;
  previousStage: string | null;
  stage: string;
  changedBy: string;
  reason: string;
};

export type Lead = {
  id: string;
  title: string;
  accountId?: string;
  clientId?: string;
  orderId?: string;
  paymentId?: string;
  pipelineStage: 'captured' | 'contact_pending' | 'contacted' | 'responded' | 'qualified' | 'offer_or_dna' | 'commercial_decision' | 'won_pending_payment' | 'paid' | 'fulfilled' | 'repeat_due' | 'non_qualified' | 'lost' | 'unreachable' | 'consent_withdrawn' | 'duplicate';
  stageHistory: StageHistoryEntry[];
  owners: LeadOwner;
  nextAction: NextAction;
  handoffs: Handoff[];
  attribution: Attribution;
  consent: Consent;
  
  lastContactAt?: string;
  firstResponseAt?: string;
  firstResponseDelayMinutes?: number;
  slaMinutes?: number;
  
  preferredChannel: string;
  contactPreferences: string[];
  productInterests: string[];
  usageInterests: string[];
  
  nonQualificationReason?: string;
  lossReason?: string;

  financials: {
    expectedRevenueXAF: number;
    expectedMarginXAF: number;
    actualRevenueXAF?: number;
    actualMarginXAF?: number;
  };
  dnaBlock2Selections: DNABlock2Selection[];
  dnaBlock3FreeChoices: DNABlock3FreeChoice[];
};

export type Campaign = {
  id: string;
  name: string;
  type: string;
  owners: {
    conversation: string;
    commercialDecision: string;
    physicalExecution: string;
  };
};

export type Experiment = {
  id: string;
  campaignId: string;
  name: string;
  variant: string;
};

export type Touchpoint = {
  id: string;
  experimentId: string;
  type: 'UTM' | 'QR' | 'landing' | 'CTA' | 'dna_submit' | 'whatsapp_click' | 'referral_code' | 'named_introduction';
  name: string;
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

export type DNABlock3FreeChoice = {
  id: string;
  sku?: string;
  name: string;
  context: string;
  catalogStatus: 'Référencé' | 'Hors catalogue';
};

export type DNABlock2Selection = {
  id: string;
  sku: string;
  name: string;
  classification: 'A1' | 'A2' | 'B';
  context: string;
};

export type Recommendation = {
  sku: string;
  availability: string;
  source: string;
  rationale: string;
};

export type Client360 = {
  id: string;
  identity: { lastName: string; firstName: string; email: string; phone: string; city: string };
  type: 'B2B' | 'B2C';
  status: 'Actif' | 'Inactif' | 'Blacklisté';
  score: number;
  balanceDueXAF: number;
  dna: string[];
  dnaBlock2Selections: DNABlock2Selection[];
  dnaBlock3FreeChoices: DNABlock3FreeChoice[];
  recommendations: Recommendation[];
  kpis: { lifetimeValueXAF: number; totalOrders: number; averageOrderValueXAF: number; lastOrderDate: string };
  orders: Order[];
  interactions: Interaction[];
};

export type SupplierOpportunity = {
  id: string;
  supplierName: string;
  contactName: string;
  emailSource: string;
  phone: string;
  originCurrency: string;
  cumulativeSpendOriginal: number;
  cumulativeSpendXAF: number;
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
    totalOriginal: number;
    currency: string;
    fxRate: number;
    totalXAF: number;
    items: { sku: string; qty: number; unitPriceOriginal: number; unitPriceXAF: number }[];
  }[];
};

export type Stock360 = {
  sku: string;
  brand: string;
  type: string;
  lineSeries: string;
  vitola: string;
  format: string;
  strength: string;
  origin: string;
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

export type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  identifier: string;
  startDate: string;
  role: string;
  active: boolean;
  rights: string[];
  restrictions: string[];
};

export const FIXTURES = {
  accounts: [
    {
      id: 'ACC-1001',
      name: 'Groupe Vidal & Associés',
      type: 'B2B',
      status: 'Actif',
      industry: 'Finance',
      contacts: ['CLI-8822'],
      leads: ['LD-1091', 'LD-1092']
    }
  ] as Account[],

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
      identity: { lastName: 'Lefebvre', firstName: 'Jean-Baptiste', email: 'jbl@example.com', phone: '+33 6 12 34 56 78', city: 'Paris' },
      type: 'B2C',
      status: 'Actif',
      score: 85,
      balanceDueXAF: 0,
      dna: ['Préférence Maduro', 'Achat régulier de robustos', 'Sensible aux éditions limitées'],
      dnaBlock2Selections: [
        { id: 'REF-01', sku: 'CTCG001102', name: 'Romeo y Julieta Wide Churchills', classification: 'A1', context: 'Retenu suite à suggestion algorithmique (A1: match parfait)' },
        { id: 'REF-02', sku: 'CTCG001020', name: 'Partagás Serie D No. 4', classification: 'A2', context: 'Confirmation de réassort (A2: match secondaire historique)' }
      ],
      dnaBlock3FreeChoices: [
        { id: 'LIBRE-01', name: 'Davidoff Nicaragua Robusto', context: 'Demandé librement pour son profil terreux et épicé; absent des propositions du Bloc 2', catalogStatus: 'Hors catalogue' },
        { id: 'LIBRE-02', name: 'Arturo Fuente Hemingway Short Story', context: 'Souhait spontané exprimé pendant le parcours DNA; absent des propositions du Bloc 2', catalogStatus: 'Hors catalogue' }
      ],
      recommendations: [
        { sku: 'CTCG001020', availability: '14 boîtes', source: 'Historique + ADN', rationale: 'Achat régulier (12x) et alignement parfait avec la préférence Robusto/Maduro (Choix ADN A1)' },
        { sku: 'CTCG001045', availability: '42 boîtes', source: 'Découverte Premium', rationale: 'Affinité identifiée lors du profilage pour les formats Marevas, stock en rotation lente idéal pour proposition.' }
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
      identity: { lastName: 'Vidal', firstName: 'Marc', email: 'marcv@example.com', phone: '+41 79 123 45 67', city: 'Genève' },
      type: 'B2B',
      status: 'Actif',
      score: 42,
      balanceDueXAF: 150000,
      dna: ['Explorateur', 'Budget modéré', 'Format Corona privilégié'],
      dnaBlock2Selections: [
        { id: 'REF-03', sku: 'CTCG001045', name: 'Cohiba Siglo II', classification: 'B', context: 'Intérêt marqué (B: match exploratoire)' }
      ],
      dnaBlock3FreeChoices: [
        { id: 'LIBRE-03', name: 'H. Upmann Half Corona', context: 'Demandé librement comme format court; absent des propositions du Bloc 2', catalogStatus: 'Hors catalogue' }
      ],
      recommendations: [
        { sku: 'CTCG001045', availability: '42 boîtes', source: 'ADN - Explorateur', rationale: 'Sélectionné explicitement comme référence Corona. Stock disponible en Réserve.' }
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
      lineSeries: 'Serie D',
      vitola: 'Robusto',
      format: '124 × 19,8 mm · cepo 50',
      strength: 'Corsé',
      origin: 'Cuba',
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
      lineSeries: 'Línea 1492',
      vitola: 'Marevas · Petit Corona',
      format: '129 × 16,7 mm · cepo 42',
      strength: 'Moyen à corsé',
      origin: 'Cuba',
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
      lineSeries: 'Churchills',
      vitola: 'Montesco · Robusto Extra',
      format: '130 × 21,4 mm · cepo 55',
      strength: 'Moyen',
      origin: 'Cuba',
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
      contactName: 'Carlos M.',
      emailSource: 'offre-speciale-sep@distributeur-a.es',
      phone: '+34 91 123 45 67',
      originCurrency: 'EUR',
      cumulativeSpendOriginal: 120000,
      cumulativeSpendXAF: 78714840,
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
        { poId: 'PO-4091', date: '2026-06-15', status: 'LIVRÉ', totalOriginal: 4345, currency: 'EUR', fxRate: 655.957, totalXAF: 2850000, items: [{ sku: 'CTCG001020', qty: 200, unitPriceOriginal: 21.72, unitPriceXAF: 14250 }] }
      ]
    },
    {
      id: 'OPP-113',
      supplierName: 'Grossiste Inconnu',
      contactName: 'N/A',
      emailSource: 'sales@cigars-wholesale-cheap.com',
      phone: 'N/A',
      originCurrency: 'USD',
      cumulativeSpendOriginal: 0,
      cumulativeSpendXAF: 0,
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

  employees: [
    {
      id: 'EMP-001',
      firstName: 'Owner',
      lastName: 'Système',
      email: 'owner@citicigars.com',
      phone: '+33 6 00 00 00 01',
      address: '10 Place de la Bourse, Paris',
      identifier: 'OWN-SYS',
      startDate: '2024-01-01',
      role: 'Administrateur Suprême',
      active: true,
      rights: ['Accès R1 (Lecture seule)', 'Dérogation A5', 'Désactivation Agents', 'Modification des rôles'],
      restrictions: ['Mutations directes désactivées (R1)']
    },
    {
      id: 'EMP-002',
      firstName: 'Opérateur',
      lastName: 'Achats',
      email: 'achats@citicigars.com',
      phone: '+33 6 00 00 00 02',
      address: 'Bureau Central',
      identifier: 'OP-ACH',
      startDate: '2025-03-15',
      role: 'Valideur Niveau 1',
      active: true,
      rights: ['Validation A3', 'Création PO (Draft)'],
      restrictions: ['Approbation A4 requise pour nouveaux fournisseurs']
    },
    {
      id: 'EMP-003',
      firstName: 'Agent',
      lastName: 'Montréal',
      email: 'montreal@citicigars.com',
      phone: '+1 514 00 00 00',
      address: 'Montréal HQ',
      identifier: 'OP-MTL',
      startDate: '2025-01-10',
      role: 'Closer Montréal',
      active: true,
      rights: ['CRM'],
      restrictions: []
    },
    {
      id: 'EMP-004',
      firstName: 'Agent',
      lastName: 'Douala',
      email: 'douala@citicigars.com',
      phone: '+237 600 00 00 00',
      address: 'Douala Hub',
      identifier: 'OP-DLA',
      startDate: '2025-01-10',
      role: 'Exécuteur Douala',
      active: true,
      rights: ['CRM'],
      restrictions: []
    }
  ] as Employee[],

  leads: [
    {
      id: 'LD-1090',
      title: 'Opportunité Jean-Baptiste - Partagás',
      clientId: 'CLI-8821',
      pipelineStage: 'won_pending_payment',
      stageHistory: [
        { changedAt: '2026-09-01T08:30:00Z', previousStage: null, stage: 'captured', changedBy: 'System', reason: 'Initial capture' },
        { changedAt: '2026-09-01T10:15:00Z', previousStage: 'captured', stage: 'contacted', changedBy: 'EMP-003', reason: 'Contact initié' },
        { changedAt: '2026-09-02T14:20:00Z', previousStage: 'contacted', stage: 'offer_or_dna', changedBy: 'EMP-003', reason: 'Proposition envoyée' },
        { changedAt: '2026-09-03T16:45:00Z', previousStage: 'offer_or_dna', stage: 'won_pending_payment', changedBy: 'EMP-003', reason: 'Accord client' }
      ],
      owners: {
        current: 'EMP-003',
        conversation: 'EMP-003',
        commercialDecision: 'EMP-003',
        physicalExecution: 'EMP-004'
      },
      nextAction: {
        type: 'Suivi Paiement',
        description: 'Vérifier la réception du virement pour déclencher le fulfillment à Douala.',
        ownerId: 'EMP-003',
        dueAt: '2026-09-05T12:00:00Z',
        mandatory: true
      },
      handoffs: [
        {
          id: 'HO-501',
          from: 'EMP-003',
          to: 'EMP-004',
          incomingOwnerId: 'EMP-004',
          context: 'Client VIP, a validé la commande. Paiement en attente. Livrer discrètement à son hôtel à Douala dès confirmation.',
          source: 'WhatsApp',
          promise: 'Livraison express < 4h après paiement',
          interests: ['Partagás Serie D No. 4'],
          consentChannel: 'WhatsApp vérifié',
          step: 'won_pending_payment',
          expectedDecision: 'Confirmation livraison',
          deadline: '2026-09-06T18:00:00Z',
          acceptedAt: '2026-09-04T09:00:00Z',
          acceptanceProof: {
            type: 'System_Log',
            timestamp: '2026-09-04T09:00:00Z',
            evidence: 'Ack_HO501_EMP004'
          },
          evidence: 'Accord_Douala_HO501.pdf'
        }
      ],
      attribution: {
        attributionStatus: 'attributed',
        initialSource: 'Campagne Nouveautés Sept',
        leadCreationSource: 'Email CTA',
        conversionSource: 'WhatsApp Direct',
        influences: ['Visite Site Web', 'Recommandation Agent'],
        campaignId: 'CAMP-SEP-26',
        experimentId: 'EXP-A-01',
        touchpointId: 'TP-001',
        relationshipOrigin: 'Inbound',
        relationshipDistance: '1',
        claudelIntervention: 'significant',
        confidence: 95,
        evidence: [
          { id: 'EV-1', type: 'UTM', timestamp: '2026-09-01T08:30:00Z', source: 'Web', proof: 'UTM_Source=newsletter', confidence: 99 }
        ]
      },
      consent: {
        version: 'v2.1',
        status: 'granted',
        purpose: 'Marketing & Sales',
        channels: ['WhatsApp', 'Email'],
        textVersion: 'Je consens à être contacté via WhatsApp et Email pour des offres.',
        capturedAt: '2026-09-01T08:30:00Z',
        source: 'Web Form',
        proof: 'IP Log 192.168.1.1',
        capturedBy: 'System',
        adultVerified: true
      },
      lastContactAt: '2026-09-03T16:45:00Z',
      firstResponseAt: '2026-09-01T10:15:00Z',
      firstResponseDelayMinutes: 105,
      slaMinutes: 120,
      preferredChannel: 'WhatsApp',
      contactPreferences: ['WhatsApp', 'Email'],
      productInterests: ['Maduro', 'Robusto', 'Ediciones Limitadas'],
      usageInterests: ['Consommation personnelle', 'Cadeaux'],
      financials: {
        expectedRevenueXAF: 420000,
        expectedMarginXAF: 180000
      },
      dnaBlock2Selections: [
        { id: 'REF-01', sku: 'CTCG001102', name: 'Romeo y Julieta Wide Churchills', classification: 'A1', context: 'Retenu suite à suggestion algorithmique (A1: match parfait)' },
        { id: 'REF-02', sku: 'CTCG001020', name: 'Partagás Serie D No. 4', classification: 'A2', context: 'Confirmation de réassort (A2: match secondaire historique)' }
      ],
      dnaBlock3FreeChoices: [
        { id: 'LIBRE-01', name: 'Davidoff Nicaragua Robusto', context: 'Demandé librement pour son profil terreux et épicé; absent des propositions du Bloc 2', catalogStatus: 'Hors catalogue' }
      ]
    },
    {
      id: 'LD-1091',
      title: 'Nouveau Lead - Marc Vidal',
      accountId: 'ACC-1001',
      clientId: 'CLI-8822',
      pipelineStage: 'contact_pending',
      stageHistory: [
        { changedAt: '2026-09-04T08:15:00Z', previousStage: null, stage: 'captured', changedBy: 'System', reason: 'Formulaire reçu' }
      ],
      owners: {
        current: 'EMP-003',
        conversation: 'EMP-003',
        commercialDecision: 'EMP-003',
        physicalExecution: 'EMP-004' // Replaced N/A
      },
      nextAction: {
        type: 'Premier Contact',
        description: 'Appeler Marc pour comprendre son besoin (Explorateur, budget modéré).',
        ownerId: 'EMP-003',
        dueAt: '2026-09-04T16:00:00Z',
        mandatory: true
      },
      handoffs: [],
      attribution: {
        attributionStatus: 'unattributed',
        unattributedReason: 'Source tracking bloqué par adblocker du client',
        initialSource: 'Unknown',
        leadCreationSource: 'Unknown',
        conversionSource: 'Unknown',
        influences: [],
        campaignId: 'None',
        experimentId: 'None',
        touchpointId: 'None',
        relationshipOrigin: 'Unknown',
        relationshipDistance: 'unknown',
        claudelIntervention: 'none',
        confidence: 0,
        evidence: []
      },
      consent: {
        version: 'v2.1',
        status: 'pending',
        purpose: 'Contact Initial',
        channels: [],
        textVersion: 'Attente de validation explicite.',
        capturedAt: '2026-09-04T08:15:00Z',
        source: 'Inconnu',
        proof: 'N/A',
        capturedBy: 'System',
        adultVerified: false
      },
      lastContactAt: undefined,
      firstResponseAt: undefined,
      preferredChannel: 'Unknown',
      contactPreferences: [],
      productInterests: ['Corona', 'Exploration'],
      usageInterests: [],
      financials: {
        expectedRevenueXAF: 150000,
        expectedMarginXAF: 60000
      },
      dnaBlock2Selections: [],
      dnaBlock3FreeChoices: []
    },
    {
      id: 'LD-1092',
      title: 'Commande Anniversaire B2B',
      accountId: 'ACC-1001',
      clientId: 'CLI-8822',
      pipelineStage: 'fulfilled',
      stageHistory: [
        { changedAt: '2026-08-01T08:15:00Z', previousStage: null, stage: 'captured', changedBy: 'System', reason: 'Lead entrant' },
        { changedAt: '2026-08-05T12:00:00Z', previousStage: 'qualified', stage: 'won_pending_payment', changedBy: 'EMP-003', reason: 'Devis signé' },
        { changedAt: '2026-08-10T14:00:00Z', previousStage: 'won_pending_payment', stage: 'paid', changedBy: 'System', reason: 'Virement reçu' },
        { changedAt: '2026-08-12T10:00:00Z', previousStage: 'paid', stage: 'fulfilled', changedBy: 'EMP-004', reason: 'Livraison effectuée' }
      ],
      owners: {
        current: 'EMP-004',
        conversation: 'EMP-003',
        commercialDecision: 'EMP-003',
        physicalExecution: 'EMP-004'
      },
      nextAction: {
        type: 'Feedback',
        description: 'Demander un retour après dégustation (Fidélisation).',
        ownerId: 'EMP-003',
        dueAt: '2026-09-15T12:00:00Z',
        mandatory: false
      },
      handoffs: [],
      attribution: {
        attributionStatus: 'attributed',
        initialSource: 'Recherche Organique',
        leadCreationSource: 'Landing Page B2B',
        conversionSource: 'Formulaire Web',
        influences: [],
        campaignId: 'CAMP-B2B-Q3',
        experimentId: 'EXP-B2B-01',
        touchpointId: 'TP-003',
        relationshipOrigin: 'Inbound SEO',
        relationshipDistance: '3', // Valid for Acquisition
        claudelIntervention: 'none', // Valid for Execution
        confidence: 100,
        evidence: [
          { id: 'EV-2', type: 'landing', timestamp: '2026-08-01T08:15:00Z', source: 'Web', proof: 'Referer=Google', confidence: 100 }
        ]
      },
      consent: {
        version: 'v2.1',
        status: 'granted',
        purpose: 'Business',
        channels: ['Email'],
        textVersion: 'Consentement B2B',
        capturedAt: '2026-08-01T08:15:00Z',
        source: 'Web Form',
        proof: 'Opt-in box',
        capturedBy: 'System',
        adultVerified: true
      },
      lastContactAt: '2026-08-25T10:00:00Z',
      firstResponseAt: '2026-08-01T10:15:00Z',
      firstResponseDelayMinutes: 120,
      slaMinutes: 120,
      preferredChannel: 'Email',
      contactPreferences: ['Email'],
      productInterests: ['Robusto', 'Cohiba'],
      usageInterests: ['Cadeaux Corpo'],
      financials: {
        expectedRevenueXAF: 750000,
        expectedMarginXAF: 250000,
        actualRevenueXAF: 750000,
        actualMarginXAF: 250000
      },
      orderId: 'ORD-2026-08-10',
      paymentId: 'PAY-8812',
      dnaBlock2Selections: [],
      dnaBlock3FreeChoices: []
    }
  ] as Lead[],

  campaigns: [
    {
      id: 'CAMP-SEP-26',
      name: 'Nouveautés Septembre',
      type: 'Newsletter Email',
      owners: {
        conversation: 'EMP-003',
        commercialDecision: 'EMP-003',
        physicalExecution: 'EMP-004'
      }
    },
    {
      id: 'CAMP-VIP-MTL',
      name: 'Dîner VIP Montréal',
      type: 'Événement',
      owners: {
        conversation: 'EMP-003',
        commercialDecision: 'EMP-003',
        physicalExecution: 'EMP-003'
      }
    },
    {
      id: 'CAMP-B2B-Q3',
      name: 'Prospection B2B Q3',
      type: 'Digital Inbound',
      owners: {
        conversation: 'EMP-003',
        commercialDecision: 'EMP-003',
        physicalExecution: 'EMP-004'
      }
    }
  ] as Campaign[],

  experiments: [
    {
      id: 'EXP-A-01',
      campaignId: 'CAMP-SEP-26',
      name: 'Subject Line A/B Test',
      variant: 'A: "Vos nouveautés exclusives"'
    },
    {
      id: 'EXP-B2B-01',
      campaignId: 'CAMP-B2B-Q3',
      name: 'B2B Landing Variant',
      variant: 'Control'
    }
  ] as Experiment[],

  touchpoints: [
    {
      id: 'TP-001',
      experimentId: 'EXP-A-01',
      type: 'UTM',
      name: 'Email Link Click'
    },
    {
      id: 'TP-002',
      experimentId: 'EXP-A-01',
      type: 'whatsapp_click',
      name: 'WhatsApp Redirect Button'
    },
    {
      id: 'TP-003',
      experimentId: 'EXP-B2B-01',
      type: 'landing',
      name: 'B2B Corporate Form'
    }
  ] as Touchpoint[]
};
