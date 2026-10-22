import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ClipboardList,
  Clock,
  FileText,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { client, rpc } from "./api";
import { useApp } from "./context";
import {
  dateTime,
  errorText,
  money,
  type Booking,
  type Profile,
  type Support,
} from "./domain";
import { Alert, Badge, Empty, Field, Modal } from "./ui";
import { BookingCard } from "./Bookings";
const PAGE_SIZE = 25;
type AdminList =
  | "bookings"
  | "reviews"
  | "refunds"
  | "overdue"
  | "tickets"
  | "users"
  | "audit";
type Audit = { id: string; action: string; detail: string; created_at: string };

function listQuery(list: AdminList) {
  const table =
    list === "tickets"
      ? "support_requests"
      : list === "users"
        ? "profiles"
        : list === "audit"
          ? "audit_log"
          : "bookings";
  let query = client().from(table).select("*", { count: "exact" });
  if (list === "reviews") query = query.eq("status", "PAYMENT_REVIEW");
  if (list === "refunds") query = query.eq("payment_status", "REFUND_PENDING");
  if (list === "overdue")
    query = query
      .in("status", ["REQUESTED", "AWAITING_DEPOSIT"])
      .lte("hold_until", new Date().toISOString());
  if (list === "tickets") query = query.eq("status", "OPEN");
  if (list !== "users") query = query.order("created_at", { ascending: false });
  return query.order("id", { ascending: false });
}

function useAdminPage<T>(list: AdminList) {
  const [position, setPosition] = useState({ list, page: 1 });
  const page = position.list === list ? position.page : 1;
  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const request = useRef(0);
  const load = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    setError("");
    try {
      const from = (page - 1) * PAGE_SIZE;
      let result = await listQuery(list).range(from, from + PAGE_SIZE - 1);
      if (id !== request.current) return;
      // Trang cuối có thể trả về 416 sau khi dữ liệu bị xóa hoặc đổi trạng thái.
      if (result.error?.code === "PGRST103") {
        result = await listQuery(list).range(0, 0);
        if (id !== request.current) return;
        if (result.error) throw result.error;
        setTotal(result.count ?? 0);
        setPosition({
          list,
          page: Math.max(1, Math.ceil((result.count ?? 0) / PAGE_SIZE)),
        });
        return;
      }
      if (result.error) throw result.error;
      const count = result.count ?? 0;
      const lastPage = Math.max(1, Math.ceil(count / PAGE_SIZE));
      setTotal(count);
      if (page > lastPage) {
        setPosition({ list, page: lastPage });
        return;
      }
      setData((result.data || []) as T[]);
    } catch (e) {
      if (id === request.current) {
        setData([]);
        setError(errorText(e));
      }
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [list, page]);
  useEffect(() => {
    void load();
    return () => {
      request.current++;
    };
  }, [load]);
  function changePage(next: number) {
    if (loading) return;
    setLoading(true);
    setPosition({ list, page: next });
  }
  return { data, total, page, loading, error, load, changePage };
}

type PageState = Omit<ReturnType<typeof useAdminPage>, "data">;
function PageList({
  state,
  label,
  busy,
  children,
}: {
  state: PageState;
  label: string;
  busy: boolean;
  children: ReactNode;
}) {
  const pages = Math.max(1, Math.ceil(state.total / PAGE_SIZE));
  return (
    <div aria-busy={state.loading}>
      <div aria-live="polite" role="status">
        {state.loading ? (
          <p className="muted">Đang tải {label}…</p>
        ) : (
          !state.error && (
            <p className="muted">
              Trang {state.page}/{pages} · tổng {state.total}
            </p>
          )
        )}
      </div>
      {state.error && (
        <Alert>
          Không tải được {label}: {state.error}
        </Alert>
      )}
      {!state.loading &&
        !state.error &&
        (state.total ? children : <p className="muted">Không có dữ liệu.</p>)}
      <nav className="section-title" aria-label={`Phân trang ${label}`}>
        <button
          type="button"
          className="btn small ghost"
          aria-label={`Trang trước: ${label}`}
          disabled={busy || state.loading || state.page <= 1}
          onClick={() => state.changePage(state.page - 1)}
        >
          Trước
        </button>
        {state.error && (
          <button
            type="button"
            className="btn small ghost"
            aria-label={`Tải lại ${label}`}
            disabled={busy || state.loading}
            onClick={() => void state.load()}
          >
            Thử lại
          </button>
        )}
        <button
          type="button"
          className="btn small ghost"
          aria-label={`Trang sau: ${label}`}
          disabled={
            busy || state.loading || Boolean(state.error) || state.page >= pages
          }
          onClick={() => state.changePage(state.page + 1)}
        >
          Sau
        </button>
      </nav>
    </div>
  );
}

function ProviderContact({ ownerId }: { ownerId: string }) {
  const [phone, setPhone] = useState("Đang tải…");
  useEffect(() => {
    let active = true;
    setPhone("Đang tải…");
    void (async () => {
      try {
        const { data, error } = await client()
          .from("profiles")
          .select("phone")
          .eq("id", ownerId)
          .single();
        if (error) throw error;
        if (active) setPhone(data?.phone || "Chưa cập nhật");
      } catch (e) {
        if (active) setPhone(`Không tải được liên hệ: ${errorText(e)}`);
      }
    })();
    return () => {
      active = false;
    };
  }, [ownerId]);
  return <p aria-live="polite">Liên hệ: {phone}</p>;
}

export function Admin() {
  const { providers, settings, refresh, toast } = useApp();
  const bookingPage = useAdminPage<Booking>("bookings");
  const reviewPage = useAdminPage<Booking>("reviews");
  const refundPage = useAdminPage<Booking>("refunds");
  const overduePage = useAdminPage<Booking>("overdue");
  const ticketPage = useAdminPage<Support>("tickets");
  const userPage = useAdminPage<Profile>("users");
  const auditPage = useAdminPage<Audit>("audit");
  const bookings = bookingPage.data,
    tickets = ticketPage.data,
    users = userPage.data,
    audit = auditPage.data;
  const [resolveBooking, setResolveBooking] = useState<Booking | null>(null);
  const [resolveLoading, setResolveLoading] = useState(false);
  const [resolveError, setResolveError] = useState("");
  const [tab, setTab] = useState("queue"),
    [metrics, setMetrics] = useState<{
      users: number;
      active_providers: number;
      requests: number;
      paid: number;
      completed: number;
      gmv: number;
      cancellation_rate: number;
      funnel: Record<string, number>;
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [resolve, setResolve] = useState<Support | null>(null);
  const loadMetrics = useCallback(async () => {
    try {
      setMetrics(await rpc("admin_metrics"));
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);
  useEffect(() => {
    let active = true;
    setResolveBooking(null);
    setResolveError("");
    if (!resolve) {
      setResolveLoading(false);
      return;
    }
    setResolveLoading(true);
    void (async () => {
      try {
        const { data, error } = await client()
          .from("bookings")
          .select("*")
          .eq("id", resolve.booking_id)
          .single();
        if (error) throw error;
        if (active) setResolveBooking(data as Booking);
      } catch (e) {
        if (active) setResolveError(errorText(e));
      } finally {
        if (active) setResolveLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [resolve]);
  async function load() {
    await Promise.all([
      bookingPage.load(),
      reviewPage.load(),
      refundPage.load(),
      overduePage.load(),
      ticketPage.load(),
      userPage.load(),
      auditPage.load(),
      loadMetrics(),
    ]);
  }
  async function run(fn?: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn?.();
      await refresh();
      await load();
      if (fn) toast("Đã lưu thao tác và lịch sử xử lý.");
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  const tabs = [
    ["queue", "Cần xử lý", ClipboardList],
    ["providers", "Xác minh creator", ShieldCheck],
    ["bookings", "Tất cả booking", Wallet],
    ["users", "Người dùng", Users],
    ["audit", "Lịch sử thao tác", FileText],
    ["settings", "Cấu hình mở beta", Settings],
  ] as const;
  const reviews = reviewPage.data,
    overdue = overduePage.data,
    refunds = refundPage.data;
  const loading = [
    bookingPage,
    reviewPage,
    refundPage,
    overduePage,
    ticketPage,
    userPage,
    auditPage,
  ].some((p) => p.loading);
  return (
    <div className="workspace">
      <aside className="workspace-sidebar dark">
        <span className="eyebrow">BEAUTYHUB OPS</span>
        <h2>Vận hành</h2>
        <nav>
          {tabs.map(([k, t, Icon]) => (
            <button
              key={k}
              className={tab === k ? "active" : ""}
              onClick={() => setTab(k)}
            >
              <Icon size={17} />
              {t}
            </button>
          ))}
        </nav>
        <Link to="/account">Tài khoản →</Link>
      </aside>
      <div className="workspace-main">
        <span className="eyebrow">PRIVATE BETA / OPERATIONS</span>
        <div className="page-heading">
          <div>
            <h1>{tabs.find((t) => t[0] === tab)?.[1]}</h1>
            <p className="muted">
              Mỗi việc được xử lý là một khách hàng bớt phải chờ.
            </p>
          </div>
          <button
            className="btn ghost"
            disabled={busy || loading}
            aria-label="Làm mới dữ liệu quản trị"
            onClick={() => void run()}
          >
            Làm mới
          </button>
        </div>
        {error && <Alert>{error}</Alert>}
        {!settings?.ready && (
          <div className="info-banner">
            Booking đang đóng. Hoàn tất thông tin vận hành trong Cấu hình mở
            beta trước khi mở nhận lịch.
          </div>
        )}
        {tab === "queue" && (
          <>
            <div className="metrics">
              {[
                [
                  "Chờ đối soát",
                  reviewPage.loading || reviewPage.error
                    ? "—"
                    : reviewPage.total,
                ],
                [
                  "Hỗ trợ đang mở",
                  ticketPage.loading || ticketPage.error
                    ? "—"
                    : ticketPage.total,
                ],
                [
                  "Hồ sơ chờ duyệt",
                  providers.filter((p) => p.status === "PENDING").length,
                ],
                [
                  "Cần hoàn tiền",
                  refundPage.loading || refundPage.error
                    ? "—"
                    : refundPage.total,
                ],
              ].map(([t, n]) => (
                <div className="metric" key={t}>
                  <small>{t}</small>
                  <strong>{n}</strong>
                </div>
              ))}
            </div>
            <section className="panel">
              <h2>Tiền cọc cần đối soát</h2>
              <p>
                Kiểm tra tiền thực nhận tại ngân hàng trước khi xác nhận. Mở
                booking để ghi mã giao dịch.
              </p>
              <PageList
                state={reviewPage}
                label="tiền cọc cần đối soát"
                busy={busy}
              >
                {reviews.length ? (
                  reviews.map((b) => <BookingCard b={b} key={b.id} />)
                ) : (
                  <p className="muted">Không có giao dịch chờ đối soát.</p>
                )}
              </PageList>
            </section>
            <section className="panel">
              <h2>Yêu cầu hỗ trợ / đổi lịch / hủy</h2>
              <PageList
                state={ticketPage}
                label="yêu cầu hỗ trợ đang mở"
                busy={busy}
              >
                {tickets.map((t) => (
                  <div className="list-row" key={t.id}>
                    <div>
                      <span className="eyebrow">
                        {t.kind} · {dateTime(t.created_at)}
                      </span>
                      <p>{t.message}</p>
                      <Link to={`/bookings/${t.booking_id}`}>
                        Xem booking →
                      </Link>
                    </div>
                    <button
                      className="btn small"
                      disabled={busy}
                      aria-label={`Xử lý yêu cầu hỗ trợ ${t.id}`}
                      onClick={() => {
                        setResolveBooking(null);
                        setResolveLoading(true);
                        setResolve(t);
                      }}
                    >
                      Xử lý
                    </button>
                  </div>
                ))}
                {!tickets.some((t) => t.status === "OPEN") && (
                  <p className="muted">Không có yêu cầu đang mở.</p>
                )}
              </PageList>
            </section>
            <section className="panel">
              <h2>Khoản hoàn tiền cần thực hiện</h2>
              <PageList state={refundPage} label="khoản hoàn tiền" busy={busy}>
                {refunds.map((b) => (
                  <BookingCard b={b} key={b.id} />
                ))}
                {!refunds.length && (
                  <p className="muted">Không có khoản hoàn đang chờ.</p>
                )}
              </PageList>
            </section>
            <section className="panel">
              <h2>Đã quá hạn phản hồi / đặt cọc</h2>
              <PageList state={overduePage} label="booking quá hạn" busy={busy}>
                {overdue.map((b) => (
                  <BookingCard b={b} key={b.id} />
                ))}
                {!overdue.length && (
                  <p className="muted">Không có booking quá hạn.</p>
                )}
              </PageList>
            </section>
          </>
        )}
        {tab === "providers" && (
          <div>
            {providers.map((p) => (
              <section className="panel" key={p.id}>
                <div className="section-title">
                  <div>
                    <Badge status={p.status} />
                    <h2>{p.name}</h2>
                    <p>
                      {p.category} · {p.districts.join(", ")}
                    </p>
                    <ProviderContact ownerId={p.owner_id} />
                  </div>
                </div>
                <p>{p.bio}</p>
                <div className="studio-gallery">
                  {p.portfolio_assets.map((a) => (
                    <figure key={a.id}>
                      {a.url && (
                        <a href={a.url} target="_blank" rel="noreferrer">
                          <img src={a.url} alt={a.caption} />
                        </a>
                      )}
                      <figcaption>
                        {a.caption}
                        <small>{a.approved ? "Đã duyệt" : "Chờ duyệt"}</small>
                      </figcaption>
                      {a.approved && (
                        <button
                          className="text-button danger"
                          disabled={busy}
                          onClick={() => {
                            const reason = prompt(
                              "Lý do ẩn tác phẩm (ít nhất 5 ký tự):",
                            );
                            if (reason)
                              void run(() =>
                                rpc("moderate_content", {
                                  p_id: a.id,
                                  p_kind: "portfolio",
                                  p_reason: reason,
                                }),
                              );
                          }}
                        >
                          Ẩn tác phẩm
                        </button>
                      )}
                    </figure>
                  ))}
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Gói</th>
                        <th>Thời lượng</th>
                        <th>Giá</th>
                        <th>Bao gồm</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.packages.map((k) => (
                        <tr key={k.id}>
                          <td>{k.name}</td>
                          <td>{k.duration} phút</td>
                          <td>{money(k.price)}</td>
                          <td>{k.includes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <form
                  className="moderate-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void run(() =>
                      rpc("moderate_provider", {
                        p_id: p.id,
                        p_status: f.get("status"),
                        p_reason: f.get("reason"),
                      }),
                    );
                  }}
                >
                  <Field label="Kết quả kiểm tra">
                    <select name="status">
                      <option value="APPROVED">
                        Duyệt hồ sơ và các ảnh đã kiểm tra
                      </option>
                      <option value="REJECTED">Yêu cầu bổ sung</option>
                      <option value="SUSPENDED">Tạm ngừng nhận lịch</option>
                    </select>
                  </Field>
                  <Field label="Ghi chú xác minh / lý do">
                    <input
                      name="reason"
                      required
                      minLength={5}
                      maxLength={1000}
                      placeholder="Đã liên hệ, kiểm tra ảnh thật và nội dung gói…"
                    />
                  </Field>
                  <button className="btn" disabled={busy}>
                    Lưu kết quả
                  </button>
                </form>
                {p.reviews.map((r) => (
                  <div className="list-row" key={r.id}>
                    <p>
                      {r.author_name}: {r.text}
                    </p>
                    {!r.hidden && (
                      <button
                        className="btn small ghost"
                        disabled={busy}
                        onClick={() => {
                          const reason = prompt("Lý do ẩn đánh giá:");
                          if (reason)
                            void run(() =>
                              rpc("moderate_content", {
                                p_id: r.id,
                                p_kind: "review",
                                p_reason: reason,
                              }),
                            );
                        }}
                      >
                        Ẩn vi phạm
                      </button>
                    )}
                  </div>
                ))}
              </section>
            ))}
            {!providers.length && (
              <Empty title="Chưa có hồ sơ creator">
                Creator cần đăng nhập và gửi hồ sơ trước.
              </Empty>
            )}
          </div>
        )}
        {tab === "bookings" && (
          <>
            {metrics && (
              <>
                <h2>Toàn bộ giao dịch</h2>
                <div className="metrics">
                  {[
                    ["Người dùng", metrics.users],
                    ["Creator đã duyệt", metrics.active_providers],
                    ["Booking gửi", metrics.requests],
                    ["Đã nhận cọc", metrics.paid],
                    ["Hoàn thành", metrics.completed],
                    ["GMV hoàn thành", money(metrics.gmv)],
                    ["Tỷ lệ hủy", `${metrics.cancellation_rate}%`],
                  ].map(([label, value]) => (
                    <div className="metric" key={label}>
                      <small>{label}</small>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
                <section className="panel">
                  <h2>Hành vi tài khoản đã đăng nhập · 90 ngày</h2>
                  <p>
                    Đếm thao tác, không phải số khách duy nhất; không bao gồm
                    khách chưa đăng nhập. Thao tác cùng loại trong 10 giây được
                    gộp.
                  </p>
                  <div className="metrics">
                    {[
                      ["search", "Tìm kiếm"],
                      ["provider_view", "Xem hồ sơ"],
                      ["package_view", "Chọn gói"],
                      ["booking_started", "Mở đặt lịch"],
                      ["booking_submitted", "Gửi thành công"],
                    ].map(([key, label]) => (
                      <div className="metric" key={key}>
                        <small>{label}</small>
                        <strong>{metrics.funnel[key] || 0}</strong>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}
            <h2>Danh sách booking</h2>
            <PageList state={bookingPage} label="booking" busy={busy}>
              <div className="metrics">
                <div className="metric">
                  <small>Booking trong trang này</small>
                  <strong>{bookings.length}</strong>
                </div>
                <div className="metric">
                  <small>Booking hoàn thành trong trang này</small>
                  <strong>
                    {bookings.filter((b) => b.status === "COMPLETED").length}
                  </strong>
                </div>
                <div className="metric">
                  <small>GMV hoàn thành trong trang này</small>
                  <strong>
                    {money(
                      bookings
                        .filter((b) => b.status === "COMPLETED")
                        .reduce((a, b) => a + b.price, 0),
                    )}
                  </strong>
                </div>
              </div>
              {bookings.map((b) => (
                <BookingCard b={b} key={b.id} />
              ))}
            </PageList>
          </>
        )}
        {tab === "users" && (
          <section className="panel table-wrap">
            <PageList state={userPage} label="người dùng" busy={busy}>
              <table>
                <thead>
                  <tr>
                    <th>Tên</th>
                    <th>Số điện thoại</th>
                    <th>Vai trò</th>
                    <th>ID</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.display_name || "Chưa cập nhật"}</td>
                      <td>{u.phone}</td>
                      <td>{u.role}</td>
                      <td>
                        <code>{u.id}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </PageList>
          </section>
        )}
        {tab === "audit" && (
          <section className="panel">
            <h2>Lịch sử thao tác</h2>
            <PageList state={auditPage} label="lịch sử thao tác" busy={busy}>
              {audit.map((a) => (
                <div className="list-row" key={a.id}>
                  <div>
                    <strong>{a.action}</strong>
                    <p>{a.detail}</p>
                  </div>
                  <small>{dateTime(a.created_at)}</small>
                </div>
              ))}
            </PageList>
          </section>
        )}
        {tab === "settings" && (
          <form
            className="panel form-grid"
            key={settings?.policy_version}
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await run(() =>
                rpc("save_settings", {
                  p_bank: f.get("bank"),
                  p_account: f.get("account"),
                  p_holder: f.get("holder"),
                  p_support: f.get("support"),
                  p_policy: f.get("policy"),
                  p_ready: f.get("ready") === "on",
                }),
              );
            }}
          >
            <h2>Thông tin vận hành thật</h2>
            <p>
              Nhập thông tin do đơn vị vận hành kiểm tra. Chính sách được lưu
              vào từng booking; thay đổi sau không ghi đè thỏa thuận cũ.
            </p>
            <div className="form-grid two">
              <Field label="Tên ngân hàng">
                <input
                  name="bank"
                  required
                  defaultValue={settings?.bank_name || ""}
                />
              </Field>
              <Field label="Số tài khoản nhận cọc">
                <input
                  name="account"
                  required
                  defaultValue={settings?.bank_account || ""}
                />
              </Field>
              <Field label="Tên chủ tài khoản">
                <input
                  name="holder"
                  required
                  defaultValue={settings?.bank_holder || ""}
                />
              </Field>
              <Field
                label="Link hỗ trợ (HTTPS)"
                hint="Zalo hoặc trang liên hệ có người trực trong beta."
              >
                <input
                  type="url"
                  name="support"
                  required
                  pattern="https://.*"
                  defaultValue={settings?.support_url}
                />
              </Field>
            </div>
            <Field
              label="Chính sách hủy / đổi lịch / hoàn tiền"
              hint="Nêu rõ các mốc thời gian, tỷ lệ hoàn, thời hạn xử lý, trường hợp creator hủy, cách liên hệ và bên nhận tiền."
            >
              <textarea
                name="policy"
                rows={9}
                required
                minLength={100}
                defaultValue={settings?.cancellation_policy}
              />
            </Field>
            <label className="checkbox">
              <input
                name="ready"
                type="checkbox"
                defaultChecked={settings?.ready}
              />
              Mở nhận booking sau khi đã kiểm tra thông tin và bố trí người hỗ
              trợ.
            </label>
            <button className="btn" disabled={busy}>
              Lưu cấu hình
            </button>
          </form>
        )}
        {resolve && (
          <Modal title="Xử lý yêu cầu hỗ trợ" onClose={() => setResolve(null)}>
            <p>{resolve.message}</p>
            {resolveLoading && <p role="status">Đang tải thông tin booking…</p>}
            {resolveError && <Alert>{resolveError}</Alert>}
            {error && <Alert>{error}</Alert>}
            <form
              className="form-grid"
              onSubmit={async (e) => {
                e.preventDefault();
                if (resolveLoading || !resolveBooking) return;
                const f = new FormData(e.currentTarget);
                const ok = await run(() =>
                  rpc("resolve_support", {
                    p_id: resolve.id,
                    p_resolution: f.get("resolution"),
                    p_cancel: f.get("cancel") === "on",
                    p_refund: Number(f.get("refund") || 0),
                  }),
                );
                if (ok) setResolve(null);
              }}
            >
              <Field label="Kết quả và thỏa thuận với khách">
                <textarea
                  name="resolution"
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={4}
                />
              </Field>
              <label className="checkbox">
                <input type="checkbox" name="cancel" />
                Hủy booking theo thỏa thuận đã thống nhất
              </label>
              <Field label="Số tiền hoàn khi hủy (VND)">
                <input
                  type="number"
                  name="refund"
                  min={0}
                  max={resolveBooking?.deposit || 0}
                  disabled={resolveLoading || !resolveBooking}
                  defaultValue={0}
                />
              </Field>
              <p>
                Khoản hoàn sẽ vào hàng chờ; chỉ xác nhận đã hoàn sau khi thực
                hiện chuyển tiền. Đổi lịch cần thống nhất hai bên qua hỗ trợ,
                hủy booking cũ và đặt lịch mới sau khi xử lý tiền.
              </p>
              <button
                className="btn"
                disabled={busy || resolveLoading || !resolveBooking}
              >
                Ghi nhận xử lý
              </button>
            </form>
          </Modal>
        )}
      </div>
    </div>
  );
}
