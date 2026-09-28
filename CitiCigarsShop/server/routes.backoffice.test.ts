import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "http";
process.env.CMS_ADMIN_PASSWORD = "backoffice-test-password";
const read = vi.fn(async () => ({ readOnly: true }));
vi.mock("./services/backoffice", () => ({
  backofficeDashboard: () => read(),
  backofficeCosting: () => read(),
  orderCostTrace: () => read(),
}));
const { registerBackofficeRoutes } = await import("./routes.backoffice");
const { issueAdminToken } = await import("./middleware/auth");
let server: Server, base: string;
beforeAll(async () => {
  const app = express();
  registerBackofficeRoutes(app);
  server = createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});
describe("backoffice API boundary", () => {
  it("never reads economic data for anonymous or non-CT callers", async () => {
    for (const path of [
      "/api/admin/backoffice/costing",
      "/api/admin/backoffice/costing/orders/CTCG-SALE-000001",
    ]) {
      read.mockClear();
      expect((await fetch(base + path)).status).toBe(401);
      for (const role of [
        "ADMIN",
        "AUDITOR",
        "CRM_OPERATOR",
        "STOCK_OPERATOR",
        "PURCHASING_OPERATOR",
      ] as const) {
        expect(
          (
            await fetch(base + path, {
              headers: { "x-cms-token": issueAdminToken(role).token },
            })
          ).status,
        ).toBe(403);
      }
      expect(read).not.toHaveBeenCalled();
    }
  });
  it("allows CT costing and returns unavailable instead of fabricated data", async () => {
    const headers = { "x-cms-token": issueAdminToken("OWNER").token };
    expect(
      (await fetch(base + "/api/admin/backoffice/costing", { headers })).status,
    ).toBe(200);
    read.mockRejectedValueOnce(new Error("private SQL details"));
    const result = await fetch(base + "/api/admin/backoffice/costing", {
      headers,
    });
    expect(result.status).toBe(503);
    expect(await result.text()).not.toContain("private SQL");
  });
});
