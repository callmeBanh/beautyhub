import { describe, expect, it } from "vitest";
import {
  canonicalPayOSData,
  createPayOSWebhookSignature,
  isPayOSWebhookProbe,
  timingSafeHexEqual,
} from "../supabase/functions/_shared/payos";

describe("payOS webhook signature", () => {
  it("uses the documented sorted and encoded data representation", () => {
    expect(
      canonicalPayOSData({
        z: "a b",
        items: [{ value: "x/y" }],
        amount: 1200,
      }),
    ).toBe("amount=1200&items=%5B%7B%22value%22%3A%22x%2Fy%22%7D%5D&z=a%20b");
  });

  it("accepts a matching HMAC and rejects a changed signature", async () => {
    const signature = await createPayOSWebhookSignature(
      { amount: 1200, orderCode: 123 },
      "test-only-checksum-key",
    );
    expect(timingSafeHexEqual(signature, signature.toUpperCase())).toBe(true);
    const changed = `${signature[0] === "0" ? "1" : "0"}${signature.slice(1)}`;
    expect(timingSafeHexEqual(changed, signature)).toBe(false);
    expect(timingSafeHexEqual("invalid", signature)).toBe(false);
  });

  it("recognizes the successful empty-data registration probe without accepting transactions", () => {
    expect(
      isPayOSWebhookProbe({
        code: "00",
        desc: "success",
        success: true,
        data: {},
        signature: "probe-signature",
      }),
    ).toBe(true);
    expect(
      isPayOSWebhookProbe({
        code: "00",
        desc: "success",
        success: true,
        data: { orderCode: 123 },
        signature: "probe-signature",
      }),
    ).toBe(false);
  });
});
