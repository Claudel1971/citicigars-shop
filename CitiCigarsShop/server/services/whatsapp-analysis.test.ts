import { describe, it, expect, beforeEach } from "vitest";
import { analyzeConversation } from "./whatsapp-analysis";
import { setAiProviderForTesting, type AiProvider, type AiCompletionRequest } from "./ai-provider";

class FakeProvider implements AiProvider {
  constructor(private response: string) {}
  async complete(_req: AiCompletionRequest): Promise<string> {
    return this.response;
  }
}

describe("analyzeConversation", () => {
  it("conversation avec informations complètes -> proposition structurée avec provenance", async () => {
    setAiProviderForTesting(
      new FakeProvider(
        JSON.stringify({
          suggestedFirstName: { value: "Jean", confidence: "high", sourceExcerpt: "Jean: bonjour" },
          suggestedPhone: { value: "+237690123456", confidence: "high", sourceExcerpt: "690123456" },
          summary: { value: "Intéressé par des Casa Carrillo", confidence: "high", sourceExcerpt: "..." },
          interest: { value: "Casa Carrillo Core Plus", confidence: "medium", sourceExcerpt: "..." },
          productsMentioned: { value: ["Casa Carrillo Core Plus"], confidence: "medium", sourceExcerpt: "..." },
          suggestedStatus: { value: "QUALIFIED", confidence: "medium", sourceExcerpt: "..." },
          nextAction: { value: "Envoyer catalogue", confidence: "high", sourceExcerpt: "..." },
          nextActionAt: { value: "2026-08-25", confidence: "low", sourceExcerpt: "..." },
          notes: null,
        })
      )
    );

    const result = await analyzeConversation("Jean: bonjour, je cherche des Casa Carrillo, mon num 690123456", []);
    expect(result.summary.value).toContain("Casa Carrillo");
    expect(result.suggestedPhone?.confidence).toBe("high");
    expect(result.matchedCustomerId).toBeNull(); // no existing customers passed in
  });

  it("client existant -> rattachement automatique par téléphone exact uniquement", async () => {
    setAiProviderForTesting(
      new FakeProvider(
        JSON.stringify({
          suggestedFirstName: { value: "Marie", confidence: "high", sourceExcerpt: "..." },
          suggestedPhone: { value: "690123456", confidence: "high", sourceExcerpt: "..." },
          summary: { value: "Suivi commande", confidence: "high", sourceExcerpt: "..." },
          interest: null,
          productsMentioned: { value: [], confidence: "low", sourceExcerpt: "" },
          suggestedStatus: null,
          nextAction: null,
          nextActionAt: null,
          notes: null,
        })
      )
    );

    const result = await analyzeConversation("...", [
      { customerId: "cust-1", firstName: "Marie", lastName: "N.", phoneWhatsapp: "+237690123456" },
    ]);
    expect(result.matchedCustomerId).toBe("cust-1");
    expect(result.matchedCustomerConfidence).toBe("high");
  });

  it("rejette une sortie modèle malformée plutôt que de deviner", async () => {
    setAiProviderForTesting(new FakeProvider("ceci n'est pas du JSON"));
    await expect(analyzeConversation("texte", [])).rejects.toThrow();
  });

  it("refuse un texte vide sans appeler le modèle", async () => {
    await expect(analyzeConversation("", [])).rejects.toThrow("rawText is empty");
  });
});
