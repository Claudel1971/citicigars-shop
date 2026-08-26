import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  clearDnaCheckoutContact,
  DNA_CHECKOUT_CONTACT_KEY,
  readDnaCheckoutContact,
} from "../client/src/utils/dnaCheckoutContact";
import { generateWhatsAppLink } from "../client/src/utils/whatsappGenerator";

function fakeStorage(initial: string | null) {
  let value = initial;
  return {
    getItem: (key: string) => key === DNA_CHECKOUT_CONTACT_KEY ? value : null,
    removeItem: (key: string) => { if (key === DNA_CHECKOUT_CONTACT_KEY) value = null; },
    current: () => value,
  };
}

describe("DNA checkout contact handoff", () => {
  it("persists the handoff only from the post-consent submission path", () => {
    const html = readFileSync(
      new URL("../client/public/CitiCigars_DNA_Curator_v2_10_3_RC.html", import.meta.url),
      "utf8",
    );
    const consentHandler = html.match(
      /document\.getElementById\('consentContinue'\)[\s\S]*?\n\}\);/,
    )?.[0] ?? "";
    const submitHandler = html.match(
      /async function submitContactAfterConsent\(\)\{[\s\S]*?const isZeroCase=/,
    )?.[0] ?? "";

    expect(consentHandler).toContain("submitContactAfterConsent()");
    expect(submitHandler).toContain("persistCheckoutContact();");
    expect(html).toContain("firstName:answers.firstName");
    expect(html).toContain("phone:contact.phone");
    expect(html).toContain("email:contact.email");
  });

  it("maps the validated DNA contact to editable checkout defaults", () => {
    const storage = fakeStorage(JSON.stringify({
      version: 1,
      firstName: " Jean ",
      lastName: " Dupont ",
      phone: "+237690123456",
      city: "Douala",
      email: "jean@example.com",
    }));

    expect(readDnaCheckoutContact(storage)).toEqual({
      nom: "Jean Dupont",
      telephone: "+237690123456",
      ville: "Douala",
      email: "jean@example.com",
    });
  });

  it("falls back safely for absent, malformed, or obsolete storage", () => {
    const empty = { nom: "", telephone: "", ville: "", email: "" };
    expect(readDnaCheckoutContact(fakeStorage(null))).toEqual(empty);
    expect(readDnaCheckoutContact(fakeStorage("not-json"))).toEqual(empty);
    expect(readDnaCheckoutContact(fakeStorage(JSON.stringify({ version: 2 })))).toEqual(empty);
  });

  it("clears the temporary handoff after checkout submission", () => {
    const storage = fakeStorage(JSON.stringify({ version: 1 }));
    clearDnaCheckoutContact(storage);
    expect(storage.current()).toBeNull();
  });

  it("includes email without changing the multi-item WhatsApp order", () => {
    const link = generateWhatsAppLink([
      { marque: "A", modele: "One", format: "Toro", quantite: 1, prixTotal: 20, sku: "SKU-1" },
      { marque: "B", modele: "Two", format: "Robusto", quantite: 2, prixTotal: 30, sku: "SKU-2" },
    ], 50, {
      nom: "Jean Dupont", telephone: "+237690123456", ville: "Douala", email: "jean@example.com",
    });
    const message = decodeURIComponent(link.split("?text=")[1]);
    expect(message).toContain("Email: jean@example.com");
    expect(message).toContain("SKU-1");
    expect(message).toContain("SKU-2");
    expect(message).toContain("TOTAL: 50.00 $");
  });
});
