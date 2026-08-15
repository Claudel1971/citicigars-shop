import { describe, it, expect } from "vitest";
import {
  ZERO_BALANCE,
  Balance,
  computeAvailability,
  looseTotal,
  assertLooseNeverInTransit,
  assertPackSizeSentinel,
  applyEffect,
  applyEffects,
  StockRuleViolation,
  effectsForReception,
  effectsForMiseEnDepot,
  effectsForRetourDeDepot,
  effectsForReservationClient,
  effectsForLiberationReservationClient,
  effectsForReservationEvenement,
  effectsForVente,
  effectsForSortieEvenement,
  effectsForRetourEvenement,
  effectsForCadeauEchantillonPerte,
  effectsForCorrectionInventaire,
  planOuvertureBoite,
  effectsForOuvertureBoiteSource,
  effectsForOuvertureBoiteDestination,
} from "./stock-movement-processor";

function b(partial: Partial<Balance>): Balance {
  return { ...ZERO_BALANCE, ...partial };
}

describe("computeAvailability (amendement 3 : plafonné à 0, déficit séparé)", () => {
  it("cas normal, pas de réservation", () => {
    expect(computeAvailability(b({ onHand: 5 }))).toEqual({ availableNow: 5, reservationDeficit: 0 });
  });
  it("réservations exactement égales à onHand", () => {
    expect(computeAvailability(b({ onHand: 5, reservedClient: 3, reservedEvent: 2 }))).toEqual({
      availableNow: 0,
      reservationDeficit: 0,
    });
  });
  it("conflit réel (comptage < réservé) : availableNow reste à 0, jamais négatif, déficit exposé séparément", () => {
    const result = computeAvailability(b({ onHand: 2, reservedClient: 5 }));
    expect(result.availableNow).toBe(0);
    expect(result.reservationDeficit).toBe(3);
  });
});

describe("looseTotal (correction 7 : total physique, transit exclu)", () => {
  it("somme onHand+deposit+atEvent", () => {
    expect(looseTotal(b({ onHand: 1, deposit: 1, atEvent: 1, transit: 4 }))).toBe(3);
  });
});

describe("assertLooseNeverInTransit (correction 2)", () => {
  it("rejette tout delta non nul de type Loose sur transit", () => {
    expect(() => assertLooseNeverInTransit("Loose", "transit", 1)).toThrow(StockRuleViolation);
    expect(() => assertLooseNeverInTransit("Loose", "transit", -1)).toThrow(StockRuleViolation);
  });
  it("autorise delta=0 sur transit, ou tout delta sur un autre bucket", () => {
    expect(() => assertLooseNeverInTransit("Loose", "transit", 0)).not.toThrow();
    expect(() => assertLooseNeverInTransit("Loose", "onHand", 1)).not.toThrow();
    expect(() => assertLooseNeverInTransit("Box", "transit", 1)).not.toThrow();
  });
});

describe("assertPackSizeSentinel (correction 2)", () => {
  it("Pack exige packSize>0", () => {
    expect(() => assertPackSizeSentinel("Pack", 0)).toThrow(StockRuleViolation);
    expect(() => assertPackSizeSentinel("Pack", 4)).not.toThrow();
  });
  it("Box/Loose/Accessory exigent packSize=0", () => {
    expect(() => assertPackSizeSentinel("Box", 4)).toThrow(StockRuleViolation);
    expect(() => assertPackSizeSentinel("Box", 0)).not.toThrow();
    expect(() => assertPackSizeSentinel("Loose", 1)).toThrow(StockRuleViolation);
    expect(() => assertPackSizeSentinel("Accessory", 1)).toThrow(StockRuleViolation);
  });
});

describe("applyEffect / applyEffects", () => {
  it("empêche toute quantité négative sur n'importe quel bucket", () => {
    expect(() => applyEffect(b({ onHand: 1 }), { balanceField: "onHand", delta: -2 })).toThrow(StockRuleViolation);
  });
  it("applique une séquence d'effets dans l'ordre", () => {
    const result = applyEffects(b({ onHand: 5 }), [
      { balanceField: "onHand", delta: -2 },
      { balanceField: "deposit", delta: 2 },
    ]);
    expect(result).toEqual(b({ onHand: 3, deposit: 2 }));
  });
});

describe("RECEPTION (correction 11 : sémantique uniforme, onHand uniquement)", () => {
  it("cible toujours onHand", () => {
    expect(effectsForReception(5)).toEqual([{ balanceField: "onHand", delta: 5 }]);
  });
});

describe("MISE_EN_DEPOT / RETOUR_DE_DEPOT", () => {
  it("mise en dépôt : onHand-, deposit+", () => {
    expect(effectsForMiseEnDepot(3)).toEqual([
      { balanceField: "onHand", delta: -3 },
      { balanceField: "deposit", delta: 3 },
    ]);
  });
  it("retour de dépôt : deposit-, onHand+", () => {
    expect(effectsForRetourDeDepot(3)).toEqual([
      { balanceField: "deposit", delta: -3 },
      { balanceField: "onHand", delta: 3 },
    ]);
  });
  it("bootstrap deposit_units = RECEPTION puis MISE_EN_DEPOT chainées, effet net identique à une réception directe en deposit", () => {
    let balance = ZERO_BALANCE;
    balance = applyEffects(balance, effectsForReception(10));
    balance = applyEffects(balance, effectsForMiseEnDepot(4));
    expect(balance).toEqual(b({ onHand: 6, deposit: 4 }));
  });
});

describe("RESERVATION_CLIENT / LIBERATION / EVENEMENT — distincts (amendement 5 mission, correction 5 diff)", () => {
  it("réservation client refusée si insuffisant", () => {
    expect(() => effectsForReservationClient(3, b({ onHand: 2 }))).toThrow(StockRuleViolation);
  });
  it("réservation client acceptée si disponible", () => {
    expect(effectsForReservationClient(2, b({ onHand: 2 }))).toEqual([{ balanceField: "reservedClient", delta: 2 }]);
  });
  it("libération réservation client distincte de libération réservation événement", () => {
    expect(effectsForLiberationReservationClient(2)).toEqual([{ balanceField: "reservedClient", delta: -2 }]);
  });
  it("réservation événement indépendante de reservedClient", () => {
    const balance = b({ onHand: 5, reservedClient: 2 });
    expect(effectsForReservationEvenement(3, balance)).toEqual([{ balanceField: "reservedEvent", delta: 3 }]);
  });
});

describe("VENTE (amendement 6 : décrément conjoint si réservée)", () => {
  it("vente directe sans réservation : onHand seul", () => {
    expect(effectsForVente(2, b({ onHand: 5 }), false)).toEqual([{ balanceField: "onHand", delta: -2 }]);
  });
  it("vente référencant une réservation : onHand ET reservedClient ensemble", () => {
    const balance = b({ onHand: 5, reservedClient: 2 });
    expect(effectsForVente(2, balance, true)).toEqual([
      { balanceField: "onHand", delta: -2 },
      { balanceField: "reservedClient", delta: -2 },
    ]);
  });
  it("refuse si availableNow insuffisant", () => {
    expect(() => effectsForVente(10, b({ onHand: 5 }), false)).toThrow(StockRuleViolation);
  });
});

describe("SORTIE_EVENEMENT / RETOUR_EVENEMENT (§1.2 : distinct de la réservation)", () => {
  it("sortie événement : onHand-, reservedEvent-, atEvent+ ensemble", () => {
    const balance = b({ onHand: 5, reservedEvent: 3 });
    expect(effectsForSortieEvenement(2, balance)).toEqual([
      { balanceField: "onHand", delta: -2 },
      { balanceField: "reservedEvent", delta: -2 },
      { balanceField: "atEvent", delta: 2 },
    ]);
  });
  it("refuse si la quantité dépasse ce qui est réservé pour l'événement", () => {
    expect(() => effectsForSortieEvenement(5, b({ onHand: 10, reservedEvent: 2 }))).toThrow(StockRuleViolation);
  });
  it("retour événement : atEvent-, onHand+", () => {
    expect(effectsForRetourEvenement(2)).toEqual([
      { balanceField: "atEvent", delta: -2 },
      { balanceField: "onHand", delta: 2 },
    ]);
  });
});

describe("CADEAU / ECHANTILLON / PERTE_CASSE — jamais prélevé sur du réservé", () => {
  it("refuse si la quantité empièterait sur une réservation", () => {
    const balance = b({ onHand: 3, reservedClient: 3 });
    expect(() => effectsForCadeauEchantillonPerte(1, balance)).toThrow(StockRuleViolation);
  });
  it("accepté dans la limite du disponible net", () => {
    const balance = b({ onHand: 5, reservedClient: 3 });
    expect(effectsForCadeauEchantillonPerte(2, balance)).toEqual([{ balanceField: "onHand", delta: -2 }]);
  });
});

describe("CORRECTION_INVENTAIRE (amendement 8 : jamais bloquée)", () => {
  it("accepte un comptage qui révèle un déficit de réservation, sans lever d'exception", () => {
    const balance = b({ onHand: 5, reservedClient: 5 });
    // comptage réel = 2, alors que 5 sont réservés : doit s'appliquer quand même
    expect(() => effectsForCorrectionInventaire(2, balance)).not.toThrow();
    const effects = effectsForCorrectionInventaire(2, balance);
    expect(effects).toEqual([{ balanceField: "onHand", delta: -3 }]);
    const after = applyEffects(balance, effects);
    const avail = computeAvailability(after);
    expect(avail.availableNow).toBe(0);
    expect(avail.reservationDeficit).toBe(3); // conflit désormais visible, pas masqué
  });
  it("correction positive standard", () => {
    expect(effectsForCorrectionInventaire(7, b({ onHand: 5 }))).toEqual([{ balanceField: "onHand", delta: 2 }]);
  });
});

describe("OUVERTURE_BOITE (correction 3, 4, 12/2)", () => {
  it("distribution exacte acceptée (formule §3)", () => {
    expect(() =>
      planOuvertureBoite({
        cigarsPerBox: 20,
        allowedPackSizes: [4],
        distribution: [{ packSize: 4, packQty: 4 }],
        looseQty: 4,
        sourceBalanceField: "onHand",
        currentLooseTotalInSourceBucket: 0,
      }),
    ).not.toThrow();
  });
  it("rejette si la somme ne correspond pas exactement à cigarsPerBox", () => {
    expect(() =>
      planOuvertureBoite({
        cigarsPerBox: 20,
        allowedPackSizes: [4],
        distribution: [{ packSize: 4, packQty: 4 }],
        looseQty: 3, // 16+3=19 != 20
        sourceBalanceField: "onHand",
        currentLooseTotalInSourceBucket: 0,
      }),
    ).toThrow(StockRuleViolation);
  });
  it("rejette une taille de pack non configurée (jamais de SKU/taille inventé)", () => {
    expect(() =>
      planOuvertureBoite({
        cigarsPerBox: 20,
        allowedPackSizes: [4],
        distribution: [{ packSize: 5, packQty: 4 }],
        looseQty: 0,
        sourceBalanceField: "onHand",
        currentLooseTotalInSourceBucket: 0,
      }),
    ).toThrow(StockRuleViolation);
  });
  it("rejette si le solde Loose final dépasserait 4 (total physique, pas seulement le delta de l'opération)", () => {
    expect(() =>
      planOuvertureBoite({
        cigarsPerBox: 20,
        allowedPackSizes: [4],
        distribution: [{ packSize: 4, packQty: 4 }],
        looseQty: 4,
        sourceBalanceField: "onHand",
        currentLooseTotalInSourceBucket: 1, // déjà 1 Loose ailleurs (deposit/atEvent) -> 1+4=5 > 4
      }),
    ).toThrow(StockRuleViolation);
  });
  it("source atEvent (correction 4 : boîte ouverte pendant un événement)", () => {
    const balance = b({ atEvent: 1 });
    expect(effectsForOuvertureBoiteSource(1, "atEvent", balance)).toEqual([{ balanceField: "atEvent", delta: -1 }]);
    // les destinations atterrissent dans le même bucket que la source
    expect(effectsForOuvertureBoiteDestination(4, "atEvent")).toEqual([{ balanceField: "atEvent", delta: 4 }]);
  });
  it("refuse de consommer une Box absente du bucket source", () => {
    expect(() => effectsForOuvertureBoiteSource(1, "onHand", b({ onHand: 0 }))).toThrow(StockRuleViolation);
  });
});

describe("Scénario bout-en-bout : ouverture de boîte onHand, packs+loose, puis vente d'un pack", () => {
  it("enchaîne les mouvements et vérifie le solde final à chaque étape", () => {
    // Box CTGNI0020 : 1 boîte de 20, packSize configuré = 4
    let boxBalance = b({ onHand: 1 }); // (CTGNI0020, Box, packSize=0)
    let packBalance = b({ onHand: 2 }); // (CTGNI0020, Pack, packSize=4) — 2 packs déjà existants
    let looseBalance = ZERO_BALANCE; // (CTGNI0020, Loose, packSize=0)

    planOuvertureBoite({
      cigarsPerBox: 20,
      allowedPackSizes: [4],
      distribution: [{ packSize: 4, packQty: 4 }],
      looseQty: 4,
      sourceBalanceField: "onHand",
      currentLooseTotalInSourceBucket: looseTotal(looseBalance),
    });
    boxBalance = applyEffects(boxBalance, effectsForOuvertureBoiteSource(1, "onHand", boxBalance));
    packBalance = applyEffects(packBalance, effectsForOuvertureBoiteDestination(4, "onHand"));
    looseBalance = applyEffects(looseBalance, effectsForOuvertureBoiteDestination(4, "onHand"));

    expect(boxBalance).toEqual(b({ onHand: 0 }));
    expect(packBalance).toEqual(b({ onHand: 6 })); // 2 existants + 4 nouveaux packs
    expect(looseBalance).toEqual(b({ onHand: 4 }));
    expect(looseTotal(looseBalance)).toBe(4); // à la limite exacte, toujours valide

    // Vente directe d'un pack (sans réservation préalable)
    packBalance = applyEffects(packBalance, effectsForVente(1, packBalance, false));
    expect(packBalance).toEqual(b({ onHand: 5 }));
  });
});
