// Browser contract tests use intercepted Supabase HTTP, never a live payment service.
// Real authorization/state transitions run separately in database.test.ts.
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const customer = "11111111-1111-4111-8111-111111111111";
const owner = "33333333-3333-4333-8333-333333333333";
const admin = "44444444-4444-4444-8444-444444444444";
const bid = "55555555-5555-4555-8555-555555555555";
const pkg = {
  id: "package-1",
  provider_id: "provider-1",
  name: "Gói chân dung",
  service: "Personal",
  description: "Buổi chụp chân dung hai giờ",
  duration: 120,
  price: 1200000,
  delivery_days: 7,
  includes: "20 ảnh chỉnh",
  exclusions: "Studio",
  active: true,
};
const start = new Date(Date.now() + 7 * 86400000).toISOString();
const settings = {
  ready: true,
  bank_name: "Test bank",
  bank_account: "123456789",
  bank_holder: "TEST",
  support_url: "https://example.com",
  cancellation_policy: "Chính sách kiểm thử. ".repeat(10),
  policy_version: 1,
};
const provider = {
  id: "provider-1",
  owner_id: owner,
  slug: "test-studio",
  name: "Test Studio",
  category: "Photographer",
  bio: "Hồ sơ kiểm thử",
  districts: ["Quận 1"],
  styles: ["Natural", "Korean"],
  status: "APPROVED",
  packages: [pkg],
  portfolio_assets: [],
  reviews: [],
};

async function setup(context: BrowserContext) {
  let actor = customer;
  let booking: any = null;
  let reviews: any[] = [];
  let tickets: any[] = [];
  let failCreate = false;
  let failSlots = false;
  const keys: string[] = [];
  await context.addInitScript(
    ({ customer }) => {
      const user = {
        id: customer,
        email: "test@example.com",
        aud: "authenticated",
        role: "authenticated",
        app_metadata: {},
        user_metadata: {},
        created_at: new Date().toISOString(),
      };
      localStorage.setItem(
        "sb-test-auth-token",
        JSON.stringify({
          access_token: "test-session-token",
          refresh_token: "test-refresh",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          expires_in: 3600,
          token_type: "bearer",
          user,
        }),
      );
    },
    { customer },
  );
  await context.route("https://test.supabase.co/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    const body = req.method() === "POST" ? req.postDataJSON() || {} : {};
    let data: any = [];
    let status = 200;
    const name = url.pathname.split("/").pop();
    if (url.pathname.includes("/auth/"))
      data = {
        id: actor,
        email: "test@example.com",
        aud: "authenticated",
        role: "authenticated",
        app_metadata: {},
        user_metadata: {},
      };
    else if (url.pathname.includes("/rpc/")) {
      if (
        [
          "submit_review",
          "request_support",
          "confirm_refund",
          "reconcile_late_deposit",
        ].includes(name || "")
      )
        await new Promise((resolve) => setTimeout(resolve, 300));
      switch (name) {
        case "provider_stats":
          data = [];
          break;
        case "provider_reviews":
          data = reviews;
          break;
        case "free_slots":
          if (failSlots) {
            status = 503;
            data = { message: "Unavailable" };
          } else
            data = [
              {
                starts_at: start,
                ends_at: new Date(Date.parse(start) + 7200000).toISOString(),
              },
            ];
          break;
        case "create_booking":
          keys.push(body.p_key);
          if (failCreate) {
            failCreate = false;
            status = 503;
            data = { message: "Network temporarily unavailable" };
            break;
          }
          booking = {
            id: bid,
            customer_id: customer,
            provider_id: provider.id,
            package_id: pkg.id,
            customer_name: body.p_name,
            phone: body.p_phone,
            district: body.p_district,
            address: body.p_address,
            notes: body.p_notes,
            price: pkg.price,
            deposit: 360000,
            status: "REQUESTED",
            payment_status: "UNPAID",
            starts_at: start,
            ends_at: new Date(Date.parse(start) + 7200000).toISOString(),
            hold_until: new Date(Date.now() + 3600000).toISOString(),
            created_at: new Date().toISOString(),
            snapshot: {
              provider_name: provider.name,
              package: pkg,
              policy: settings.cancellation_policy,
              ...settings,
            },
          };
          data = bid;
          break;
        case "booking_contact":
          data = "0901234567";
          break;
        case "booking_action":
          // Delay lets keyboard tests exercise busy modal behavior.
          await new Promise((resolve) => setTimeout(resolve, 300));
          if (body.p_action === "ACCEPT") booking.status = "AWAITING_DEPOSIT";
          if (body.p_action === "REPORT_PAYMENT") {
            booking.status = "PAYMENT_REVIEW";
            booking.payment_status = "REPORTED";
          }
          if (body.p_action === "VERIFY_PAYMENT") {
            booking.status = "CONFIRMED";
            booking.payment_status = "PAID";
          }
          if (body.p_action === "COMPLETE") booking.status = "COMPLETED";
          if (body.p_action === "CANCEL") booking.status = "CANCELLED";
          data = null;
          break;
        case "submit_review":
          reviews = [
            {
              id: "review-1",
              provider_id: provider.id,
              booking_id: bid,
              author_name: "Khách",
              rating: 5,
              text: body.p_text,
              hidden: false,
              created_at: new Date().toISOString(),
            },
          ];
          data = null;
          break;
        case "request_support":
          tickets = [
            {
              id: "ticket-1",
              booking_id: bid,
              kind: body.p_kind,
              message: body.p_message,
              status: "OPEN",
              created_at: new Date().toISOString(),
            },
          ];
          data = "ticket-1";
          break;
        case "resolve_support":
          booking.status = "CANCELLED";
          booking.payment_status = "REFUND_PENDING";
          booking.refund_amount = body.p_refund;
          tickets[0].status = "RESOLVED";
          data = null;
          break;
        case "confirm_refund":
          booking.payment_status = "REFUNDED";
          data = null;
          break;
        case "reconcile_late_deposit":
          booking.payment_status = "REFUND_PENDING";
          booking.refund_amount = booking.deposit;
          data = null;
          break;
        case "admin_metrics":
          data = {
            users: 3,
            active_providers: 1,
            requests: 1,
            paid: 0,
            completed: 0,
            gmv: 0,
            cancellation_rate: 0,
            funnel: {},
          };
          break;
        default:
          data = null;
      }
    } else {
      switch (name) {
        case "providers":
          data = [provider];
          break;
        case "settings":
          data = settings;
          break;
        case "profiles":
          data = req.headers().accept?.includes("object")
            ? {
                id: actor,
                display_name: "Khách thử",
                phone: "0901234567",
                role:
                  actor === admin
                    ? "ADMIN"
                    : actor === owner
                      ? "PROVIDER"
                      : "CUSTOMER",
              }
            : [];
          break;
        case "bookings":
          data = url.searchParams.has("id")
            ? booking
            : booking
              ? [booking]
              : [];
          if (url.searchParams.get("id") === "eq.missing") {
            status = 406;
            data = { message: "Không tìm thấy booking" };
          }
          break;
        case "reviews":
          data = reviews[0] || null;
          break;
        case "support_requests":
          data = tickets;
          break;
        default:
          data = [];
      }
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  return {
    role(id: string) {
      actor = id;
    },
    failCreate() {
      failCreate = true;
    },
    failSlots() {
      failSlots = true;
    },
    endService() {
      booking.ends_at = new Date(Date.now() - 1000).toISOString();
    },
    keys,
  };
}

async function requestBooking(page: Page, retry = false) {
  await page.goto(
    "/explore?category=Photographer&district=Quận+1&style=Natural&service=Personal&budget=1500000",
  );
  await page.getByRole("link", { name: /Test Studio/ }).click();
  await expect(
    page.getByRole("heading", { name: "Test Studio", exact: true }),
  ).toBeVisible();
  await page.locator(".slot").first().click();
  await page.getByLabel("Họ và tên").fill("Khách thử nghiệm");
  await page
    .getByLabel("Địa chỉ / địa điểm gặp cụ thể")
    .fill("12 Nguyễn Huệ, TP.HCM");
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: /Gửi yêu cầu/ }).click();
  if (retry) {
    await expect(page.getByRole("alert")).toContainText("Không kết nối được");
    await expect(page.getByLabel("Địa chỉ / địa điểm gặp cụ thể")).toHaveValue(
      "12 Nguyễn Huệ, TP.HCM",
    );
    await page.getByRole("button", { name: /Gửi yêu cầu/ }).click();
  }
  await expect(page).toHaveURL(new RegExp(`/bookings/${bid}`));
  await expect(
    page.getByRole("heading", { name: "Yêu cầu của bạn đã được gửi." }),
  ).toBeVisible();
}

async function confirm(page: Page, button: string, detail?: string) {
  await page.getByRole("button", { name: button, exact: true }).click();
  const dialog = page.getByRole("dialog");
  if (detail) await dialog.locator("textarea").fill(detail);
  await dialog.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible(); // Busy modal must ignore Escape.
  await expect(dialog).toBeHidden();
}

test("booking journey, network retry, payment review, completion and one review", async ({
  page,
  context,
}) => {
  const api = await setup(context);
  api.failCreate();
  await requestBooking(page, true);
  expect(api.keys).toHaveLength(2);
  expect(api.keys[0]).toBe(api.keys[1]);
  api.role(owner);
  await page.reload();
  await page
    .getByRole("button", { name: "Chấp nhận lịch", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Chuyển khoản cọc/ }),
  ).toBeVisible();
  api.role(customer);
  await page.reload();
  await confirm(page, "Tôi đã chuyển tiền", "Bank customer reference 123");
  await expect(
    page.getByRole("heading", { name: "Đã nhận thông báo chuyển tiền" }),
  ).toBeVisible();
  api.role(admin);
  await page.reload();
  await confirm(page, "Xác nhận tiền thực nhận", "Verified bank reference 123");
  api.endService();
  api.role(owner);
  await page.reload();
  await confirm(page, "Xác nhận đã hoàn thành dịch vụ");
  api.role(customer);
  await page.reload();
  await confirm(page, "Viết đánh giá", "Creator đúng giờ và chất lượng tốt.");
  await expect(page.getByRole("button", { name: "Viết đánh giá" })).toHaveCount(
    0,
  );
  await expect(
    page
      .getByText("Creator đúng giờ và chất lượng tốt.", { exact: false })
      .first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("unpaid cancellation and recoverable missing booking", async ({
  page,
  context,
}) => {
  await setup(context);
  await requestBooking(page);
  await confirm(page, "Hủy yêu cầu");
  await expect(
    page.getByRole("heading", { name: "Booking đã được hủy." }),
  ).toBeVisible();
  await page.goto("/bookings/missing");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: "Thử lại" })).toBeVisible();
  await expect(
    page.getByText("12 Nguyễn Huệ, TP.HCM", { exact: false }),
  ).toHaveCount(0);
});

test("discovery empty state and slot service error", async ({
  page,
  context,
}) => {
  const api = await setup(context);
  await page.goto("/explore?q=does-not-exist");
  await expect(
    page.getByRole("heading", { name: "Chưa có creator khớp lựa chọn" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Xem mọi lựa chọn" }).click();
  api.failSlots();
  await page.getByRole("link", { name: /Test Studio/ }).click();
  await expect(page.getByRole("alert")).toContainText("Không tải được lịch");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("paid cancellation through admin support and refund recording", async ({
  page,
  context,
}) => {
  const api = await setup(context);
  await requestBooking(page);
  api.role(owner);
  await page.reload();
  await page
    .getByRole("button", { name: "Chấp nhận lịch", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Chuyển khoản cọc/ }),
  ).toBeVisible();
  api.role(customer);
  await page.reload();
  await confirm(page, "Tôi đã chuyển tiền", "Customer bank reference 123");
  api.role(admin);
  await page.reload();
  await confirm(page, "Xác nhận tiền thực nhận", "Verified bank reference 123");
  api.role(customer);
  await page.reload();
  await page
    .getByRole("button", { name: "Gửi yêu cầu hỗ trợ", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .locator("textarea")
    .fill("Xin hủy và hoàn cọc theo chính sách.");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Xác nhận", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  api.role(admin);
  await page.goto("/admin");
  await page.getByRole("button", { name: "Xử lý", exact: true }).click();
  await page
    .getByLabel("Kết quả và thỏa thuận với khách")
    .fill("Đồng ý hủy và hoàn toàn bộ cọc theo thỏa thuận.");
  await page.getByRole("dialog").locator('input[type="checkbox"]').check();
  await page.getByLabel("Số tiền hoàn khi hủy (VND)").fill("360000");
  await page
    .getByRole("button", { name: "Ghi nhận xử lý", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto(`/bookings/${bid}`);
  await confirm(page, "Ghi nhận giao dịch hoàn", "Refund bank reference 123");
  await expect(
    page.getByRole("button", { name: "Ghi nhận giao dịch hoàn" }),
  ).toHaveCount(0);
  await expect(page.getByText("Đã hoàn tiền:", { exact: false })).toBeVisible();
});

test("booking works when draft storage is blocked", async ({
  page,
  context,
}) => {
  await setup(context);
  await context.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", {
      get() {
        throw new DOMException("Storage blocked", "SecurityError");
      },
    });
  });
  await requestBooking(page);
});

test("late deposit refund preserves cancellation and customer cannot open admin", async ({
  page,
  context,
}) => {
  const api = await setup(context);
  await requestBooking(page);
  await confirm(page, "Hủy yêu cầu");
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Bạn không có quyền truy cập" }),
  ).toBeVisible();
  api.role(admin);
  await page.goto(`/bookings/${bid}`);
  await confirm(
    page,
    "Đối soát cọc chuyển muộn để hoàn",
    "Received late bank deposit 123",
  );
  await expect(
    page.getByRole("heading", { name: "Booking đã được hủy." }),
  ).toBeVisible();
  await confirm(
    page,
    "Ghi nhận giao dịch hoàn",
    "Actual late refund reference 123",
  );
  await expect(page.getByText("Đã hoàn tiền:", { exact: false })).toBeVisible();
});

test("accessibility of discovery, creator, booking and admin", async ({
  page,
  context,
}, testInfo) => {
  const api = await setup(context);
  for (const path of ["/explore", "/creators/test-studio"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(
        path.includes("creators") ? "creator.png" : "discovery.png",
      ),
      fullPage: true,
    });
  }
  await requestBooking(page);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("booking.png"),
    fullPage: true,
  });
  api.role(admin);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("admin.png"),
    fullPage: true,
  });
});
