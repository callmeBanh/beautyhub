import { describe, it, expect } from "vitest";
import { checkReleaseConfig, publicHttps } from "../scripts/release-checks.mjs";
import { isPublicKey } from "../scripts/public-key.mjs";

describe("release configuration", () => {
  const valid = {
    VITE_BACKEND_ENABLED: "true",
    VITE_SITE_URL: "https://beautyhub.vn",
    VITE_SUPABASE_URL: "https://projectref.supabase.co",
    VITE_SUPABASE_ANON_KEY: "sb_publishable_fixture",
    VITE_SUPPORT_URL: "https://beautyhub.vn/support",
    VITE_PRIVACY_URL: "https://beautyhub.vn/privacy-contact",
    VITE_OPERATOR_NAME: "Nhóm BeautyHub",
    VITE_POLICY_UPDATED_AT: "2026-01-01",
    VITE_DATA_RETENTION:
      "Thông tin về thời hạn lưu dữ liệu phải do người vận hành điền và thực hiện đúng.",
  };
  it("keeps a disconnected classroom build from passing public launch configuration", () => {
    expect(checkReleaseConfig({}).every((row) => row.ok)).toBe(false);
    expect(
      checkReleaseConfig({ ...valid, VITE_BACKEND_ENABLED: "false" }).find(
        (row) => row.check === "backend_enabled",
      )?.ok,
    ).toBe(false);
    expect(checkReleaseConfig(valid).every((row) => row.ok)).toBe(true);
  });
  it("rejects placeholder/private URLs, embedded credentials and missing operator disclosures", () => {
    for (const value of [
      "http://beautyhub.vn",
      "https://example.com",
      "https://localhost",
      "https://127.0.0.1",
      "https://192.168.1.2",
      "https://name:secret@beautyhub.vn",
      "javascript:alert(1)",
      "https://beautyhub.vn/#secret",
    ])
      expect(publicHttps(value)).toBe(false);
    expect(
      checkReleaseConfig({
        ...valid,
        VITE_SITE_URL: "https://beautyhub.vn/preview",
      }).find((row) => row.check === "public_site_origin")?.ok,
    ).toBe(false);
    expect(
      checkReleaseConfig({ ...valid, VITE_OPERATOR_NAME: "TODO" }).every(
        (row) => row.ok,
      ),
    ).toBe(false);
    expect(
      checkReleaseConfig({
        ...valid,
        VITE_POLICY_UPDATED_AT: "2026-02-30",
      }).every((row) => row.ok),
    ).toBe(false);
    expect(
      checkReleaseConfig({ ...valid, VITE_DATA_RETENTION: "" }).every(
        (row) => row.ok,
      ),
    ).toBe(false);
  });
  it("never accepts secret keys in readiness/network tooling", () => {
    const jwt = (role: string) =>
      `header.${btoa(JSON.stringify({ role }))}.signature`;
    expect(isPublicKey(jwt("anon"))).toBe(true);
    expect(isPublicKey("sb_publishable_test")).toBe(true);
    expect(isPublicKey(jwt("service_role"))).toBe(false);
    expect(isPublicKey("sb_secret_private")).toBe(false);
    expect(isPublicKey(undefined)).toBe(false);
  });
});
