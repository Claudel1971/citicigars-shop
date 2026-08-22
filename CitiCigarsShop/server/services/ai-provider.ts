/**
 * AI provider abstraction. The CRM's WhatsApp analysis logic must never
 * depend directly on a specific vendor SDK (brief correction #11: "ne fige
 * pas le fournisseur trop tôt"). Swap the implementation returned by
 * getAiProvider() to change provider without touching services/crm.ts or
 * routes.crm.ts.
 */

export interface AiCompletionRequest {
  systemPrompt: string;
  userPrompt: string;
  /** JSON schema (as a plain description, not a formal JSON-Schema object)
   * the model should follow. Kept simple/textual for Phase 1 — swap for a
   * real structured-output mode once a provider is chosen and pinned. */
  responseFormatHint: string;
}

export interface AiProvider {
  complete(request: AiCompletionRequest): Promise<string>;
}

/**
 * Minimal Anthropic-backed implementation, used as the default for now
 * only because it's the most readily available in this environment — NOT
 * a hard architectural commitment. Nothing outside this file references
 * "@anthropic-ai/sdk" directly.
 */
class AnthropicProvider implements AiProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async complete(request: AiCompletionRequest): Promise<string> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 2000,
        system: `${request.systemPrompt}\n\nFormat de réponse attendu: ${request.responseFormatHint}`,
        messages: [{ role: "user", content: request.userPrompt }],
      }),
    });

    if (!response.ok) {
      // Inclut le corps de l'erreur ({error:{type,message}} chez Anthropic) —
      // un simple code HTTP ne suffit pas à distinguer une clé invalide d'un
      // modèle refusé ou d'une limite de taux, et laisse un premier essai
      // raté impossible à diagnostiquer à l'aveugle.
      const errorBody = await response.text();
      let detail = errorBody;
      try {
        const parsed = JSON.parse(errorBody);
        if (parsed?.error?.message) {
          detail = `${parsed.error.type ?? "error"}: ${parsed.error.message}`;
        }
      } catch {
        // corps non-JSON (proxy, timeout, etc.) : on garde le texte brut tel quel
      }
      throw new Error(`AnthropicProvider: API error ${response.status} — ${detail}`);
    }

    const data = await response.json();
    const textBlock = data.content?.find((c: any) => c.type === "text");
    if (!textBlock) {
      throw new Error("AnthropicProvider: no text content in response");
    }
    return textBlock.text as string;
  }
}

/**
 * Test/offline provider — never calls a network API. Used by unit tests and
 * as a safe default when no API key is configured, so the rest of the CRM
 * remains testable without live credentials.
 */
export class NullAiProvider implements AiProvider {
  async complete(_request: AiCompletionRequest): Promise<string> {
    throw new Error(
      "NullAiProvider: no AI provider configured. Set an API key to enable WhatsApp conversation analysis."
    );
  }
}

let cachedProvider: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  if (cachedProvider) return cachedProvider;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  cachedProvider = anthropicKey ? new AnthropicProvider(anthropicKey) : new NullAiProvider();
  return cachedProvider;
}

/** For tests: inject a fake provider instead of the real/null one. */
export function setAiProviderForTesting(provider: AiProvider) {
  cachedProvider = provider;
}
