import { describe, it, expect } from "vitest";
import { normalizePhone } from "./phone";

/**
 * These tests cover the pure, DB-independent logic used by the historical
 * import (phone resolution rules). Full integration tests against a real
 * MySQL instance (dry-run idempotency, duplicate prevention via the unique
 * constraint) require MYSQL_URL and are documented as a follow-up in the
 * final delivery report — they cannot run in this sandbox.
 */
describe("historical import — customer resolution rules", () => {
  it("un numéro de téléphone absent doit être signalé pour revue humaine, jamais deviné", () => {
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });

  it("un numéro exploitable est normalisé de façon stable et reproductible (clé d'idempotence)", () => {
    const a = normalizePhone("690 12 34 56");
    const b = normalizePhone("+237690123456");
    expect(a).toBe(b);
    expect(a).toBe("+237690123456");
  });
});
