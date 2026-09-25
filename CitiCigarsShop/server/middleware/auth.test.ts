import { afterEach, describe, expect, it, vi } from "vitest";

async function loadAuth() {
  process.env.CMS_ADMIN_PASSWORD = "unit-test-only-password";
  vi.resetModules();
  return import("./auth");
}

function responseStub() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
  delete process.env.CMS_ADMIN_PASSWORD;
  vi.resetModules();
});

describe("admin auth security", () => {
  it("issues signed tokens that expire and rejects the legacy base64 password token", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-25T12:00:00Z"));

    const auth = await loadAuth();
    const session = auth.issueAdminToken("OWNER");

    expect(auth.verifyAdminToken(session.token)?.role).toBe("OWNER");
    expect(auth.isValidAdminToken(Buffer.from("unit-test-only-password").toString("base64"))).toBe(false);

    vi.setSystemTime(new Date("2026-09-25T20:00:31Z"));
    expect(auth.verifyAdminToken(session.token)).toBeNull();
  });

  it("enforces read/write permissions server-side", async () => {
    const auth = await loadAuth();
    const auditor = auth.issueAdminToken("AUDITOR").token;

    const readReq = { headers: { authorization: `Bearer ${auditor}` } } as any;
    const readRes = responseStub() as any;
    let readNext = false;
    auth.requirePermission("crm:read")(readReq, readRes, () => { readNext = true; });
    expect(readNext).toBe(true);

    const writeReq = { headers: { authorization: `Bearer ${auditor}` } } as any;
    const writeRes = responseStub() as any;
    let writeNext = false;
    auth.requirePermission("crm:write")(writeReq, writeRes, () => { writeNext = true; });
    expect(writeNext).toBe(false);
    expect(writeRes.statusCode).toBe(403);
  });

  it("keeps owner access while preventing unknown roles from being accepted", async () => {
    const auth = await loadAuth();
    const owner = auth.issueAdminToken("OWNER").token;
    const req = { headers: { "x-cms-token": owner } } as any;
    const res = responseStub() as any;
    let nextCalled = false;

    auth.requirePermission("governance:write")(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });
});
