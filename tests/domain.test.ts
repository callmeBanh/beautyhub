import { describe, it, expect } from "vitest";
import {
  safeNext,
  effectiveStatus,
  filterProviders,
  type Booking,
  type Provider,
} from "../src/domain";
import { resolveBankCode, buildVietQrUrl } from "../src/vietqr";
describe("customer journey", () => {
  it("rejects external OAuth return paths", () => {
    expect(safeNext("//evil.example")).toBe("/bookings");
    expect(safeNext("/\\evil.example")).toBe("/bookings");
    expect(safeNext("https://evil.example")).toBe("/bookings");
    expect(safeNext("/checkout/package?start=123")).toBe(
      "/checkout/package?start=123",
    );
  });
  it("does not expire payment under review", () => {
    const b = { status: "PAYMENT_REVIEW", hold_until: "2020-01-01" } as Booking;
    expect(effectiveStatus(b)).toBe("PAYMENT_REVIEW");
    expect(effectiveStatus({ ...b, status: "REQUESTED" })).toBe("EXPIRED");
  });
  it("combines service, district, style, and budget rather than choosing one", () => {
    const p = {
      id: "1",
      name: "Test",
      status: "APPROVED",
      category: "Photographer",
      districts: ["Quận 1"],
      styles: ["Natural"],
      packages: [{ active: true, price: 900000, service: "Personal" }],
    } as Provider;
    const f = {
      category: "Photographer",
      district: "Quận 1",
      style: "Natural",
      service: "Personal",
      budget: 1000000,
      query: "",
    };
    expect(filterProviders([p], f)).toHaveLength(1);
    expect(filterProviders([p], { ...f, district: "Quận 3" })).toHaveLength(0);
    expect(filterProviders([p], { ...f, budget: 500000 })).toHaveLength(0);
    expect(filterProviders([{ ...p, status: "PENDING" }], f)).toHaveLength(0);
  });
  it("resolves bank names and builds standardized VietQR URL", () => {
    expect(resolveBankCode("Ngân hàng TMCP Quân Đội (MB)")).toBe("mbbank");
    expect(resolveBankCode("Vietcombank")).toBe("vietcombank");
    expect(resolveBankCode("Techcombank")).toBe("techcombank");
    const url = buildVietQrUrl({
      bankName: "MBBank",
      accountNo: "0987 654 321",
      accountHolder: "NGUYEN VAN A",
      amount: 300000,
      memo: "BH 123456",
    });
    expect(url).toBe(
      "https://img.vietqr.io/image/mbbank-0987654321-compact2.png?amount=300000&addInfo=BH%20123456&accountName=NGUYEN%20VAN%20A",
    );
  });
});
