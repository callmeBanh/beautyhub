import { describe, it, expect } from "vitest";
import {
  safeNext,
  effectiveStatus,
  filterProviders,
  persistedReviews,
  validatePackageDetails,
  type Booking,
  type Provider,
  type Review,
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
  it("only treats persisted reviews as real rating data", () => {
    const review = (id: string, hidden = false): Review => ({
      id,
      booking_id: "booking",
      provider_id: "provider",
      author_name: "Khách",
      rating: 5,
      text: "Đánh giá kiểm thử",
      hidden,
      created_at: "2026-11-04T00:00:00Z",
    });

    expect(
      persistedReviews([
        review("demo-review"),
        review("11111111-1111-4111-8111-111111111111"),
        review("22222222-2222-4222-8222-222222222222", true),
      ]).map((item) => item.id),
    ).toEqual(["11111111-1111-4111-8111-111111111111"]);
  });
  it("validates optional package details and bounded lists", () => {
    expect(
      validatePackageDetails({
        original_photo_count: null,
        edited_photo_count: 12,
        revision_count: 2,
        included_items: ["Tư vấn concept", "Trang phục"],
        customer_benefits: null,
      }),
    ).toBeNull();
    expect(
      validatePackageDetails({
        original_photo_count: -1,
        edited_photo_count: null,
        revision_count: null,
        included_items: null,
        customer_benefits: null,
      }),
    ).toContain("Số ảnh gốc");
    expect(
      validatePackageDetails({
        original_photo_count: null,
        edited_photo_count: null,
        revision_count: null,
        included_items: Array.from({ length: 21 }, (_, index) => `Mục ${index}`),
        customer_benefits: null,
      }),
    ).toContain("tối đa 20 mục");
    expect(
      validatePackageDetails({
        original_photo_count: null,
        edited_photo_count: null,
        revision_count: null,
        included_items: ["x".repeat(201)],
        customer_benefits: null,
      }),
    ).toContain("200 ký tự");
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
