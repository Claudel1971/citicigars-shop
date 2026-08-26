import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SaleStockContractFields } from "./NewSale";

describe("Milestone 7 CRM sale stock fields", () => {
  it("shows exact identity, source location by business label, and automatic FIFO doctrine", () => {
    const html = renderToStaticMarkup(<SaleStockContractFields
      line={{ itemType: "PRODUCT", stockDisposition: "CONSUME", stockType: "Pack", stockPackSize: 5, sourceLocationId: "loc" }}
      locations={[{ locationId: "loc", code: "STORE", name: "Cave principale", category: "CITI_STORAGE" }]}
      onChange={vi.fn()}
    />);
    expect(html).toContain("Identité stock exacte");
    expect(html).toContain("Pack size exact");
    expect(html).toContain("STORE — Cave principale");
    expect(html).toContain("FIFO M4");
    expect(html).not.toContain("UUID");
  });

  it("renders an explicit non-stock classification without physical selectors", () => {
    const html = renderToStaticMarkup(<SaleStockContractFields
      line={{ stockDisposition: "NON_STOCK", nonStockReason: "SERVICE_NON_PHYSIQUE" }}
      locations={[]}
      onChange={vi.fn()}
    />);
    expect(html).toContain("NON_STOCK");
    expect(html).not.toContain("Lieu source physique");
  });
});
