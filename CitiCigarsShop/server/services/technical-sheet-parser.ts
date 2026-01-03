export interface ParsedTechnicalSheet {
  smokeType?: string;
  durationMin?: number;
  durationMax?: number;
  evolution?: string;
  originCountry?: string;
  wrapper?: string;
  binder?: string;
  filler?: string;
  wrapperAppearance?: string;
  construction?: string;
  cutting?: string;
  lighting?: string;
  draw?: string;
  burn?: string;
  ash?: string;
  smokeQuality?: string;
  dominantNotes?: string;
  secondaryNotes?: string;
  flavorEvolution?: string;
  localPositioning?: string;
  ratingScore?: number;
  ratingSource?: string;
  ratingDate?: string;
  top25Rank?: number;
  tastingNotes?: string;
}

export function parseTechnicalSheetTXT(content: string): ParsedTechnicalSheet {
  const result: ParsedTechnicalSheet = {};
  
  function extractSection(sectionNumber: string): string {
    const regex = new RegExp(`${sectionNumber}[^\\n]*\\n([\\s\\S]*?)(?=\\n\\d️⃣|$)`, 'i');
    const match = content.match(regex);
    return match ? match[1].trim() : '';
  }
  
  function extractField(section: string, fieldName: string): string {
    const regex = new RegExp(`${fieldName}\\s*[:：]\\s*(.+?)(?=\\n|$)`, 'i');
    const match = section.match(regex);
    return match ? match[1].trim() : '';
  }
  
  function extractDuration(section: string): { min?: number; max?: number } {
    const durationText = extractField(section, 'Durée moyenne');
    const match = durationText.match(/(\d+)\s*(?:à|-)?\s*(\d+)?/);
    if (match) {
      return {
        min: parseInt(match[1]),
        max: match[2] ? parseInt(match[2]) : undefined
      };
    }
    return {};
  }
  
  const section1 = extractSection('1️⃣');
  result.smokeType = extractField(section1, 'Type de fumée') || undefined;
  const duration = extractDuration(section1);
  result.durationMin = duration.min;
  result.durationMax = duration.max;
  result.evolution = extractField(section1, 'Évolution') || undefined;
  
  const section2 = extractSection('2️⃣');
  result.originCountry = extractField(section2, 'Origine') || undefined;
  result.wrapper = extractField(section2, 'Cape') || undefined;
  result.binder = extractField(section2, 'Sous-cape') || undefined;
  result.filler = extractField(section2, 'Tripe') || undefined;
  
  const section3 = extractSection('3️⃣');
  result.wrapperAppearance = extractField(section3, 'Cape') || undefined;
  result.construction = extractField(section3, 'Construction') || undefined;
  result.cutting = extractField(section3, 'Coupe') || undefined;
  result.lighting = extractField(section3, 'Allumage') || undefined;
  result.draw = extractField(section3, 'Tirage') || undefined;
  result.burn = extractField(section3, 'Combustion') || undefined;
  result.ash = extractField(section3, 'Cendre') || undefined;
  result.smokeQuality = extractField(section3, 'Fumée') || undefined;
  
  const section4 = extractSection('4️⃣');
  result.dominantNotes = extractField(section4, 'Notes dominantes') || undefined;
  result.secondaryNotes = extractField(section4, 'Nuances secondaires') || undefined;
  result.flavorEvolution = extractField(section4, 'Évolution') || undefined;
  
  const section5 = extractSection('5️⃣');
  result.localPositioning = extractField(section5, 'Positionnement local') || undefined;
  const ratingText = extractField(section5, 'Note');
  const ratingMatch = ratingText.match(/(\d+)\s*\/\s*100\s*\(([^)]+)\s*[–-]\s*([^)]+)\)/);
  if (ratingMatch) {
    result.ratingScore = parseInt(ratingMatch[1]);
    result.ratingSource = ratingMatch[2].trim();
    result.ratingDate = ratingMatch[3].trim();
  }
  
  const section6 = extractSection('6️⃣');
  result.tastingNotes = section6 || undefined;
  
  return result;
}
