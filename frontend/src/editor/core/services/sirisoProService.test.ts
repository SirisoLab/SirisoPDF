import { describe, expect, it } from "vitest";
import {
  computeAccess,
  DEFAULT_ACCESS_POLICY,
} from "@editor/services/sirisoProService";

const proOnly = DEFAULT_ACCESS_POLICY;
const freeMode = { workspaceRequiresPro: false };

describe("computeAccess", () => {
  it("keeps a signed-out visitor out of the workspace in every mode", () => {
    expect(computeAccess({ isPro: false }, proOnly).workspace).toBe(false);
    expect(computeAccess({ isPro: false }, freeMode).workspace).toBe(false);
  });

  it("needs Pro for a customer when the backoffice requires it", () => {
    const customer = { isPro: false, authToken: "t", customerEmail: "a@b.c" };
    expect(computeAccess(customer, proOnly)).toEqual({
      workspace: false,
      adFree: false,
      desktop: false,
      admin: false,
    });
    expect(computeAccess({ ...customer, isPro: true }, proOnly)).toEqual({
      workspace: true,
      adFree: true,
      desktop: true,
      admin: false,
    });
  });

  it("lets a free account in with ads when the backoffice allows free access", () => {
    const customer = { isPro: false, authToken: "t", customerEmail: "a@b.c" };
    expect(computeAccess(customer, freeMode)).toMatchObject({
      workspace: true,
      adFree: false,
      desktop: false,
    });
  });

  it("gives Tim and Admin everything without a subscription, admin flag only to Admin", () => {
    const staff = { isPro: false, authToken: "t", role: "staff" as const };
    const admin = { isPro: false, authToken: "t", role: "admin" as const };
    expect(computeAccess(staff, proOnly)).toEqual({
      workspace: true,
      adFree: true,
      desktop: true,
      admin: false,
    });
    expect(computeAccess(admin, proOnly).admin).toBe(true);
  });
});
