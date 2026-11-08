import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  canonicalPayOSData,
  createPayOSWebhookSignature,
  timingSafeHexEqual,
} from "../supabase/functions/_shared/payos";

describe("payOS webhook signature", () => {
  it("matches the official Node SDK signature for a complete payment webhook payload", async () => {
    const data = {
      orderCode: 123,
      amount: 3000,
      description: "VQRIO order 123",
      accountNumber: "12345678",
      reference: "TF230204212323",
      transactionDateTime: "2023-02-04 18:25:00",
      paymentLinkId: "124c33293c93417ab7879e14c8d9eb18",
      code: "00",
      desc: "Thành công",
      counterAccountBankId: "",
      counterAccountBankName: null,
      counterAccountName: "",
      counterAccountNumber: null,
      virtualAccountName: "",
      virtualAccountNumber: null,
      currency: "VND",
    };
    const canonical =
      "accountNumber=12345678&amount=3000&code=00&counterAccountBankId=&counterAccountBankName=&counterAccountName=&counterAccountNumber=&currency=VND&desc=Thành công&description=VQRIO order 123&orderCode=123&paymentLinkId=124c33293c93417ab7879e14c8d9eb18&reference=TF230204212323&transactionDateTime=2023-02-04 18:25:00&virtualAccountName=&virtualAccountNumber=";
    const checksumKey = "test-only-checksum-key";
    const expected = createHmac("sha256", checksumKey)
      .update(canonical)
      .digest("hex");

    expect(canonicalPayOSData(data)).toBe(canonical);
    expect(await createPayOSWebhookSignature(data, checksumKey)).toBe(expected);
  });

  it("matches official Node SDK serialization for arrays and nested objects", () => {
    expect(
      canonicalPayOSData({
        nested: { value: "left/right" },
        items: [{ z: "a b", a: 1 }],
        amount: 1200,
        nullValue: null,
        empty: "",
      }),
    ).toBe(
      'amount=1200&empty=&items=[{"a":1,"z":"a b"}]&nested=[object Object]&nullValue=',
    );
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

});
