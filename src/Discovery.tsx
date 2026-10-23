import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Camera,
  Clock,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
} from "lucide-react";
import { rpc, track } from "./api";
import { useApp } from "./context";
import { useCatalog, useProvider } from "./useCatalog";
import { FavoriteButton } from "./FavoriteButton";
import {
  DISTRICTS,
  STYLES,
  SERVICES,
  localDate,
  money,
  timeOnly,
  type Provider,
} from "./domain";
import {
  Alert,
  Breadcrumb,
  CheckLine,
  Empty,
  Field,
  Loading,
  ProviderCard,
  Steps,
} from "./ui";

function SearchBar() {
  const navigate = useNavigate();
  return (
    <form
      className="hero-search"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const p = new URLSearchParams();
        for (const [k, v] of f) if (v) p.set(k, String(v));
        navigate("/explore?" + p);
      }}
    >
      <label>
        <span>
          <Camera size={13} />
          Bạn cần ai?
        </span>
        <select name="category">
          <option value="">Tất cả dịch vụ</option>
          <option>Photographer</option>
          <option>Makeup Artist</option>
        </select>
      </label>
      <label>
        <span>
          <MapPin size={13} />
          Khu vực
        </span>
        <select name="district">
          <option value="">Toàn TP.HCM</option>
          {DISTRICTS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </label>
      <label>
        <span>
          <Clock size={13} />
          Ngày bạn muốn
        </span>
        <input
          name="date"
          type="date"
          min={localDate(1)}
          max={localDate(89)}
          aria-label="Ngày bạn muốn"
        />
      </label>
      <button className="btn" aria-label="Tìm creator">
        <Search size={18} />
        <span>Tìm kiếm</span>
      </button>
    </form>
  );
}
export function Home() {
  const { providers, loading, settings } = useApp();
  const approved = providers.filter(
    (p) => p.status === "APPROVED" && p.packages.some((k) => k.active),
  );
  return (
    <>
      <section className="hero">
        <img
          className="hero-photo"
          src="/assets/hero-beautyhub.webp"
          alt="Ảnh minh họa buổi chụp chân dung"
        />
        <div className="hero-shade" />
        <div className="hero-copy">
          <span className="eyebrow">DÀNH CHO KHOẢNH KHẮC CỦA BẠN</span>
          <h1>
            Đúng gu.
            <br />
            Đúng người.
            <br />
            <em>Đúng khoảnh khắc.</em>
          </h1>
          <p>
            Tìm photographer và makeup artist tại TP.HCM.
            <br />
            Một người hiểu bạn. Một trải nghiệm đáng nhớ.
          </p>
          <SearchBar />
        </div>
        <div className="hero-caption">Ảnh minh họa · BeautyHub</div>
        <div className="hero-trust">
          <ShieldCheck size={18} />
          <span>Xem giá rõ ràng · Đặt lịch chủ động</span>
        </div>
      </section>
      <div className="trust-bar">
        <span>
          <Camera size={17} />
          Tác phẩm để bạn chọn đúng gu
        </span>
        <span>
          <ShieldCheck size={17} />
          Creator được kiểm tra trước khi nhận lịch
        </span>
        <span>
          <Clock size={17} />
          Biết rõ bước tiếp theo
        </span>
      </div>
      <section className="section">
        <div className="section-title">
          <div>
            <span className="eyebrow">BẮT ĐẦU TỪ BẠN</span>
            <h2>Hôm nay, bạn cần ai?</h2>
          </div>
          <p>Mỗi khoảnh khắc có một người phù hợp.</p>
        </div>
        <div className="categories">
          <Link
            to="/explore?category=Photographer"
            className="category-card photo"
          >
            <span className="category-icon">
              <Camera size={28} />
            </span>
            <small>01 / GHI LẠI CÂU CHUYỆN</small>
            <h3>Photographer</h3>
            <p>Cá nhân · Profile · Tốt nghiệp · Couple</p>
            <ArrowUpRight />
          </Link>
          <Link
            to="/explore?category=Makeup+Artist"
            className="category-card makeup"
          >
            <span className="category-icon">
              <Sparkles size={28} />
            </span>
            <small>02 / TÔN NÉT RIÊNG CỦA BẠN</small>
            <h3>Makeup Artist</h3>
            <p>Chụp ảnh · Tốt nghiệp · Tiệc & sự kiện</p>
            <ArrowUpRight />
          </Link>
        </div>
      </section>
      <section className="section discovery">
        <div className="section-title">
          <div>
            <span className="eyebrow">KHÁM PHÁ CREATOR</span>
            <h2>
              Người đồng hành
              <br className="mobile" /> cho gu của bạn.
            </h2>
          </div>
          <Link className="text-button" to="/explore">
            Xem tất cả <ArrowRight size={16} />
          </Link>
        </div>
        <div className="style-links">
          {["Natural", "Korean", "Cinematic", "Minimal", "Editorial"].map(
            (s) => (
              <Link to={`/explore?style=${s}`} key={s}>
                {s}
                <ArrowUpRight size={12} />
              </Link>
            ),
          )}
        </div>
        {loading ? (
          <Loading />
        ) : approved.length ? (
          <div className="creator-grid">
            {approved.slice(0, 4).map((p) => (
              <ProviderCard key={p.id} p={p} />
            ))}
          </div>
        ) : (
          <div className="opening">
            <div>
              <span className="eyebrow">MỘT KHỞI ĐẦU ĐƯỢC CHĂM CHÚT</span>
              <h3>
                Những creator đầu tiên
                <br />
                đang được chọn lọc.
              </h3>
              <p>
                Chúng mình đang hoàn thiện hồ sơ và kiểm tra tác phẩm trước khi
                mở nhận lịch. Bạn là photographer hoặc makeup artist?
              </p>
              <Link className="btn" to="/studio">
                Tham gia cùng BeautyHub <ArrowRight size={16} />
              </Link>
            </div>
            <div className="opening-art">
              <Camera size={56} />
              <Sparkles size={30} />
              <span>Made for your moments.</span>
            </div>
          </div>
        )}
      </section>
      <section className="manifesto">
        <div>
          <span className="eyebrow">MỘT TRẢI NGHIỆM RÕ RÀNG</span>
          <h2>
            Đẹp theo cách
            <br />
            <em>rất riêng của bạn.</em>
          </h2>
          <p>
            Từ lúc tìm kiếm đến buổi hẹn, bạn luôn biết mình chọn ai, trả bao
            nhiêu và cần làm gì tiếp theo.
          </p>
          <Link to="/how-it-works">
            Cách BeautyHub hoạt động <ArrowRight size={16} />
          </Link>
        </div>
        <Steps />
      </section>
      <section className="section invite">
        <Sparkles size={24} />
        <h2>
          Giữ lại những điều
          <br />
          <em>khiến bạn là bạn.</em>
        </h2>
        <Link className="btn" to="/explore">
          Tìm creator phù hợp <ArrowRight size={16} />
        </Link>
        {!settings?.ready && (
          <small>Private beta đang được chuẩn bị · Chưa mở nhận đặt cọc</small>
        )}
      </section>
    </>
  );
}
export function Explore() {
  const [params, setParams] = useSearchParams();
  const date = params.get("date") || "";
  const filters = {
    category: params.get("category") || "",
    district: params.get("district") || "",
    style: params.get("style") || "",
    service: params.get("service") || "",
    budget: Number(params.get("budget") || 100000000),
    query: params.get("q") || "",
  };
  const sort = params.get("sort") || "recommended";
  const pageValue = Number(params.get("page") || 1);
  const page =
    Number.isInteger(pageValue) && pageValue >= 1 && pageValue <= 10000
      ? pageValue
      : 1;
  const result = useCatalog({ ...filters, date, sort }, page);
  const { items: results, total, loading, error } = result;
  const pages = Math.max(1, Math.ceil(total / 12));
  useEffect(() => {
    if (!loading && !error && page > pages) {
      const next = new URLSearchParams(params);
      next.set("page", String(pages));
      setParams(next, { replace: true });
    }
  }, [loading, error, page, pages]);
  function set(name: string, value: string) {
    const n = new URLSearchParams(params);
    value ? n.set(name, value) : n.delete(name);
    if (name !== "page") n.delete("page");
    setParams(n, { replace: true });
  }
  return (
    <div className="page">
      <Breadcrumb label="Khám phá" />
      <div className="page-heading">
        <div>
          <span className="eyebrow">TÌM NGƯỜI ĐỒNG HÀNH</span>
          <h1>Hợp gu. Hợp lịch.</h1>
          <p className="muted">
            Chọn điều bạn cần, chúng mình giúp bạn thu hẹp lựa chọn.
          </p>
        </div>
        <span className="city-pill">
          <MapPin size={15} />
          TP. Hồ Chí Minh
        </span>
      </div>
      <div className="explore-layout">
        <aside className="filter-panel">
          <h3>
            <SlidersHorizontal size={17} />
            Bộ lọc
          </h3>
          <Field label="Tên creator">
            <input
              value={filters.query}
              maxLength={100}
              onChange={(e) => set("q", e.target.value)}
              placeholder="Bạn đang tìm ai?"
            />
          </Field>
          <Field label="Dịch vụ">
            <select
              value={filters.category}
              onChange={(e) => set("category", e.target.value)}
            >
              <option value="">Tất cả</option>
              <option>Photographer</option>
              <option>Makeup Artist</option>
            </select>
          </Field>
          <Field label="Nhu cầu">
            <select
              value={filters.service}
              onChange={(e) => set("service", e.target.value)}
            >
              <option value="">Tất cả nhu cầu</option>
              {SERVICES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Khu vực">
            <select
              value={filters.district}
              onChange={(e) => set("district", e.target.value)}
            >
              <option value="">Toàn TP.HCM</option>
              {DISTRICTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Ngày thực hiện">
            <input
              type="date"
              value={date}
              min={localDate(1)}
              max={localDate(89)}
              onChange={(e) => set("date", e.target.value)}
            />
          </Field>
          <Field label="Phong cách">
            <select
              value={filters.style}
              onChange={(e) => set("style", e.target.value)}
            >
              <option value="">Mọi phong cách</option>
              {STYLES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Ngân sách tối đa">
            <select
              value={String(filters.budget)}
              onChange={(e) => set("budget", e.target.value)}
            >
              {[500000, 1000000, 1500000, 2000000, 3000000, 100000000].map(
                (n) => (
                  <option key={n} value={n}>
                    {n === 100000000 ? "Không giới hạn" : money(n)}
                  </option>
                ),
              )}
            </select>
          </Field>
          <button className="text-button" onClick={() => setParams({})}>
            Xóa bộ lọc
          </button>
        </aside>
        <section className="results">
          <div className="results-top">
            <span>{loading ? "Đang tìm…" : `${total} creator phù hợp`}</span>
            <select
              aria-label="Sắp xếp"
              value={sort}
              onChange={(e) => set("sort", e.target.value)}
            >
              <option value="recommended">Mới tham gia</option>
              <option value="price">Giá thấp đến cao</option>
              <option value="rating">Đánh giá cao nhất</option>
            </select>
          </div>
          {error && (
            <Alert>
              Không tải được danh sách: {error}{" "}
              <button className="btn ghost" onClick={result.retry}>
                Thử lại
              </button>
            </Alert>
          )}
          {loading ? (
            <Loading />
          ) : error ? null : results.length ? (
            <div className="creator-grid results-grid">
              {results.map((p) => (
                <ProviderCard p={p} key={p.id} />
              ))}
            </div>
          ) : (
            <Empty
              title={
                params.size
                  ? "Chưa có creator khớp lựa chọn"
                  : "Danh sách creator đang được chuẩn bị"
              }
            >
              <p>
                {params.size
                  ? "Thử đổi ngày, khu vực hoặc tăng ngân sách để có thêm lựa chọn."
                  : "Hồ sơ chỉ được mở đặt lịch sau khi BeautyHub kiểm tra và xác minh."}
              </p>
              <button className="btn ghost" onClick={() => setParams({})}>
                Xem mọi lựa chọn
              </button>
            </Empty>
          )}
          {!loading && !error && total > 12 && (
            <nav className="section-title" aria-label="Phân trang creator">
              <button
                className="btn ghost"
                disabled={page <= 1}
                onClick={() => set("page", String(page - 1))}
              >
                Trang trước
              </button>
              <span role="status" aria-live="polite">
                Trang {page}/{pages}
              </span>
              <button
                className="btn ghost"
                disabled={page >= pages}
                onClick={() => set("page", String(page + 1))}
              >
                Trang sau
              </button>
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
export function Creator() {
  const { slug } = useParams();
  const { settings, toast } = useApp();
  const detail = useProvider(slug);
  const { provider: p, loading } = detail;
  useEffect(() => {
    if (p) {
      document.title = `${p.name} — ${p.category} | BeautyHub`;
      document
        .querySelector('meta[name="description"]')
        ?.setAttribute("content", `${p.name}: ${p.bio}`.slice(0, 160));
    }
  }, [p]);
  const [selected, setSelected] = useState(""),
    [retry, setRetry] = useState(0),
    [day, setDay] = useState(localDate(2)),
    [slots, setSlots] = useState<{ starts_at: string; ends_at: string }[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pkg =
    p?.packages.find((k) => k.id === selected && k.active) ||
    p?.packages.find((k) => k.active);
  useEffect(() => {
    if (!pkg) return;
    let live = true;
    setBusy(true);
    setError("");
    setSlots([]);
    void rpc<{ starts_at: string; ends_at: string }[]>("free_slots", {
      p_package: pkg.id,
      p_day: day,
    })
      .then((s) => {
        if (live) setSlots(s);
      })
      .catch(() => {
        if (live)
          setError(
            "Không tải được lịch. Hãy chọn lại ngày hoặc tải lại trang.",
          );
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [pkg?.id, day, retry]);
  if (loading) return <Loading />;
  if (detail.error)
    return (
      <div className="page">
        <Alert>
          {detail.error}{" "}
          <button className="btn ghost" onClick={detail.retry}>
            Thử lại
          </button>
        </Alert>
      </div>
    );
  if (!p)
    return (
      <div className="page">
        <Empty title="Hồ sơ chưa khả dụng">
          <Link to="/explore">Khám phá creator khác</Link>
        </Empty>
      </div>
    );
  const assets = p.portfolio_assets.filter((a) => a.approved && a.url);
  return (
    <div className="page">
      <Breadcrumb label={p.name} />
      <div className="profile-heading">
        <div>
          <span className="eyebrow">{p.category}</span>
          <h1>{p.name}</h1>
          <div className="inline-meta">
            <span>
              <ShieldCheck size={16} />
              BeautyHub xác minh
            </span>
            <span>
              <MapPin size={16} />
              {p.districts.join(", ")}
            </span>
          </div>
        </div>
        <FavoriteButton provider={p} className="profile-favorite" />
        <button
          className="btn ghost"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(location.href);
              toast("Đã sao chép liên kết hồ sơ.");
            } catch {
              toast("Bạn có thể sao chép địa chỉ trên thanh trình duyệt.");
            }
          }}
        >
          Chia sẻ hồ sơ <ArrowUpRight size={15} />
        </button>
      </div>
      <div className="profile-layout">
        <div>
          <div className="portfolio-grid">
            {assets.map((a, i) => (
              <a
                href={a.url}
                target="_blank"
                rel="noreferrer"
                key={a.id}
                className={i === 0 ? "portfolio-main" : ""}
              >
                <img
                  src={a.url}
                  alt={a.caption || `Tác phẩm ${i + 1} của ${p.name}`}
                  loading={i ? "lazy" : "eager"}
                />
              </a>
            ))}
          </div>
          <section className="profile-section">
            <h2>Một chút về {p.name}</h2>
            <p className="preserve">{p.bio}</p>
            <div className="tags">
              {p.styles.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
          </section>
          <section className="profile-section">
            <h2>Gói dịch vụ</h2>
            {p.packages
              .filter((k) => k.active)
              .map((k) => (
                <button
                  className={`package-card ${pkg?.id === k.id ? "selected" : ""}`}
                  key={k.id}
                  onClick={() => {
                    setSelected(k.id);
                    void track("package_view");
                  }}
                >
                  <div>
                    <span className="eyebrow">{k.service}</span>
                    <h3>{k.name}</h3>
                    <p>{k.description}</p>
                    <div className="inline-meta">
                      <span>{k.duration} phút</span>
                      <span>Giao sản phẩm: {k.delivery_days} ngày</span>
                    </div>
                    <p>
                      <strong>Bao gồm:</strong> {k.includes || "Theo mô tả gói"}
                    </p>
                    <p>
                      <strong>Không bao gồm:</strong>{" "}
                      {k.exclusions ||
                        "Không có phụ phí ngoài gói được công bố"}
                    </p>
                  </div>
                  <strong>{money(k.price)}</strong>
                </button>
              ))}
          </section>
          <section className="profile-section">
            <h2>Đánh giá từ khách hàng</h2>
            {(p.review_count || 0) > 20 && (
              <p className="muted">
                Hiển thị 20 đánh giá mới nhất trong {p.review_count} đánh giá;
                điểm trên thẻ được tính từ toàn bộ đánh giá công khai.
              </p>
            )}
            {p.reviews.filter((r) => !r.hidden).length ? (
              p.reviews
                .filter((r) => !r.hidden)
                .map((r) => (
                  <article className="review" key={r.id}>
                    <strong>
                      {r.author_name}{" "}
                      <span>★ {Number(r.rating).toFixed(1)}</span>
                    </strong>
                    <p>{r.text}</p>
                    <small>Booking đã hoàn thành</small>
                  </article>
                ))
            ) : (
              <p className="muted">
                Creator chưa có đánh giá từ booking hoàn thành trên BeautyHub.
              </p>
            )}
          </section>
        </div>
        <aside className="booking-aside panel">
          <span className="eyebrow">LÊN LỊCH CHO BẠN</span>
          <h2>{pkg?.name || "Chọn gói dịch vụ"}</h2>
          {pkg && (
            <>
              <div className="big-price">
                {money(pkg.price)}
                <small>/ buổi</small>
              </div>
              <p className="muted">
                Đặt cọc 30%: {money(Math.ceil(pkg.price * 0.3))}
              </p>
              <Field label="Chọn ngày">
                <input
                  type="date"
                  value={day}
                  min={localDate(1)}
                  max={localDate(89)}
                  onChange={(e) => setDay(e.target.value)}
                />
              </Field>
              {error && (
                <Alert>
                  {error}{" "}
                  <button
                    className="btn ghost"
                    onClick={() => setRetry(retry + 1)}
                  >
                    Thử lại
                  </button>
                </Alert>
              )}
              {busy ? (
                <Loading />
              ) : error ? null : (
                <div className="slots">
                  {slots.length ? (
                    slots.map((s) => (
                      <Link
                        className={`slot ${!settings?.ready ? "disabled" : ""}`}
                        key={s.starts_at}
                        to={
                          settings?.ready
                            ? `/checkout/${pkg.id}?start=${encodeURIComponent(s.starts_at)}`
                            : "#"
                        }
                        aria-disabled={!settings?.ready}
                      >
                        {timeOnly(s.starts_at)}
                      </Link>
                    ))
                  ) : (
                    <p>
                      Không có giờ trống trong ngày này. Bạn thử chọn ngày khác
                      nhé.
                    </p>
                  )}
                </div>
              )}
              <CheckLine>Creator nhận lịch trước khi bạn đặt cọc.</CheckLine>
              <CheckLine>Giá và nội dung gói được lưu theo booking.</CheckLine>
              <Link className="text-button" to="/policies">
                Xem chính sách hủy & hỗ trợ
              </Link>
              {!settings?.ready && (
                <Alert>BeautyHub chưa mở nhận booking.</Alert>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
