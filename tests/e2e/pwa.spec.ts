import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("production PWA has install metadata, icons and accessible instructions", async ({
  page,
  context,
}) => {
  // This test intentionally does not impersonate a Supabase user.
  await context.route("https://test.supabase.co/**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        message: "Backend unavailable during offline-only verification",
      }),
    }),
  );
  await page.goto("/install");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Khoảnh khắc",
  );
  const manifest = await (
    await page.request.get("/manifest.webmanifest")
  ).json();
  expect(manifest).toMatchObject({
    id: "/",
    scope: "/",
    display: "standalone",
    start_url: "/?source=pwa",
    lang: "vi",
  });
  for (const icon of manifest.icons) {
    const image = await page.request.get(icon.src);
    expect(image.ok()).toBe(true);
    expect(image.headers()["content-type"]).toContain("image/png");
  }
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: test.info().outputPath("install.png"),
    fullPage: true,
  });
});

test("offline navigation uses a public fallback and private HTTP responses are never cached", async ({
  page,
  context,
}) => {
  await context.route("https://test.supabase.co/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.goto("/install");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
  });
  // Same-origin sensitive responses are fetched but must not enter Cache Storage.
  await page.route("**/private-test-data", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ address: "PRIVATE_ADDRESS_SENTINEL" }),
    }),
  );
  expect(
    await page.evaluate(
      async () => await (await fetch("/private-test-data")).json(),
    ),
  ).toEqual({ address: "PRIVATE_ADDRESS_SENTINEL" });
  await page.evaluate(async () => {
    await fetch("https://test.supabase.co/rest/v1/bookings?select=*");
    await fetch("/auth/callback?code=TEST_OAUTH_CODE");
  });
  const cached = await page.evaluate(async () => {
    const result: string[] = [];
    for (const name of await caches.keys())
      for (const request of await (await caches.open(name)).keys())
        result.push(request.url);
    return result;
  });
  expect(cached.length).toBeGreaterThan(10);
  expect(
    cached.some((url) =>
      /bookings|private-test-data|TEST_OAUTH_CODE|supabase|auth\/callback/.test(
        url,
      ),
    ),
  ).toBe(false);
  expect(
    cached.every((url) => new URL(url).origin === new URL(page.url()).origin),
  ).toBe(true);
  await context.setOffline(true);
  await page.goto("/bookings/private-booking");
  await expect(
    page.getByRole("heading", { name: "Kết nối lại để tiếp tục." }),
  ).toBeVisible();
  await expect(page.getByText("PRIVATE_ADDRESS_SENTINEL")).toHaveCount(0);
  await expect(page.getByText("Thiết bị đang ngoại tuyến.")).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await context.setOffline(false);
  await page.getByRole("button", { name: "Thử kết nối lại" }).click();
  await expect(
    page.getByRole("heading", { name: "Kết nối lại để tiếp tục." }),
  ).toHaveCount(0);
});

test("install prompt opens only after the user chooses install", async ({
  page,
  context,
}) => {
  await context.route("https://test.supabase.co/**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"message":"Unavailable"}',
    }),
  );
  await page.goto("/install");
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, {
      prompt: async () => {
        document.documentElement.dataset.installPrompt = "opened";
      },
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    window.dispatchEvent(event);
  });
  expect(
    await page.locator("html").getAttribute("data-install-prompt"),
  ).toBeNull();
  await page
    .getByRole("button", { name: "Cài BeautyHub", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-install-prompt",
    "opened",
  );
});

test("an available update waits for user choice before reloading", async ({
  page,
  context,
}) => {
  // The real worker/cache is covered above; this fixture tests the waiting-worker UI lifecycle.
  await context.addInitScript(() => {
    const serviceWorker = new EventTarget();
    const waiting = {
      postMessage(message: { type: string }) {
        if (message.type !== "SKIP_WAITING") return;
        sessionStorage.setItem("test-update-accepted", "true");
        serviceWorker.dispatchEvent(new Event("controllerchange"));
      },
    };
    Object.assign(serviceWorker, {
      controller: {},
      register: async () => ({
        waiting: sessionStorage.getItem("test-update-accepted")
          ? null
          : waiting,
        addEventListener() {},
        update: async () => {},
      }),
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: serviceWorker,
    });
  });
  await context.route("https://test.supabase.co/**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"message":"Unavailable"}',
    }),
  );
  await page.goto("/install");
  const banner = page.getByRole("status", {
    name: "Bản cập nhật ứng dụng",
    exact: true,
  });
  await expect(banner).toBeVisible();
  expect(
    await page.evaluate(() => sessionStorage.getItem("test-update-accepted")),
  ).toBeNull();
  const loaded = page.waitForEvent("load");
  await banner.getByRole("button", { name: "Cập nhật", exact: true }).click();
  await loaded;
  await expect(banner).toHaveCount(0);
  expect(
    await page.evaluate(() => sessionStorage.getItem("test-update-accepted")),
  ).toBe("true");
});
