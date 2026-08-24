import OpenAI from "openai";

export type DnaResearchCigar = {
  poolId?: string;
  cigarId?: string | null;
  brand?: string;
  line?: string;
  marque?: string;
  ligne?: string;
  vitole?: string | null;
  format?: string | null;
  dimensions?: string | null;
  ringGauge?: number | null;
  pays?: string | null;
  sourceRef?: string | null;
  existingSourcingClass?: string | null;
  factory?: string | null;
  madeBy?: string | null;
  evidenceContext?: string | null;
};

export type DnaResearchResult = {
  profile: {
    brand: string;
    line: string;
    vitole: string;
    format: string;
    dimensions: string;
    puissance: string;
    famille1: string;
    famille2: string;
    famille3: string;
    intensite: string;
    spice: string;
    sweet: string;
    signatures: string;
    dureeMin: string;
    dureeMax: string;
    confidence: string;
  };
  memoResearch: string;
  sources: Array<{
    url: string;
    type: "OFFICIAL" | "RANKING" | "SECONDARY";
    note: string;
  }>;
  arbitrage: string;
};

const DNA_SCHEMA = {
  type: "object",
  properties: {
    profile: {
      type: "object",
      properties: {
        brand: { type: "string" },
        line: { type: "string" },
        vitole: { type: "string" },
        format: { type: "string" },
        dimensions: { type: "string" },
        puissance: { type: "string", enum: ["1", "2", "3", "4", "5", "ND"] },
        famille1: { type: "string", enum: ["Boisé", "Fauve", "Gourmand", "Velouté", "ND"] },
        famille2: { type: "string", enum: ["Boisé", "Fauve", "Gourmand", "Velouté", "ND"] },
        famille3: { type: "string", enum: ["Boisé", "Fauve", "Gourmand", "Velouté", "ND"] },
        intensite: { type: "string", enum: ["1", "2", "3", "4", "5", "ND"] },
        spice: { type: "string", enum: ["1", "2", "3", "4", "5", "ND"] },
        sweet: { type: "string", enum: ["1", "2", "3", "4", "5", "ND"] },
        signatures: { type: "string" },
        dureeMin: { type: "string" },
        dureeMax: { type: "string" },
        confidence: { type: "string", enum: ["FAIBLE", "MODÉRÉE", "HAUTE"] }
      },
      required: [
        "brand", "line", "vitole", "format", "dimensions", "puissance",
        "famille1", "famille2", "famille3", "intensite",
        "spice", "sweet", "signatures", "dureeMin", "dureeMax",
        "confidence"
      ],
      additionalProperties: false
    },
    memoResearch: { type: "string" },
    sources: {
      type: "array",
      items: {
        type: "object",
        properties: {
          url: { type: "string" },
          type: { type: "string", enum: ["OFFICIAL", "RANKING", "SECONDARY"] },
          note: { type: "string" }
        },
        required: ["url", "type", "note"],
        additionalProperties: false
      }
    },
    arbitrage: { type: "string" }
  },
  required: ["profile", "memoResearch", "sources", "arbitrage"],
  additionalProperties: false
} as const;

const RESEARCH_INSTRUCTIONS = `
Tu es l'agent de recherche DNA de CitiCigars.

MISSION
Documenter un cigare précis à partir de sources Web vérifiables et produire UNE PROPOSITION.
Tu ne publies jamais, tu n'approuves jamais et tu n'inventes jamais une donnée manquante.

SOURCE DE VÉRITÉ MÉTHODOLOGIQUE
La doctrine vient du fichier CitiCigars "dna_inventory":
- hiérarchie des sources : fabricant/propriétaire officiel d'abord;
- Cigar Aficionado / Cigar Journal / classements reconnus ensuite;
- détaillants et presse spécialisée comme sources secondaires;
- une source secondaire ne doit jamais être présentée comme source officielle;
- en cas de conflit de puissance, la classification explicite du fabricant prime;
- si le fabricant ne donne pas la puissance, utiliser un consensus de sources fiables;
- échelle puissance : Mild=1, Mild-Medium=2, Medium=3, Medium-Full=4, Full=5;
- familles autorisées : Boisé, Fauve, Gourmand, Velouté;
- ne renseigner Famille 2 ou Famille 3 que si les notes documentées justifient réellement une famille secondaire;
- Intensité est distincte de Puissance;
- Spice et Sweetness doivent être fondés sur des mentions explicites/convergentes;
- Sweetness ne doit PAS augmenter simplement parce que le profil mentionne fruit ou agrumes;
- pour Sweetness, rechercher des indices explicites tels que miel, mélasse, sucre brun, caramel, cacao sucré, douceur clairement décrite;
- si Spice ou Sweetness n'est pas suffisamment documenté : retourner "ND";
- Signatures : seulement les signatures clairement supportées (ex. Fruité, Agrumé, Malté, Caramélisé, Toasté); chaîne vide si aucune;
- ne jamais fabriquer une précision sous prétexte de compléter les 16 champs;
- la confiance est HAUTE / MODÉRÉE / FAIBLE selon précision de l'identité, qualité des sources et convergence;
- tout conflit, approximation de ligne, source voisine ou donnée insuffisante doit apparaître dans arbitrage/mémo;
- l'identité exacte de la vitole est préférable à un profil générique de ligne;
- si seules des données de ligne existent, l'indiquer clairement;
- dimensions : source fabricant prioritaire lorsqu'elle existe;
- durée : estimer prudemment à partir des dimensions, longueur et ring gauge, cohérente avec le benchmark dimensionnel CitiCigars; ne pas reprendre aveuglément une durée marketing;
- toutes les URLs réellement utilisées doivent être retournées.

RÈGLES PARTICULIÈRES DES 16 CHAMPS
- brand / line : conserver l'identité canonique fournie, sauf correction explicitement documentée dans le mémo.
- vitole : nom exact si documenté; sinon conserver l'identité fournie.
- format : format exact si documenté; sinon conserver celui fourni ou retourner une chaîne vide.
- dimensions : dimensions exactes si documentées; sinon conserver celles fournies.
- puissance : valeur numérique 1-5 selon la règle fabricant > consensus.
- famille1/2/3 : ordre de dominance.
- intensite : 1-5, fondée sur densité/présence aromatique décrite, pas automatiquement identique à puissance.
- spice/sweet : 1-5 ou ND.
- signatures : liste textuelle séparée par "; " ou chaîne vide.
- dureeMin/dureeMax : minutes entières sous forme de chaîne.
- confidence : confiance globale dans le profil proposé.

RECHERCHE
Effectue réellement des recherches Web. Essaie d'abord l'identité exacte :
marque + ligne + vitole + dimensions.
Privilégie les pages officielles pertinentes, puis les sources reconnues.
Ne cite pas une page générique si une page exacte existe.
Vérifie qu'une source parle bien du cigare ou au minimum de la bonne ligne avant de l'utiliser.

MÉMO
memoResearch doit être un résumé auditable en français :
1. ce qui est solidement établi;
2. ce qui est inféré au niveau de la ligne;
3. les incertitudes;
4. pourquoi les familles / puissance / spice / sweetness ont été retenus;
5. la logique de durée.
arbitrage doit être concis et vide ("") si aucun arbitrage particulier n'est nécessaire.
`;

export async function researchCigarDna(
  cigar: DnaResearchCigar,
): Promise<DnaResearchResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY_MISSING");
  }

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_DNA_MODEL || "gpt-5.4";
  const brand = cigar.brand ?? cigar.marque ?? "";
  const line = cigar.line ?? cigar.ligne ?? "";

  const input = [
    `POOL_ID: ${cigar.poolId || "non attribué"}`,
    `CIGAR_ID: ${cigar.cigarId || "aucun"}`,
    `Marque: ${brand}`,
    `Ligne / Série: ${line}`,
    `Vitole connue: ${cigar.vitole || "non renseignée"}`,
    `Format connu: ${cigar.format || "non renseigné"}`,
    `Dimensions connues: ${cigar.dimensions || "non renseignées"}`,
    `Ring gauge connu: ${cigar.ringGauge ?? "non renseigné"}`,
    `Pays connu: ${cigar.pays || "non renseigné"}`,
    `Source de référence existante: ${cigar.sourceRef || "aucune"}`,
    `Classe sourcing interne existante: ${cigar.existingSourcingClass || "aucune"}`,
    `Factory / manufacture: ${cigar.factory || "non renseignée"}`,
    `Fabriqué par: ${cigar.madeBy || "non renseigné"}`,
    `Contexte documentaire Pool: ${cigar.evidenceContext || "aucun"}`,
    "",
    "Recherche ce cigare précis et produis la proposition DNA selon la doctrine CitiCigars."
  ].join("\n");

  const response = await client.responses.create({
    model,
    instructions: RESEARCH_INSTRUCTIONS,
    input,
    tools: [{ type: "web_search_preview", search_context_size: "medium" }],
    tool_choice: "auto",
    include: ["web_search_call.action.sources"],
    text: {
      format: {
        type: "json_schema",
        name: "citicigars_dna_research",
        strict: true,
        schema: DNA_SCHEMA
      }
    }
  });

  if (!response.output_text) {
    throw new Error("DNA_RESEARCH_EMPTY_RESPONSE");
  }

  let parsed: DnaResearchResult;
  try {
    parsed = JSON.parse(response.output_text) as DnaResearchResult;
  } catch {
    throw new Error("DNA_RESEARCH_INVALID_JSON");
  }

  return parsed;
}
