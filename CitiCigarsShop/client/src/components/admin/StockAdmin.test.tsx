import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  MovementConfirmation,
  MovementHistory,
  StockDetailPanel,
  StockPositionsTable,
  TraceabilityWarning,
} from "./StockAdmin";
import {
  operationDefinition,
  operationalErrorMessage,
  submitMovementAndRefresh,
  validateMovementDraft,
} from "./stock-admin-model";

const buckets = { onHand: 5, reservedClient: 1, reservedEvent: 0, atEvent: 0, deposit: 0, transit: 0 };

describe("Milestone 6 operational stock UI", () => {
  it("renders active, zero, and no-position stock list states", () => {
    const html = renderToStaticMarkup(<StockPositionsTable onOpen={() => undefined} positions={[
      { sku: { sku: "ACTIVE", marque: "Brand" }, identity: { sku: "ACTIVE", type: "Box", packSize: 0 }, hasPosition: true, isZero: false, buckets, availableNow: 4 },
      { sku: { sku: "ZERO" }, identity: { sku: "ZERO", type: "Pack", packSize: 4 }, hasPosition: true, isZero: true, buckets: { ...buckets, onHand: 0, reservedClient: 0 }, availableNow: 0 },
      { sku: { sku: "NONE", kind: "ACCESSORY" }, identity: null, hasPosition: false, isZero: true, buckets: { ...buckets, onHand: 0, reservedClient: 0 }, availableNow: 0 },
    ]}/>);
    expect(html).toContain("ACTIVE");
    expect(html).toContain("Position zéro");
    expect(html).toContain("Sans position");
  });

  it("renders aggregate, locations, provenance, and explicit LEGACY_UNKNOWN", () => {
    const html = renderToStaticMarkup(<StockDetailPanel trace={{
      reconciliation: { status: "RECONCILED" },
      aggregate: { buckets, availableNow: 4 },
      locations: [{ locationId: "legacy", code: "LEGACY_UNKNOWN", name: "Unknown", category: "OTHER", buckets }],
      lots: [{ lotId: "lot", locationId: "legacy", locationCode: "LEGACY_UNKNOWN", lotCode: "LEGACY_UNKNOWN", originKind: "LEGACY_UNKNOWN", physicalTotal: 5, receiptCode: null, supplierName: null, receivedAt: null }],
    }}/>);
    expect(html).toContain("RECONCILED");
    expect(html).toContain("Legacy / provenance inconnue");
    expect(html).toContain("Non documentée");
  });

  it("renders immutable movement history and allocation state", () => {
    const html = renderToStaticMarkup(<MovementHistory onOpen={() => undefined} history={{ operations: [{
      groupId: "GROUP-1", movementType: "VENTE", movementDate: "2026-08-25T12:00:00Z", createdAt: "2026-08-25T12:00:00Z", author: "Operator",
      sourceLocation: { code: "STORE", name: "Store" }, destinationLocation: null,
      referenceType: "ORDER", referenceId: "ORDER-1", allocationConsistency: { status: "RECONCILED" }, details: [{ qtyDelta: -2 }],
    }] }}/>);
    expect(html).toContain("VENTE · 2");
    expect(html).toContain("ORDER-1");
    expect(html).toContain("GROUP-1");
    expect(html).toContain("RECONCILED");
  });

  it("renders a visible blocking warning for a 409 inconsistency", () => {
    const html = renderToStaticMarkup(<TraceabilityWarning message="Les projections de stock ne se réconcilient pas."/>);
    expect(html).toContain('role="alert"');
    expect(html).toContain("ne se réconcilient pas");
  });

  it("validates quantities, endpoints, distinct transfers, authors, and correction reasons", () => {
    expect(validateMovementDraft({ movementType: "MISE_EN_DEPOT", qty: 1 })).toEqual(expect.arrayContaining(["Auteur requis.", "Lieu source requis.", "Lieu destination requis."]));
    expect(validateMovementDraft({ movementType: "MISE_EN_DEPOT", qty: 1, author: "Op", sourceLocationId: "same", destinationLocationId: "same" })).toContain("La source et la destination doivent être distinctes.");
    expect(validateMovementDraft({ movementType: "CORRECTION_INVENTAIRE", qty: 0, author: "Op", sourceLocationId: "store" })).toContain("Motif obligatoire pour une correction d’inventaire.");
    expect(validateMovementDraft({ movementType: "RESERVATION_CLIENT", qty: 2, author: "Op", sourceLocationId: "store" })).toEqual([]);
  });

  it("renders the explicit confirmation summary before a consequential write", () => {
    const definition = operationDefinition("MISE_EN_DEPOT");
    const html = renderToStaticMarkup(<MovementConfirmation
      identity={{ sku: "SKU", type: "Box", packSize: 0 }} definition={definition}
      draft={{ qty: 2, sourceLocationId: "A", destinationLocationId: "B" }}
      locations={[{ locationId: "A", code: "STORE", name: "Store" }, { locationId: "B", code: "PARTNER", name: "Partner" }]}
    />);
    expect(html).toContain("Confirmer l’opération");
    expect(html).toContain("Mise en dépôt");
    expect(html).toContain("STORE");
    expect(html).toContain("PARTNER");
  });

  it("refreshes backend truth only after a successful write", async () => {
    const calls: string[] = [];
    const result = await submitMovementAndRefresh(async () => { calls.push("write"); return { groupId: "G" }; }, async () => { calls.push("refresh"); });
    expect(calls).toEqual(["write", "refresh"]);
    expect(result).toEqual({ groupId: "G" });
    const refresh = vi.fn();
    await expect(submitMovementAndRefresh(async () => { throw new Error("failure"); }, refresh)).rejects.toThrow("failure");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("maps actionable backend errors instead of a generic failure", () => {
    expect(operationalErrorMessage("insufficient_eligible_lot_stock")).toContain("Stock insuffisant");
    expect(operationalErrorMessage("stock_concurrency_conflict")).toContain("simultanément");
    expect(operationalErrorMessage("stock_traceability_inconsistent")).toContain("ne se réconcilient pas");
  });
});
