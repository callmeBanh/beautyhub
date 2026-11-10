import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

let db: PGlite;
const customer = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  owner = "33333333-3333-4333-8333-333333333333",
  admin = "44444444-4444-4444-8444-444444444444";
let provider: string, pkg: string, booking: string;
const day = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
const start = `${day}T09:00:00+07:00`;
const key = "55555555-5555-4555-8555-555555555555";
async function as(id: string | null, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    id || "",
  ]);
  await db.exec(`set role ${role}`);
}
async function call<T = any>(sql: string, args: unknown[] = []) {
  return (await db.query<T>(sql, args)).rows;
}
async function create(at = start, requestKey = crypto.randomUUID()) {
  return call<{ id: string }>(
    "select public.create_booking($1,$2,'Khách thử nghiệm','0901234567','Quận 1','12 Nguyễn Huệ, TP.HCM','', $3) id",
    [pkg, at, requestKey],
  );
}
async function createAwaiting(at: string, customerId = customer) {
  await as(customerId);
  const [{ id }] = await create(at);
  await as(owner);
  await call("select public.booking_action($1,'ACCEPT','')", [id]);
  return id;
}
async function addPayOSAvailability(offsetDays: number) {
  const payosDay = new Date(
    Date.now() + (7 + offsetDays) * 86400000,
  )
    .toISOString()
    .slice(0, 10);
  await as(owner);
  await call("select public.add_availability($1,$2)", [
    `${payosDay}T09:00:00+07:00`,
    `${payosDay}T18:00:00+07:00`,
  ]);
  return payosDay;
}
beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist } });
  await db.waitReady;
  await db.exec(
    `create schema auth;create schema storage;create schema extensions;create role anon;create role authenticated;create role service_role bypassrls;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth,public,storage to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant select,insert on storage.objects to anon,authenticated;create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`,
  );
  await db.exec(
    readFileSync("supabase/migrations/202610050001_beta.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/202610050002_operations.sql", "utf8"),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202611040001_package_details.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202611080001_package_anniversary.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync("supabase/migrations/202611080002_payos_deposits.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/202611100001_direct_deposits.sql", "utf8"),
  );
  await db.query("insert into auth.users(id) values ($1),($2),($3),($4)", [
    customer,
    other,
    owner,
    admin,
  ]);
  await db.query("update public.profiles set role='ADMIN' where id=$1", [
    admin,
  ]);
  await db.query(
    "update public.profiles set phone='0901234567',display_name='Test' where id=$1",
    [owner],
  );
  await as(owner);
  provider = (
    await call<{ id: string }>(
      "select public.save_provider('test-studio','Test Studio','Photographer','Hồ sơ kiểm thử dữ liệu có xác minh.',array['Quận 1'],array['Natural','Korean']) id",
    )
  )[0].id;
  await call(
    "insert into public.provider_payout_accounts(provider_id,bank_bin,bank_name,account_number,account_name) values($1,'970436','Vietcombank','123456789','TEST CREATOR')",
    [provider],
  );
  pkg = (
    await call<{ id: string }>(
      "select public.save_package(null,'Gói 2 giờ','Personal','Mô tả gói kiểm thử',120,1200000,7,'20 ảnh chỉnh','Studio trả riêng',true) id",
    )
  )[0].id;
  await call("select public.add_availability($1,$2)", [
    `${day}T09:00:00+07:00`,
    `${day}T18:00:00+07:00`,
  ]);
  await as(admin);
  await db.exec("reset role");
  await db.query("update public.providers set status='APPROVED' where id=$1", [
    provider,
  ]);
  await db.exec(
    "update public.settings set ready=true,bank_name='Test bank',bank_account='123456789',bank_holder='TEST',support_url='https://example.com',cancellation_policy='Policy test' where id",
  );
}, 60000);
afterAll(async () => {
  await db?.close();
});
describe("PostgreSQL booking and authorization", () => {
  it("maintenance is inaccessible to browser roles", async () => {
    await as(customer);
    await expect(call("select private.maintenance()")).rejects.toThrow(
      /permission denied/,
    );
  });
  it("anonymous callers cannot create booking or read private profiles", async () => {
    await as(null, "anon");
    await expect(create()).rejects.toThrow(/permission denied/);
    await expect(call("select * from public.profiles")).rejects.toThrow(
      /permission denied/,
    );
  });
  it("validates offered hours, future date, and service area on server", async () => {
    await as(customer);
    await expect(create("2000-01-01T03:17:00+07:00")).rejects.toThrow(
      /Khung giờ/,
    );
    await expect(create(`${day}T03:17:00+07:00`)).rejects.toThrow(/Khung giờ/);
    await expect(
      call(
        "select public.create_booking($1,$2,'Valid name','0901234567','Hà Nội','Một địa chỉ đủ dài','',$3)",
        [pkg, start, crypto.randomUUID()],
      ),
    ).rejects.toThrow(/Thông tin/);
  });
  it("creates immutable price snapshot and never marks client payment paid", async () => {
    await as(customer);
    booking = (await create(start, key))[0].id;
    const [b] = await call("select * from public.bookings where id=$1", [
      booking,
    ]);
    expect(b.price).toBe(1200000);
    expect(b.deposit).toBe(360000);
    expect(b.status).toBe("REQUESTED");
    expect(b.payment_status).toBe("UNPAID");
    expect(b.snapshot.package.name).toBe("Gói 2 giờ");
  });
  it("retrying the same request returns the original booking", async () => {
    await as(customer);
    expect((await create(start, key))[0].id).toBe(booking);
    expect((await call("select * from public.bookings")).length).toBe(1);
  });
  it("rejects a second booking that starts inside the 2-hour interval", async () => {
    await as(other);
    await expect(create(`${day}T09:30:00+07:00`)).rejects.toThrow(/Khung giờ/);
    expect(await call("select * from public.bookings")).toHaveLength(0);
  });
  it("database exclusion constraint also blocks overlapping privileged writes", async () => {
    await as(admin);
    await db.exec("reset role");
    await expect(
      call(
        `insert into public.bookings(customer_id,provider_id,package_id,request_key,snapshot,customer_name,phone,district,address,starts_at,ends_at,price,deposit) select $1,provider_id,package_id,gen_random_uuid(),snapshot,customer_name,phone,district,address,starts_at+interval '30 minutes',ends_at+interval '30 minutes',price,deposit from public.bookings where id=$2`,
        [other, booking],
      ),
    ).rejects.toThrow(/exclusion constraint/);
  });
  it("foreign customers cannot act on another booking or read its events", async () => {
    await as(other);
    await expect(
      call("select public.booking_action($1,'ACCEPT','')", [booking]),
    ).rejects.toThrow(/không có quyền/);
    expect(
      await call("select * from public.booking_events where booking_id=$1", [
        booking,
      ]),
    ).toHaveLength(0);
  });
  it("direct mutations and self-promotion to admin are denied", async () => {
    await as(customer);
    await expect(
      call("update public.profiles set role='ADMIN' where id=$1", [customer]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      call("update public.bookings set payment_status='PAID' where id=$1", [
        booking,
      ]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      call("select public.moderate_provider($1,'APPROVED','Approve fake')", [
        provider,
      ]),
    ).rejects.toThrow(/Không có quyền/);
  });
  it("creator cannot accept a booking before adding a payout account", async () => {
    await db.exec("reset role");
    await call("delete from public.provider_payout_accounts where provider_id=$1", [
      provider,
    ]);
    await as(owner);
    await expect(
      call("select public.booking_action($1,'ACCEPT','')", [booking]),
    ).rejects.toThrow(/cập nhật thông tin nhận cọc/);
    await call(
      "insert into public.provider_payout_accounts(provider_id,bank_bin,bank_name,account_number,account_name) values($1,'970436','Vietcombank','123456789','TEST CREATOR')",
      [provider],
    );
  });
  it("creator acceptance does not set payment paid", async () => {
    await as(owner);
    await call("select public.booking_action($1,'ACCEPT','')", [booking]);
    const [b] = await call("select * from public.bookings where id=$1", [
      booking,
    ]);
    expect(b.status).toBe("AWAITING_DEPOSIT");
    expect(b.payment_status).toBe("UNPAID");
  });
  it("customers cannot read payout rows or get payee data before deposit is due", async () => {
    await as(customer);
    expect(await call("select * from public.provider_payout_accounts")).toHaveLength(0);
    await expect(
      call("select * from public.get_deposit_payee($1)", [booking]),
    ).rejects.toThrow(/chưa đến bước đặt cọc/);
  });
  it("get_deposit_payee returns bank details only to booking parties", async () => {
    await as(customer);
    await call("select public.booking_action($1,'ACCEPT','')", [booking]);
    const [payee] = await call("select * from public.get_deposit_payee($1)", [
      booking,
    ]);
    expect(payee).toEqual({
      bank_bin: "970436",
      bank_name: "Vietcombank",
      account_number: "123456789",
      account_name: "TEST CREATOR",
    });
    await as(other);
    await expect(
      call("select * from public.get_deposit_payee($1)", [booking]),
    ).rejects.toThrow(/không có quyền/);
    await as(owner);
    expect(await call("select * from public.get_deposit_payee($1)", [booking]))
      .toEqual([payee]);
    await as(admin);
    expect(await call("select * from public.get_deposit_payee($1)", [booking]))
      .toEqual([payee]);
  });
  it("a creator cannot confirm another creator's booking", async () => {
    await db.exec("reset role");
    const [{ id: otherProvider }] = await call<{ id: string }>(
      "insert into public.providers(owner_id,slug,name,category) values($1,'other-studio','Other Studio','Photographer') returning id",
      [other],
    );
    const [{ id: otherBooking }] = await call<{ id: string }>(
      `insert into public.bookings(
        customer_id,provider_id,package_id,request_key,snapshot,customer_name,phone,
        district,address,starts_at,ends_at,price,deposit,status,payment_status
      ) select customer_id,$2,package_id,gen_random_uuid(),snapshot,customer_name,phone,
        district,address,starts_at,ends_at,price,deposit,'PAYMENT_REVIEW','REPORTED'
        from public.bookings where id=$1 returning id`,
      [booking, otherProvider],
    );
    await as(owner);
    await expect(
      call("select public.booking_action($1,'VERIFY_PAYMENT','')", [
        otherBooking,
      ]),
    ).rejects.toThrow(/không có quyền/);
  });
  it("creator can confirm a reported transfer and not-received requires a reason", async () => {
    await as(customer);
    const id = await createAwaiting(`${day}T12:00:00+07:00`);
    await as(customer);
    await call(
      "select public.booking_action($1,'REPORT_PAYMENT','', 'TX123456')",
      [id],
    );
    const [reported] = await call(
      "select status,transfer_note from public.bookings where id=$1",
      [id],
    );
    expect(reported).toEqual({
      status: "PAYMENT_REVIEW",
      transfer_note: "TX123456",
    });
    expect(await call("select * from public.get_deposit_payee($1)", [id]))
      .toHaveLength(1);
    await as(owner);
    await call("select public.booking_action($1,'VERIFY_PAYMENT','')", [
      id,
    ]);
    const [confirmed] = await call(
      "select status,payment_status from public.bookings where id=$1",
      [id],
    );
    expect(confirmed).toEqual({ status: "CONFIRMED", payment_status: "PAID" });
    await expect(
      call("select public.booking_action($1,'PAYMENT_NOT_RECEIVED','')", [
        id,
      ]),
    ).rejects.toThrow(/Thao tác/);
  });
  it("creator can return a reported transfer to awaiting deposit with a reason", async () => {
    await as(customer);
    const nextDay = await addPayOSAvailability(1);
    const id = await createAwaiting(`${nextDay}T09:00:00+07:00`);
    await as(customer);
    await call("select public.booking_action($1,'REPORT_PAYMENT','')", [id]);
    await as(owner);
    await call(
      "select public.booking_action($1,'PAYMENT_NOT_RECEIVED','Chưa thấy tiền vào tài khoản')",
      [id],
    );
    const [b] = await call(
      "select status,payment_status,transfer_note from public.bookings where id=$1",
      [id],
    );
    expect(b).toEqual({
      status: "AWAITING_DEPOSIT",
      payment_status: "UNPAID",
      transfer_note: null,
    });
    await expect(
      call("select public.booking_action($1,'PAYMENT_NOT_RECEIVED',$2)", [
        id,
        "x".repeat(201),
      ]),
    ).rejects.toThrow(/tối đa 200/);
  });
  it("admin can override a reported transfer", async () => {
    await as(customer);
    const nextDay = await addPayOSAvailability(2);
    const id = await createAwaiting(`${nextDay}T09:00:00+07:00`);
    await as(customer);
    await call("select public.booking_action($1,'REPORT_PAYMENT','')", [id]);
    await as(admin);
    await call("select public.booking_action($1,'VERIFY_PAYMENT','')", [id]);
    const [b] = await call(
      "select status,payment_status from public.bookings where id=$1",
      [id],
    );
    expect(b).toEqual({ status: "CONFIRMED", payment_status: "PAID" });
  });
  it("a creator cannot complete early or invent statuses", async () => {
    await as(owner);
    await expect(
      call("select public.booking_action($1,'ARBITRARY','')", [booking]),
    ).rejects.toThrow(/Thao tác/);
  });
  it("customer reports transfer; admin can still override the creator", async () => {
    await as(customer);
    await call(
      "select public.booking_action($1,'REPORT_PAYMENT','Bank ref 123456')",
      [booking],
    );
    let [b] = await call("select * from public.bookings where id=$1", [
      booking,
    ]);
    expect(b.payment_status).toBe("REPORTED");
    await as(admin);
    await call(
      "select public.booking_action($1,'VERIFY_PAYMENT','Bank verified 123456')",
      [booking],
    );
    [b] = await call("select * from public.bookings where id=$1", [booking]);
    expect(b.status).toBe("CONFIRMED");
    expect(b.payment_status).toBe("PAID");
  });
  it("cannot complete before service end or review incomplete service", async () => {
    await as(owner);
    await expect(
      call("select public.booking_action($1,'COMPLETE','')", [booking]),
    ).rejects.toThrow(/Thao tác/);
    await as(customer);
    await expect(
      call("select public.submit_review($1,5,5,5,5,'Một đánh giá kiểm thử')", [
        booking,
      ]),
    ).rejects.toThrow(/hoàn thành/);
  });
  it("package edits cannot change the booking snapshot", async () => {
    await as(owner);
    await call(
      "select public.save_package($1,'Gói sửa','Personal','Nội dung đã thay đổi',60,2000000,3,'Ảnh khác','',true)",
      [pkg],
    );
    const [b] = await call("select * from public.bookings where id=$1", [
      booking,
    ]);
    expect(b.price).toBe(1200000);
    expect(b.snapshot.package.duration).toBe(120);
  });
  it("admin cannot record a BeautyHub refund for a direct creator deposit", async () => {
    await as(customer);
    const [{ id }] = await call<{ id: string }>(
      "select public.request_support($1,'CANCEL','Xin hỗ trợ hòa giải việc hủy booking') id",
      [booking],
    );
    await as(admin);
    await expect(
      call(
        "select public.resolve_support($1,'Hai bên tự thỏa thuận chuyển trả trực tiếp',true,360000)",
        [id],
      ),
    ).rejects.toThrow(/không hoàn cọc chuyển trực tiếp/);
  });
  it("support cancellation enters refund queue, then records actual refund", async () => {
    await db.exec("reset role");
    await call(
      "insert into public.payment_links(booking_id,payos_order_code,amount,status,expires_at) values($1,123456789,$2,'PAID',now()+interval '1 day')",
      [booking, 360000],
    );
    await as(customer);
    const [{ id }] = await call<{ id: string }>(
      "select public.request_support($1,'CANCEL','Xin hủy và hoàn cọc theo chính sách') id",
      [booking],
    );
    await as(admin);
    await call(
      "select public.resolve_support($1,'Đã thống nhất hủy và hoàn toàn bộ cọc',true,360000)",
      [id],
    );
    let [b] = await call("select * from public.bookings where id=$1", [
      booking,
    ]);
    expect(b.status).toBe("CANCELLED");
    expect(b.payment_status).toBe("REFUND_PENDING");
    await call("select public.confirm_refund($1,'Refund bank 654321')", [
      booking,
    ]);
    [b] = await call("select * from public.bookings where id=$1", [booking]);
    expect(b.payment_status).toBe("REFUNDED");
    expect(
      (await call("select * from public.audit_log")).length,
    ).toBeGreaterThanOrEqual(3);
  });
  it("cancellation releases the interval for a new booking", async () => {
    await as(other);
    const [r] = await create();
    expect(r.id).not.toBe(booking);
  });
  it("a second support request cannot overwrite or duplicate a refund", async () => {
    await as(customer);
    const [{ id }] = await call<{ id: string }>(
      "select public.request_support($1,'CANCEL','Yêu cầu hủy được gửi lần thứ hai') id",
      [booking],
    );
    await as(admin);
    await expect(
      call(
        "select public.resolve_support($1,'Thử ghi đè giao dịch đã hoàn',true,0)",
        [id],
      ),
    ).rejects.toThrow(/Không được ghi đè/);
    await expect(
      call("select public.confirm_refund($1,'Duplicate refund 123456')", [
        booking,
      ]),
    ).rejects.toThrow(/Không có khoản hoàn/);
    expect(
      (
        await call("select refund_amount from public.bookings where id=$1", [
          booking,
        ])
      )[0].refund_amount,
    ).toBe(360000);
  });
  it("auth metadata cannot grant administrative access", async () => {
    await db.exec("reset role");
    const id = crypto.randomUUID();
    await call(
      'insert into auth.users(id,raw_user_meta_data) values($1,\'{"role":"ADMIN","full_name":"New user"}\')',
      [id],
    );
    await as(id);
    expect(
      (await call("select role from public.profiles where id=$1", [id]))[0]
        .role,
    ).toBe("CUSTOMER");
    await expect(call("select public.admin_metrics()")).rejects.toThrow(
      /Không có quyền/,
    );
  });
  it("package details are bounded and only the owner can save them", async () => {
    const save = `select public.save_package_details(
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb
    ) id`;
    const values = [
      pkg,
      "Gói 2 giờ",
      "Personal",
      "Mô tả gói kiểm thử",
      120,
      1200000,
      7,
      "20 ảnh chỉnh",
      "Studio trả riêng",
      true,
      50,
      12,
      2,
      JSON.stringify(["Tư vấn concept", "Trang phục"]),
      JSON.stringify(["Hướng dẫn tạo dáng"]),
    ];

    await as(owner);
    await call(save, values);
    const [saved] = await call(
      "select original_photo_count,edited_photo_count,revision_count,included_items,customer_benefits from public.packages where id=$1",
      [pkg],
    );
    expect(saved).toMatchObject({
      original_photo_count: 50,
      edited_photo_count: 12,
      revision_count: 2,
      included_items: ["Tư vấn concept", "Trang phục"],
      customer_benefits: ["Hướng dẫn tạo dáng"],
    });
    await expect(
      call(save, [...values.slice(0, 10), -1, ...values.slice(11)]),
    ).rejects.toThrow(/Số ảnh gốc/);
    await expect(
      call(save, [
        ...values.slice(0, 13),
        JSON.stringify(["x".repeat(201)]),
        values[14],
      ]),
    ).rejects.toThrow(/200 ký tự/);

    await as(other);
    await call(
      "select public.save_provider('other-studio','Other Studio','Photographer','Hồ sơ kiểm thử creator khác',array['Quận 1'],array['Natural','Korean'])",
    );
    await expect(call(save, values)).rejects.toThrow(/Không có quyền sửa gói này/);

    await db.exec("reset role");
    await expect(
      call("update public.packages set original_photo_count=-1 where id=$1", [
        pkg,
      ]),
    ).rejects.toThrow(/packages_original_photo_count_check/);
    await expect(
      call(
        "update public.packages set included_items=$1::jsonb where id=$2",
        [JSON.stringify(Array.from({ length: 21 }, (_, index) => `Mục ${index}`)), pkg],
      ),
    ).rejects.toThrow(/packages_included_items_check/);
  });
  it("accepts anniversary packages and rejects unknown package needs", async () => {
    await as(owner);
    await call(
      "select public.save_package(null,'Gói kỷ niệm','anniversary','Gói dành cho ngày kỷ niệm',60,1200000,7,'Tư vấn concept','',true)",
    );
    const [saved] = await call<{ service: string }>(
      "select service from public.packages where name='Gói kỷ niệm'",
    );
    expect(saved.service).toBe("anniversary");
    await expect(
      call(
        "select public.save_package(null,'Gói không hợp lệ','unknown','Mô tả gói không hợp lệ',60,1200000,7,'','',true)",
      ),
    ).rejects.toThrow(/packages_service_check/);
  });
  it("reserves a payOS link only for service role and exposes it only to its customer", async () => {
    const payosDay = await addPayOSAvailability(1);
    const id = await createAwaiting(`${payosDay}T09:00:00+07:00`);
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await as(null, "authenticated");
    await expect(
      call("select * from public.reserve_payos_payment_link($1,$2)", [
        id,
        expires,
      ]),
    ).rejects.toThrow(/permission denied/);

    await as(null, "service_role");
    const [link] = await call<{
      id: string;
      payos_order_code: number;
      amount: number;
    }>("select * from public.reserve_payos_payment_link($1,$2)", [id, expires]);
    expect(link.amount).toBe(360000);
    await call(
      "update public.payment_links set payment_link_id='pl-test',checkout_url='https://payos.example/checkout',qr_code='qr' where id=$1",
      [link.id],
    );
    const [retry] = await call(
      "select * from public.reserve_payos_payment_link($1,$2)",
      [id, expires],
    );
    expect(retry.id).toBe(link.id);

    await as(customer);
    expect(
      await call("select * from public.payment_links where booking_id=$1", [
        id,
      ]),
    ).toHaveLength(1);
    await expect(
      call("insert into public.payment_links(booking_id,payos_order_code,amount,expires_at) values($1,999999999,1,$2)", [id, expires]),
    ).rejects.toThrow(/permission denied/);
    expect(await call("select * from public.payment_events")).toHaveLength(0);
    await as(other);
    expect(await call("select * from public.payment_links")).toHaveLength(0);
  });
  it("confirms a sufficient payOS deposit once and ignores a duplicate event", async () => {
    const payosDay = await addPayOSAvailability(2);
    const id = await createAwaiting(`${payosDay}T09:00:00+07:00`);
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await as(null, "service_role");
    const [link] = await call<{ payos_order_code: number }>(
      "select * from public.reserve_payos_payment_link($1,$2)",
      [id, expires],
    );
    const process = `select public.process_payos_payment(
      $1,$2,360000,'{"code":"00"}'::jsonb,true
    ) result`;
    expect(
      (await call<{ result: { result: string } }>(process, [
        "tx-confirm",
        link.payos_order_code,
      ]))[0].result.result,
    ).toBe("CONFIRMED");
    expect(
      (await call<{ result: { result: string } }>(process, [
        "tx-confirm",
        link.payos_order_code,
      ]))[0].result.result,
    ).toBe("DUPLICATE");
    await as(admin);
    const [bookingRow] = await call(
      "select status,payment_status from public.bookings where id=$1",
      [id],
    );
    expect(bookingRow).toMatchObject({
      status: "CONFIRMED",
      payment_status: "PAID",
    });
    expect(
      await call("select * from public.payment_events where id='tx-confirm'"),
    ).toHaveLength(1);
    expect(
      (
        await call<{ duplicate_count: number }>(
          "select duplicate_count from public.payment_events where id='tx-confirm'",
        )
      )[0].duplicate_count,
    ).toBe(1);
  });
  it("routes an underpaid deposit and a cancelled booking to review without confirmation", async () => {
    const payosDay = await addPayOSAvailability(3);
    const underpaidId = await createAwaiting(
      `${payosDay}T09:00:00+07:00`,
      other,
    );
    const cancelledId = await createAwaiting(
      `${payosDay}T11:00:00+07:00`,
      other,
    );
    const expiredId = await createAwaiting(
      `${payosDay}T13:00:00+07:00`,
      other,
    );
    const cancelledLinkId = await createAwaiting(
      `${payosDay}T15:00:00+07:00`,
      other,
    );
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await as(null, "service_role");
    const [underpaid] = await call<{ payos_order_code: number }>(
      "select * from public.reserve_payos_payment_link($1,$2)",
      [underpaidId, expires],
    );
    const [cancelled] = await call<{ payos_order_code: number }>(
      "select * from public.reserve_payos_payment_link($1,$2)",
      [cancelledId, expires],
    );
    const [expired] = await call<{ payos_order_code: number; id: string }>(
      "select * from public.reserve_payos_payment_link($1,$2)",
      [expiredId, expires],
    );
    const [cancelledLink] = await call<{ payos_order_code: number; id: string }>(
      "select * from public.reserve_payos_payment_link($1,$2)",
      [cancelledLinkId, expires],
    );
    await call(
      "update public.payment_links set expires_at=now()-interval '1 minute' where id=$1",
      [expired.id],
    );
    await call("update public.payment_links set status='CANCELLED' where id=$1", [
      cancelledLink.id,
    ]);
    await as(other);
    await call("select public.booking_action($1,'CANCEL','')", [cancelledId]);
    await as(null, "service_role");
    const process = `select public.process_payos_payment(
      $1,$2,$3,'{}'::jsonb,true
    ) result`;
    const [shortPayment] = await call<{ result: { result: string } }>(process, [
      "tx-underpaid",
      underpaid.payos_order_code,
      100000,
    ]);
    expect(shortPayment.result.result).toBe("UNDERPAID_REVIEW");
    const [latePayment] = await call<{ result: { result: string } }>(process, [
      "tx-cancelled",
      cancelled.payos_order_code,
      360000,
    ]);
    expect(latePayment.result.result).toBe("BOOKING_NOT_AWAITING_DEPOSIT");
    const [expiredPayment] = await call<{ result: { result: string } }>(
      process,
      ["tx-expired", expired.payos_order_code, 360000],
    );
    expect(expiredPayment.result.result).toBe("EXPIRED_REVIEW");
    const [cancelledLinkPayment] = await call<{ result: { result: string } }>(
      process,
      ["tx-cancelled-link", cancelledLink.payos_order_code, 360000],
    );
    expect(cancelledLinkPayment.result.result).toBe("EXPIRED_REVIEW");
    await as(admin);
    const [review] = await call(
      "select status,payment_status from public.bookings where id=$1",
      [underpaidId],
    );
    expect(review).toMatchObject({
      status: "PAYMENT_REVIEW",
      payment_status: "REPORTED",
    });
    await as(customer);
    await expect(
      call("select public.process_payos_payment('client',1,1,'{}'::jsonb,true)"),
    ).rejects.toThrow(/permission denied/);
    await as(admin);
    expect(
      await call(
        "select * from public.payment_events where id in ('tx-underpaid','tx-cancelled','tx-expired','tx-cancelled-link')",
      ),
    ).toHaveLength(4);
    const [cancelledLinkBooking] = await call(
      "select status,payment_status from public.bookings where id=$1",
      [cancelledLinkId],
    );
    expect(cancelledLinkBooking).toMatchObject({
      status: "PAYMENT_REVIEW",
      payment_status: "REPORTED",
    });
  });
  it("private portfolio originals are invisible before approval and cannot be uploaded as another creator", async () => {
    const path = owner + "/test.webp";
    await as(owner);
    await call(
      "insert into storage.objects(bucket_id,name) values('portfolio',$1)",
      [path],
    );
    await call("select public.add_portfolio($1,'Tác phẩm có quyền sử dụng')", [
      path,
    ]);
    await as(other);
    expect(
      await call("select * from storage.objects where name=$1", [path]),
    ).toHaveLength(0);
    await expect(
      call(
        "insert into storage.objects(bucket_id,name) values('portfolio',$1)",
        [owner + "/foreign.webp"],
      ),
    ).rejects.toThrow(/row-level security/);
    await as(null, "anon");
    expect(
      await call("select * from storage.objects where name=$1", [path]),
    ).toHaveLength(0);
    await db.exec("reset role");
    await call(
      "update public.portfolio_assets set approved=true where path=$1",
      [path],
    );
    await as(null, "anon");
    expect(
      await call("select * from storage.objects where name=$1", [path]),
    ).toHaveLength(1);
  });
  it("expired holds are released transactionally before a new request", async () => {
    await db.exec("reset role");
    await db.query(
      "update public.bookings set hold_until=now()-interval '1 minute' where customer_id=$1",
      [other],
    );
    await as(customer);
    const [r] = await create();
    expect(r.id).not.toBe(booking);
  });
  it("only completed booking owner can review, with score constraints", async () => {
    await db.exec("reset role");
    await db.query(
      "update public.bookings set status='COMPLETED' where id=$1",
      [booking],
    );
    await as(other);
    await expect(
      call(
        "select public.submit_review($1,5,5,5,5,'Một đánh giá của người khác')",
        [booking],
      ),
    ).rejects.toThrow(/Chỉ khách/);
    await as(customer);
    await expect(
      call(
        "select public.submit_review($1,9,5,5,5,'Điểm đánh giá không hợp lệ')",
        [booking],
      ),
    ).rejects.toThrow(/check constraint/);
    await call(
      "select public.submit_review($1,5,4,5,4,'Trải nghiệm tốt, creator đúng giờ.')",
      [booking],
    );
    await expect(
      call("select public.submit_review($1,5,5,5,5,'Đánh giá lần thứ hai')", [
        booking,
      ]),
    ).rejects.toThrow(/unique constraint/);
  });
  it("authenticated analytics deduplicate without collecting form data", async () => {
    await as(customer);
    await call("select public.track_event('search')");
    await call("select public.track_event('search')");
    await as(admin);
    const rows = await call(
      "select * from public.analytics_events where event='search'",
    );
    expect(rows).toHaveLength(1);
    await as(other);
    expect(await call("select * from public.analytics_events")).toHaveLength(0);
  });
  it("maintenance expires holds and sends each upcoming reminder once", async () => {
    await db.exec("reset role");
    await db.exec(
      "update public.bookings set status='CANCELLED' where status='REQUESTED'",
    );
    await db.query(
      "update public.bookings set status='CONFIRMED',starts_at=now()+interval '4 hours',ends_at=now()+interval '6 hours' where id=$1",
      [booking],
    );
    await call("select private.maintenance()");
    await call("select private.maintenance()");
    expect(
      await call(
        "select * from public.notifications where booking_id=$1 and text='UPCOMING'",
        [booking],
      ),
    ).toHaveLength(2);
    await db.query(
      "update public.bookings set status='AWAITING_DEPOSIT',hold_until=now()-interval '1 minute' where id=$1",
      [booking],
    );
    await call("select private.maintenance()");
    expect(
      (
        await call("select status from public.bookings where id=$1", [booking])
      )[0].status,
    ).toBe("EXPIRED");
  });
});
