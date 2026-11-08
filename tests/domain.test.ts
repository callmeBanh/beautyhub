import { describe, it, expect } from "vitest";
import {
  safeNext,
  effectiveStatus,
  filterProviders,
  formatDuration,
  durationHoursToMinutes,
  durationMinutesToHours,
  SERVICES,
  serviceLabel,
  persistedReviews,
  validatePackageDetails,
  errorText,
  type Booking,
  type Provider,
  type Review,
} from "../src/domain";
describe("customer journey", () => {
  it("labels package needs in Vietnamese without changing stored values", () => {
    expect(SERVICES).toContain("anniversary");
    expect(serviceLabel("Personal")).toBe("Cá nhân");
    expect(serviceLabel("Couple")).toBe("Cặp đôi");
    expect(serviceLabel("anniversary")).toBe("Kỷ niệm");
    expect(serviceLabel("legacy-service")).toBe("legacy-service");
  });
  it("converts package duration between entered hours and stored minutes", () => {
    expect(durationHoursToMinutes("0,5")).toBe(30);
    expect(durationHoursToMinutes("1.5")).toBe(90);
    expect(durationHoursToMinutes("8")).toBe(480);
    expect(durationHoursToMinutes("1,25")).toBeNull();
    expect(durationHoursToMinutes("0")).toBeNull();
    expect(durationHoursToMinutes("8.5")).toBeNull();
    expect(durationHoursToMinutes("abc")).toBeNull();
    expect(durationMinutesToHours(90)).toBe("1,5");
  });
  it("formats package duration in hours, except under one hour", () => {
    expect(formatDuration(480)).toBe("8 giờ");
    expect(formatDuration(90)).toBe("1,5 giờ");
    expect(formatDuration(30)).toBe("30 phút");
  });
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
  it("explains how to resolve a missing package-details RPC", () => {
    expect(
      errorText({
        code: "PGRST202",
        message:
          "Could not find the function public.save_package_details(p_active) in the schema cache",
      }),
    ).toContain("202611040001_package_details.sql");
    expect(
      errorText({
        code: "PGRST202",
        message: "Could not find the function public.other_rpc()",
      }),
    ).toContain("public.other_rpc()");
  });
});
