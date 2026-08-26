import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "http";

process.env.CMS_ADMIN_PASSWORD = "stock-admin-test";
process.env.MYSQL_URL = "mysql://root@127.0.0.1:3399/not_used_by_injected_routes";

const { registerStockAdminRoutes } = await import("./routes.stock-admin");
const { StockRuleViolation } = await import("./services/stock-movement-processor");

describe("Milestone 6 stock admin routes", () => {
  let server: Server;
  let base = "";
  const applyMovement = vi.fn(async () => ({ groupId: "group-1", balanceBefore: {}, balanceAfter: {} }));
  const dependencies = {
    listPositions: vi.fn(async (search = "") => ({ search, limit: 100, positions: [] })),
    listLocations: vi.fn(async () => [{ locationId: "11111111-1111-4111-8111-111111111111", code: "STORE" }]),
    listReceptionLots: vi.fn(async () => []),
    assertSku: vi.fn(async () => ({})),
    applyMovement,
  };
  const token = Buffer.from("stock-admin-test").toString("base64");
  const request = (path: string, options: RequestInit = {}) => fetch(base + path, {
    ...options,
    headers: { "Content-Type": "application/json", "x-cms-token": token, ...(options.headers ?? {}) },
  });

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    registerStockAdminRoutes(app, dependencies);
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("test server did not bind");
    base = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  it("protects list, locations, reception lots, and writes with existing admin auth", async () => {
    for (const [path, method] of [
      ["/api/admin/stock", "GET"],
      ["/api/admin/stock/locations", "GET"],
      ["/api/admin/stock/reception-lots", "GET"],
      ["/api/admin/stock/movements", "POST"],
    ]) {
      const response = await fetch(base + path, { method });
      expect(response.status).toBe(401);
    }
  });

  it("accepts a valid payload and delegates the mutation exactly once to M4", async () => {
    applyMovement.mockClear();
    const payload = {
      sku: "TEST-SKU",
      type: "Box",
      packSize: 0,
      movementType: "RECEPTION",
      qty: 4,
      destinationLocationId: "11111111-1111-4111-8111-111111111111",
      author: "Operator",
      referenceType: "OTHER",
      referenceId: "REF-1",
    };
    const response = await request("/api/admin/stock/movements", { method: "POST", body: JSON.stringify(payload) });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ groupId: "group-1" });
    expect(dependencies.assertSku).toHaveBeenCalledWith("TEST-SKU");
    expect(applyMovement).toHaveBeenCalledTimes(1);
    expect(applyMovement).toHaveBeenCalledWith(expect.objectContaining(payload));
  });

  it("rejects invalid payloads before invoking the writer", async () => {
    applyMovement.mockClear();
    const response = await request("/api/admin/stock/movements", {
      method: "POST",
      body: JSON.stringify({ sku: "TEST", type: "Bogus", movementType: "FAKE", qty: -1 }),
    });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid_stock_movement_payload");
    expect(applyMovement).not.toHaveBeenCalled();
  });

  it("requires an explicit correction reason at the request boundary", async () => {
    const response = await request("/api/admin/stock/movements", {
      method: "POST",
      body: JSON.stringify({
        sku: "TEST", type: "Box", packSize: 0, movementType: "CORRECTION_INVENTAIRE", qty: 0,
        sourceLocationId: "11111111-1111-4111-8111-111111111111", author: "Operator",
      }),
    });
    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).toContain("correction_reason_required");
  });

  it("maps expected domain and concurrency failures without exposing database errors", async () => {
    applyMovement.mockRejectedValueOnce(new StockRuleViolation("insufficient_eligible_lot_stock"));
    const payload = {
      sku: "TEST", type: "Box", packSize: 0, movementType: "RESERVATION_CLIENT", qty: 1,
      sourceLocationId: "11111111-1111-4111-8111-111111111111", author: "Operator",
    };
    const insufficient = await request("/api/admin/stock/movements", { method: "POST", body: JSON.stringify(payload) });
    expect(insufficient.status).toBe(409);
    expect((await insufficient.json()).error).toBe("insufficient_eligible_lot_stock");

    applyMovement.mockRejectedValueOnce({ code: "ER_LOCK_DEADLOCK", sql: "secret sql" });
    const concurrent = await request("/api/admin/stock/movements", { method: "POST", body: JSON.stringify(payload) });
    expect(concurrent.status).toBe(409);
    expect(await concurrent.json()).toEqual({ error: "stock_concurrency_conflict" });
  });
});
