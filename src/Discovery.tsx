import { useEffect, useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Award,
  BookOpen,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Heart,
  HelpCircle,
  MapPin,
  MessageCircle,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Users,
  Zap,
} from "lucide-react";
import { configured, rpc, track } from "./api";
import { useApp } from "./context";
import {
  DISTRICTS,
  FAQ_ITEMS,
  SERVICES,
  STYLES,
  TESTIMONIALS,
  TRENDING_CONCEPTS,
  filterProviders,
  localDate,
  minPrice,
  money,
  timeOnly,
  type Provider,
} from "./domain";
import {
  Alert,
  Breadcrumb,
  CheckLine,
  Empty,
  FaqAccordion,
  Field,
  LightboxModal,
  Loading,
  ProviderCard,
  RatingStars,
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
          <Camera size={14} />
          Bạn cần dịch vụ gì?
        </span>
        <select name="category">
          <option value="">Tất cả dịch vụ</option>
          <option value="Photographer">Photographer (Chụp ảnh)</option>
          <option value="Makeup Artist">Makeup Artist (Trang điểm)</option>
        </select>
      </label>
      <label>
        <span>
          <MapPin size={14} />
          Khu vực TP.HCM
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
          <Clock size={14} />
          Ngày bạn muốn hẹn
        </span>
        <input
          name="date"
          type="date"
          min={localDate(1)}
          max={localDate(89)}
          aria-label="Ngày bạn muốn hẹn"
        />
      </label>
      <button className="btn" aria-label="Tìm kiếm Creator">
        <Search size={18} />
        <span>Tìm Creator</span>
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
          alt="Ảnh minh họa buổi chụp chân dung nghệ thuật BeautyHub"
        />
        <div className="hero-shade" />
        <div className="hero-copy">
          <div className="hero-pill-badge">
            <span className="star-dot">★</span>
            <span>4.9/5 từ 500+ khách hàng tại TP.HCM</span>
          </div>
          <h1>
            Đúng gu.
            <br />
            Đúng người.
            <br />
            <em>Đúng khoảnh khắc.</em>
          </h1>
          <p>
            Nền tảng tuyển chọn Photographer & Makeup Artist chuyên nghiệp tại TP.HCM.
            <br />
            Tác phẩm thật, giá niêm yết rõ ràng, an tâm đặt cọc qua VietQR.
          </p>
          <SearchBar />
        </div>
        <div className="hero-caption">Tác phẩm xác minh · BeautyHub Network</div>
        <div className="hero-trust">
          <ShieldCheck size={18} />
          <span>100% Creator kiểm duyệt tay nghề · Giữ lịch chủ động</span>
        </div>
      </section>

      <div className="trust-bar">
        <span>
          <img
            src="/assets/brand-mark.png"
            alt=""
            className="trust-mark-icon"
            width="20"
            height="20"
          />
          Đúng người, trọn vẹn khoảnh khắc
        </span>
        <span>
          <Camera size={17} />
          100% Ảnh tác phẩm thật & xác minh
        </span>
        <span>
          <ShieldCheck size={17} />
          Bảo chứng cọc & Hoàn tiền minh bạch
        </span>
        <span>
          <Clock size={17} />
          Phản hồi lịch nhanh trong 15-30 phút
        </span>
      </div>

      {/* Categories */}
      <section className="section">
        <div className="section-title">
          <div>
            <span className="eyebrow">DỊCH VỤ NỔI BẬT</span>
            <h2>Hôm nay, bạn cần ai đồng hành?</h2>
          </div>
          <p>Mỗi câu chuyện và khoảnh khắc đều có một chuyên gia phù hợp.</p>
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
            <p>Chân dung cá nhân · Profile CV · Kỷ yếu · Couple · Ngoại cảnh</p>
            <span className="category-action">
              Khám phá nhiếp ảnh gia <ArrowUpRight size={16} />
            </span>
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
            <p>Layout chuẩn Hàn · Chụp ảnh nghệ thuật · Dạ tiệc · Cô dâu tối giản</p>
            <span className="category-action">
              Khám phá chuyên viên makeup <ArrowUpRight size={16} />
            </span>
          </Link>
        </div>
      </section>

      {/* Trending Concepts / Lookbooks */}
      <section className="section lookbooks-section">
        <div className="section-title">
          <div>
            <span className="eyebrow">BỘ SƯU TẬP CONCEPT THỊNH HÀNH</span>
            <h2>Tìm cảm hứng cho buổi hẹn của bạn</h2>
          </div>
          <Link className="text-button" to="/explore">
            Xem tất cả concept <ArrowRight size={16} />
          </Link>
        </div>
        <div className="lookbook-grid">
          {TRENDING_CONCEPTS.map((c) => (
            <Link
              key={c.id}
              to={`/explore?style=${c.style}&category=${encodeURIComponent(c.category)}`}
              className="concept-card"
            >
              <div className="concept-image-wrap">
                <img src={c.image} alt={c.title} loading="lazy" />
                <span className="concept-tag">{c.tag}</span>
              </div>
              <div className="concept-body">
                <span className="concept-cat">{c.category}</span>
                <h3>{c.title}</h3>
                <small className="concept-sub">{c.subtitle}</small>
                <p>{c.description}</p>
                <span className="concept-link">
                  Xem Creator phong cách này <ArrowUpRight size={14} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Creators */}
      <section className="section discovery">
        <div className="section-title">
          <div>
            <span className="eyebrow">TOP CREATOR ĐƯỢC YÊU THÍCH</span>
            <h2>
              Người đồng hành
              <br className="mobile" /> cho gu thẩm mỹ của bạn
            </h2>
          </div>
          <Link className="text-button" to="/explore">
            Xem tất cả creator <ArrowRight size={16} />
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
              <h3>Những creator đầu tiên đang được chọn lọc.</h3>
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

      {/* Trust & Safety Guarantee Pillars */}
      <section className="section guarantees-section">
        <div className="section-title center">
          <span className="eyebrow">AN TÂM TRÊN TỪNG BUỔI HẸN</span>
          <h2>Cam kết bảo chứng từ BeautyHub</h2>
          <p>
            Chúng mình xây dựng trải nghiệm đặt lịch minh bạch và bảo vệ tối đa quyền
            lợi của bạn.
          </p>
        </div>
        <div className="guarantees-grid">
          <div className="guarantee-card">
            <div className="guarantee-icon">
              <Award size={28} />
            </div>
            <h3>100% Tác phẩm thật</h3>
            <p>
              Mọi hình ảnh và layout trong hồ sơ đều do chính Creator thực hiện,
              được đội ngũ BeautyHub kiểm duyệt kỹ lưỡng trước khi mở nhận lịch.
            </p>
          </div>
          <div className="guarantee-card">
            <div className="guarantee-icon">
              <ShieldCheck size={28} />
            </div>
            <h3>Bảo chứng Cọc An Toàn</h3>
            <p>
              Chỉ chuyển cọc 30% qua VietQR sau khi Creator nhận lịch. Hoàn 100%
              tiền cọc nếu Creator hủy hẹn hoặc không đến đúng giờ.
            </p>
          </div>
          <div className="guarantee-card">
            <div className="guarantee-icon">
              <Zap size={28} />
            </div>
            <h3>Giá niêm yết minh bạch</h3>
            <p>
              Biết trước chính xác toàn bộ chi phí, số lượng ảnh bàn giao và thời
              gian phục vụ. Cam kết không phát sinh bất kỳ phụ phí ẩn nào.
            </p>
          </div>
          <div className="guarantee-card">
            <div className="guarantee-icon">
              <MessageCircle size={28} />
            </div>
            <h3>Hỗ trợ đồng hành 24/7</h3>
            <p>
              Kênh hỗ trợ trực tuyến qua Zalo và Hotline luôn sẵn sàng hỗ trợ đổi
              lịch, xử lý thắc mắc và đồng hành cùng bạn đến khi hoàn tất.
            </p>
          </div>
        </div>
      </section>

      {/* Booking Steps Manifesto */}
      <section className="manifesto">
        <div>
          <span className="eyebrow">QUY TRÌNH 4 BƯỚC ĐƠN GIẢN</span>
          <h2>
            Đẹp theo cách
            <br />
            <em>rất riêng của bạn.</em>
          </h2>
          <p>
            Từ lúc tìm kiếm đến buổi hẹn, bạn luôn biết mình chọn ai, trả bao
            nhiêu và các bước tiếp theo diễn ra như thế nào.
          </p>
          <Link to="/how-it-works" className="btn ghost">
            Xem chi tiết cách đặt lịch <ArrowRight size={16} />
          </Link>
        </div>
        <Steps />
      </section>

      {/* Customer Testimonials */}
      <section className="section testimonials-section">
        <div className="section-title center">
          <span className="eyebrow">CẢM NHẬN KHÁCH HÀNG</span>
          <h2>Những khoảnh khắc đáng nhớ</h2>
          <p>Lắng nghe cảm nhận từ những bạn trẻ đã trải nghiệm dịch vụ tại BeautyHub.</p>
        </div>
        <div className="testimonials-grid">
          {TESTIMONIALS.map((t) => (
            <div key={t.id} className="testimonial-card">
              <RatingStars rating={t.rating} />
              <p className="testimonial-text">"{t.text}"</p>
              <div className="testimonial-author">
                <img src={t.avatar} alt={t.author} className="author-avatar" />
                <div>
                  <strong>{t.author}</strong>
                  <small>{t.role}</small>
                  <span className="testimonial-meta">
                    {t.service} · {t.creatorName}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="section faq-section">
        <div className="section-title center">
          <span className="eyebrow">GIẢI ĐÁP THẮC MẮC</span>
          <h2>Câu hỏi thường gặp</h2>
          <p>Mọi điều bạn cần biết trước khi đặt lịch tại BeautyHub.</p>
        </div>
        <div className="faq-wrap">
          <FaqAccordion items={FAQ_ITEMS} />
        </div>
      </section>

      {/* Dual Invitation CTA */}
      <section className="section dual-cta">
        <div className="cta-box client-box">
          <Sparkles size={32} />
          <h2>
            Tỏa sáng trong
            <br />
            <em>khoảnh khắc của bạn.</em>
          </h2>
          <p>
            Hàng chục concept thịnh hành và chuyên gia đang sẵn sàng đồng hành cùng bạn.
          </p>
          <Link className="btn" to="/explore">
            Tìm Creator ngay <ArrowRight size={16} />
          </Link>
        </div>
        <div className="cta-box creator-box">
          <Camera size={32} />
          <h2>
            Bạn là Photographer
            <br />
            <em>hay Makeup Artist?</em>
          </h2>
          <p>
            Gia nhập mạng lưới BeautyHub để nhận khách hàng chất lượng, chủ động lịch
            và bảo đảm thu nhập.
          </p>
          <Link className="btn ghost" to="/studio">
            Đăng ký làm Creator <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </>
  );
}

export function Explore() {
  const { providers, loading } = useApp();
  const [params, setParams] = useSearchParams();
  const [available, setAvailable] = useState<Set<string> | null>(null),
    [checking, setChecking] = useState(false),
    [slotError, setSlotError] = useState("");

  const date = params.get("date") || "";
  const filters = {
    category: params.get("category") || "",
    district: params.get("district") || "",
    style: params.get("style") || "",
    service: params.get("service") || "",
    budget: Number(params.get("budget") || 100000000),
    query: params.get("q") || "",
  };

  const candidates = filterProviders(providers, filters);
  const key = candidates.map((p) => p.id).join(",");

  useEffect(() => {
    let live = true;
    setAvailable(null);
    setSlotError("");
    if (!date || !configured) {
      setChecking(false);
      return;
    }
    setChecking(true);
    void Promise.all(
      candidates.map(async (p) => {
        const packages = p.packages.filter(
          (k) =>
            k.active &&
            k.price <= filters.budget &&
            (!filters.service || k.service === filters.service),
        );
        const results = await Promise.all(
          packages.map((k) =>
            rpc<unknown[]>("free_slots", { p_package: k.id, p_day: date }),
          ),
        );
        return results.some((r) => r.length) ? p.id : null;
      }),
    )
      .then((ids) => {
        if (live)
          setAvailable(new Set(ids.filter((v): v is string => Boolean(v))));
      })
      .catch(() => {
        if (live)
          setSlotError("Chưa kiểm tra được lịch trống. Vui lòng thử lại.");
      })
      .finally(() => {
        if (live) setChecking(false);
      });
    return () => {
      live = false;
    };
  }, [date, key, filters.budget, filters.service]);

  let results = candidates.filter((p) => !date || available?.has(p.id));
  const sort = params.get("sort") || "recommended";
  if (sort === "price")
    results = [...results].sort((a, b) => minPrice(a) - minPrice(b));
  if (sort === "rating")
    results = [...results].sort((a, b) => average(b) - average(a));

  function set(name: string, value: string) {
    const n = new URLSearchParams(params);
    value ? n.set(name, value) : n.delete(name);
    setParams(n, { replace: true });
  }

  function applyChip(action: Record<string, string>) {
    const n = new URLSearchParams(params);
    Object.entries(action).forEach(([k, v]) => {
      if (v) n.set(k, v);
      else n.delete(k);
    });
    setParams(n, { replace: true });
  }

  return (
    <div className="page">
      <Breadcrumb label="Khám phá Creator" />
      <div className="page-heading">
        <div>
          <span className="eyebrow">TÌM NGƯỜI ĐỒNG HÀNH HOÀN HẢO</span>
          <h1>Hợp gu. Hợp lịch. Đúng ngân sách.</h1>
          <p className="muted">
            Lọc theo dịch vụ, khu vực và phong cách nghệ thuật yêu thích của bạn.
          </p>
        </div>
        <span className="city-pill">
          <MapPin size={15} />
          TP. Hồ Chí Minh
        </span>
      </div>

      {/* Quick Filter Chips */}
      <div className="quick-chips">
        <button
          className={
            !filters.category && !filters.style && !filters.service
              ? "chip active"
              : "chip"
          }
          onClick={() => setParams({})}
        >
          Tất cả
        </button>
        <button
          className={filters.category === "Photographer" ? "chip active" : "chip"}
          onClick={() => applyChip({ category: "Photographer", style: "", service: "" })}
        >
          <Camera size={13} /> Photographer
        </button>
        <button
          className={filters.category === "Makeup Artist" ? "chip active" : "chip"}
          onClick={() => applyChip({ category: "Makeup Artist", style: "", service: "" })}
        >
          <Sparkles size={13} /> Makeup Artist
        </button>
        <button
          className={filters.style === "Korean" ? "chip active" : "chip"}
          onClick={() => applyChip({ style: "Korean" })}
        >
          Tone Hàn Quốc
        </button>
        <button
          className={filters.style === "Cinematic" ? "chip active" : "chip"}
          onClick={() => applyChip({ style: "Cinematic" })}
        >
          Tone Phim Cinematic
        </button>
        <button
          className={filters.service === "Personal" ? "chip active" : "chip"}
          onClick={() => applyChip({ service: "Personal" })}
        >
          Chân dung cá nhân
        </button>
        <button
          className={filters.service === "Party/Event" ? "chip active" : "chip"}
          onClick={() => applyChip({ service: "Party/Event" })}
        >
          Makeup Tiệc & Sự kiện
        </button>
        <button
          className={filters.budget === 1000000 ? "chip active" : "chip"}
          onClick={() => applyChip({ budget: "1000000" })}
        >
          Dưới 1.000.000đ
        </button>
      </div>

      <div className="explore-layout">
        <aside className="filter-panel">
          <div className="filter-header">
            <h3>
              <SlidersHorizontal size={17} />
              Bộ lọc chi tiết
            </h3>
            {(filters.category ||
              filters.district ||
              filters.style ||
              filters.service ||
              filters.query ||
              filters.budget < 100000000 ||
              date) && (
              <button className="text-button small" onClick={() => setParams({})}>
                Đặt lại
              </button>
            )}
          </div>
          <Field label="Tìm kiếm tên Creator">
            <input
              value={filters.query}
              onChange={(e) => set("q", e.target.value)}
              placeholder="Nhập tên Creator hoặc phong cách..."
            />
          </Field>
          <Field label="Dịch vụ">
            <select
              value={filters.category}
              onChange={(e) => set("category", e.target.value)}
            >
              <option value="">Tất cả dịch vụ</option>
              <option value="Photographer">Photographer (Chụp ảnh)</option>
              <option value="Makeup Artist">Makeup Artist (Trang điểm)</option>
            </select>
          </Field>
          <Field label="Nhu cầu dịch vụ">
            <select
              value={filters.service}
              onChange={(e) => set("service", e.target.value)}
            >
              <option value="">Tất cả nhu cầu</option>
              {SERVICES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Khu vực TP.HCM">
            <select
              value={filters.district}
              onChange={(e) => set("district", e.target.value)}
            >
              <option value="">Toàn TP.HCM</option>
              {DISTRICTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ngày bạn muốn thực hiện">
            <input
              type="date"
              value={date}
              min={localDate(1)}
              max={localDate(89)}
              onChange={(e) => set("date", e.target.value)}
            />
          </Field>
          <Field label="Phong cách nghệ thuật">
            <select
              value={filters.style}
              onChange={(e) => set("style", e.target.value)}
            >
              <option value="">Mọi phong cách</option>
              {STYLES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
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
                    {n === 100000000 ? "Không giới hạn ngân sách" : money(n)}
                  </option>
                ),
              )}
            </select>
          </Field>
        </aside>

        <section className="results">
          <div className="results-top">
            <span className="results-count">
              {loading || checking ? (
                "Đang kiểm tra lịch trống…"
              ) : (
                <>
                  Tìm thấy <strong>{results.length}</strong> Creator phù hợp
                </>
              )}
            </span>
            <div className="results-sort">
              <label htmlFor="sort-select">Sắp xếp theo:</label>
              <select
                id="sort-select"
                aria-label="Sắp xếp danh sách"
                value={sort}
                onChange={(e) => set("sort", e.target.value)}
              >
                <option value="recommended">Được đề xuất</option>
                <option value="rating">Đánh giá cao nhất</option>
                <option value="price">Giá từ thấp đến cao</option>
              </select>
            </div>
          </div>

          {slotError && <Alert>{slotError}</Alert>}

          {loading || checking ? (
            <Loading />
          ) : results.length ? (
            <div className="creator-grid results-grid">
              {results.map((p) => (
                <ProviderCard p={p} key={p.id} />
              ))}
            </div>
          ) : (
            <Empty
              title={
                providers.length
                  ? "Chưa tìm thấy Creator khớp hoàn toàn lựa chọn"
                  : "Danh sách Creator đang được cập nhật"
              }
            >
              <p>
                {providers.length
                  ? "Hãy thử đổi ngày thực hiện, chọn rộng khu vực hoặc nới ngân sách để có thêm lựa chọn tuyệt vời."
                  : "Hồ sơ Creator luôn được BeautyHub xác minh tay nghề và ảnh thực tế trước khi xuất hiện."}
              </p>
              <button className="btn ghost" onClick={() => setParams({})}>
                Xem tất cả Creator
              </button>
            </Empty>
          )}
        </section>
      </div>
    </div>
  );
}

function average(p: Provider) {
  return p.reviews.length
    ? p.reviews.reduce((s, r) => s + Number(r.rating), 0) / p.reviews.length
    : p.rating_score || 0;
}

export function Creator() {
  const { slug } = useParams();
  const { providers, loading, settings, toast } = useApp();
  const p = providers.find((p) => p.slug === slug && p.status === "APPROVED");

  const [activeTab, setActiveTab] = useState<"portfolio" | "packages" | "reviews" | "about">("portfolio");
  const [selected, setSelected] = useState("");
  const [day, setDay] = useState(localDate(2));
  const [slots, setSlots] = useState<{ starts_at: string; ends_at: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

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
            "Chưa tải được lịch trống tự động. Bạn vẫn có thể chọn ngày hoặc thử lại.",
          );
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [pkg?.id, day]);

  if (loading) return <Loading />;
  if (!p)
    return (
      <div className="page">
        <Empty title="Hồ sơ Creator chưa khả dụng">
          <p>Hồ sơ này có thể đang được cập nhật hoặc điều chỉnh lịch phục vụ.</p>
          <Link to="/explore" className="btn">
            Khám phá Creator khác
          </Link>
        </Empty>
      </div>
    );

  const assets = p.portfolio_assets?.filter((a) => a.approved && a.url) || [];
  const reviews = p.reviews?.filter((r) => !r.hidden) || [];
  const avgRating = reviews.length
    ? (
        reviews.reduce((a, r) => a + Number(r.rating), 0) / reviews.length
      ).toFixed(1)
    : p.rating_score
      ? p.rating_score.toFixed(1)
      : "5.0";

  const depositAmount = pkg ? Math.ceil(pkg.price * 0.3) : 0;
  const remainingAmount = pkg ? pkg.price - depositAmount : 0;

  return (
    <div className="page">
      <Breadcrumb label={p.name} />

      {/* Creator Profile Hero Header */}
      <div className="profile-heading-card">
        <div className="profile-header-main">
          {p.avatar_url && (
            <img
              src={p.avatar_url}
              alt={p.name}
              className="creator-avatar-large"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <div className="profile-info">
            <div className="inline-meta badges">
              <span className="cat-pill">
                {p.category === "Photographer" ? <Camera size={13} /> : <Sparkles size={13} />}
                {p.category}
              </span>
              <span className="verified">
                <ShieldCheck size={14} />
                BeautyHub xác minh tay nghề
              </span>
              {p.response_time && (
                <span className="response-badge">
                  <Clock size={12} /> Phản hồi ~{p.response_time}
                </span>
              )}
            </div>
            <h1>{p.name}</h1>
            <div className="creator-stats-bar">
              <span className="rating-pill">
                <Star size={15} fill="#e59838" color="#e59838" />
                <strong>{avgRating}</strong>
                <small>({reviews.length} đánh giá)</small>
              </span>
              <span className="sep">•</span>
              <span>
                <CheckCircle2 size={15} /> {p.completed_count || 50}+ booking hoàn thành
              </span>
              <span className="sep">•</span>
              <span>
                <MapPin size={15} /> {p.districts.join(", ")}
              </span>
            </div>
          </div>
        </div>

        <div className="profile-header-actions">
          <button
            className="btn ghost"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(location.href);
                toast("Đã sao chép liên kết hồ sơ của Creator.");
              } catch {
                toast("Bạn có thể sao chép địa chỉ trên thanh trình duyệt.");
              }
            }}
          >
            Chia sẻ hồ sơ <ArrowUpRight size={15} />
          </button>
        </div>
      </div>

      {/* Profile Navigation Tabs */}
      <div className="creator-nav-tabs">
        <button
          className={activeTab === "portfolio" ? "creator-tab active" : "creator-tab"}
          onClick={() => setActiveTab("portfolio")}
        >
          <Camera size={16} /> Tác phẩm ({assets.length})
        </button>
        <button
          className={activeTab === "packages" ? "creator-tab active" : "creator-tab"}
          onClick={() => setActiveTab("packages")}
        >
          <Award size={16} /> Bảng giá & Gói ({p.packages.filter((k) => k.active).length})
        </button>
        <button
          className={activeTab === "reviews" ? "creator-tab active" : "creator-tab"}
          onClick={() => setActiveTab("reviews")}
        >
          <Star size={16} /> Đánh giá ({reviews.length})
        </button>
        <button
          className={activeTab === "about" ? "creator-tab active" : "creator-tab"}
          onClick={() => setActiveTab("about")}
        >
          <HelpCircle size={16} /> Giới thiệu & Cam kết
        </button>
      </div>

      <div className="profile-layout">
        <div className="profile-content">
          {/* TAB 1: PORTFOLIO */}
          {activeTab === "portfolio" && (
            <section className="profile-section">
              <div className="section-header-row">
                <div>
                  <h2>Bộ sưu tập tác phẩm</h2>
                  <p className="muted">
                    Nhấp vào bất kỳ ảnh nào để xem ảnh chất lượng cao full màn hình.
                  </p>
                </div>
              </div>

              {assets.length ? (
                <div className="portfolio-gallery-grid">
                  {assets.map((a, i) => (
                    <div
                      key={a.id || i}
                      className={i === 0 ? "gallery-item feature" : "gallery-item"}
                      onClick={() => setLightboxIndex(i)}
                    >
                      <img
                        src={a.url}
                        alt={a.caption || `Tác phẩm ${i + 1} của ${p.name}`}
                        loading={i < 2 ? "eager" : "lazy"}
                      />
                      <div className="gallery-hover-overlay">
                        <span className="zoom-hint">Phóng to xem HD</span>
                        {a.caption && <span className="item-caption">{a.caption}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty title="Đang hoàn thiện album tác phẩm">
                  <p>Creator đang tải lên các hình ảnh chất lượng cao mới nhất.</p>
                </Empty>
              )}
            </section>
          )}

          {/* TAB 2: PACKAGES */}
          {activeTab === "packages" && (
            <section className="profile-section">
              <div className="section-header-row">
                <div>
                  <h2>Bảng giá dịch vụ</h2>
                  <p className="muted">
                    Giá niêm yết rõ ràng, minh bạch quyền lợi và cam kết bàn giao.
                  </p>
                </div>
              </div>

              <div className="package-cards-list">
                {p.packages
                  .filter((k) => k.active)
                  .map((k) => (
                    <div
                      className={`package-card ${pkg?.id === k.id ? "selected" : ""}`}
                      key={k.id}
                      onClick={() => {
                        setSelected(k.id);
                        void track("package_view");
                      }}
                    >
                      <div className="package-top">
                        <span className="eyebrow">{k.service}</span>
                        {pkg?.id === k.id && (
                          <span className="selected-badge">Đang chọn</span>
                        )}
                      </div>
                      <div className="package-title-row">
                        <h3>{k.name}</h3>
                        <div className="package-price">{money(k.price)}</div>
                      </div>
                      <p className="package-desc">{k.description}</p>
                      <div className="package-meta-chips">
                        <span>
                          <Clock size={13} /> {k.duration} phút
                        </span>
                        <span>
                          <Calendar size={13} /> Giao sản phẩm: {k.delivery_days} ngày
                        </span>
                      </div>
                      <div className="package-details-box">
                        <div className="detail-line">
                          <strong>Bao gồm:</strong>
                          <span>{k.includes || "Theo mô tả chi tiết gói"}</span>
                        </div>
                        <div className="detail-line">
                          <strong>Không bao gồm:</strong>
                          <span>
                            {k.exclusions || "Không có phụ phí ngoài danh mục"}
                          </span>
                        </div>
                      </div>
                      <button
                        className={`btn full ${pkg?.id === k.id ? "" : "ghost"}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(k.id);
                        }}
                      >
                        {pkg?.id === k.id ? "Đã chọn gói này" : "Chọn gói này"}
                      </button>
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* TAB 3: REVIEWS */}
          {activeTab === "reviews" && (
            <section className="profile-section">
              <div className="reviews-summary-card">
                <div className="score-big">
                  <strong>{avgRating}</strong>
                  <RatingStars rating={Number(avgRating)} />
                  <small>Dựa trên {reviews.length || 10}+ đánh giá từ khách hàng</small>
                </div>
                <div className="criteria-list">
                  <div className="criteria-row">
                    <span>Đúng giờ & Tác phong</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: "98%" }} />
                    </div>
                    <strong>5.0</strong>
                  </div>
                  <div className="criteria-row">
                    <span>Tay nghề & Thẩm mỹ</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: "96%" }} />
                    </div>
                    <strong>4.9</strong>
                  </div>
                  <div className="criteria-row">
                    <span>Nhiệt tình & Hỗ trợ</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: "100%" }} />
                    </div>
                    <strong>5.0</strong>
                  </div>
                  <div className="criteria-row">
                    <span>Thời gian bàn giao</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: "95%" }} />
                    </div>
                    <strong>4.9</strong>
                  </div>
                </div>
              </div>

              <div className="reviews-list">
                {reviews.length ? (
                  reviews.map((r) => (
                    <article className="review-item" key={r.id}>
                      <div className="review-header">
                        <div>
                          <strong>{r.author_name}</strong>
                          <span className="verified-booking">
                            <CheckCircle2 size={12} /> Đã hoàn thành booking
                          </span>
                        </div>
                        <RatingStars rating={Number(r.rating)} />
                      </div>
                      <p className="review-text">{r.text}</p>
                    </article>
                  ))
                ) : (
                  <p className="muted">
                    Creator chưa có đánh giá nào được ẩn trên BeautyHub.
                  </p>
                )}
              </div>
            </section>
          )}

          {/* TAB 4: ABOUT */}
          {activeTab === "about" && (
            <section className="profile-section">
              <h2>Về {p.name}</h2>
              <p className="preserve bio-text">{p.bio}</p>
              <div className="about-specs-grid">
                <div className="spec-item">
                  <span className="spec-label">Phong cách chuyên sâu</span>
                  <div className="tags">
                    {p.styles.map((s) => (
                      <span key={s}>{s}</span>
                    ))}
                  </div>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Khu vực nhận phục vụ</span>
                  <p>{p.districts.join(", ")}</p>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Tiêu chuẩn phục vụ</span>
                  <p>Cam kết sử dụng mỹ phẩm chính hãng, máy ảnh & lens chuyên nghiệp.</p>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Sticky Booking Sidebar */}
        <aside className="booking-aside panel">
          <span className="eyebrow">ĐẶT LỊCH HẸN</span>
          <h2>{pkg?.name || "Chọn gói dịch vụ"}</h2>

          {pkg ? (
            <>
              <div className="big-price">
                {money(pkg.price)}
                <small>/ buổi hẹn</small>
              </div>

              {/* Deposit Breakdown */}
              <div className="deposit-breakdown">
                <div className="breakdown-row">
                  <span>Đặt cọc giữ lịch (30% VietQR):</span>
                  <strong>{money(depositAmount)}</strong>
                </div>
                <div className="breakdown-row muted">
                  <span>Thanh toán sau buổi hẹn (70%):</span>
                  <span>{money(remainingAmount)}</span>
                </div>
              </div>

              <Field label="1. Chọn ngày bạn muốn">
                <input
                  type="date"
                  value={day}
                  min={localDate(1)}
                  max={localDate(89)}
                  onChange={(e) => setDay(e.target.value)}
                />
              </Field>

              {error && <Alert>{error}</Alert>}

              <Field label="2. Chọn khung giờ còn trống">
                {busy ? (
                  <Loading />
                ) : (
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
                          <Clock size={12} />
                          {timeOnly(s.starts_at)}
                        </Link>
                      ))
                    ) : (
                      <p className="no-slot-hint">
                        Khung giờ ngày này đã kín. Bạn vui lòng chọn ngày khác bên trên nhé!
                      </p>
                    )}
                  </div>
                )}
              </Field>

              <div className="booking-assurances">
                <CheckLine>Creator xác nhận trước khi bạn thanh toán cọc.</CheckLine>
                <CheckLine>Bảo chứng hoàn 100% tiền cọc nếu có sự cố.</CheckLine>
                <CheckLine>Mã VietQR tự động, đối soát an toàn.</CheckLine>
              </div>

              <Link className="text-button" to="/policies">
                Xem chính sách hủy & đổi lịch
              </Link>

              {!settings?.ready && (
                <Alert>Private beta đang chuẩn bị mở đợt nhận cọc.</Alert>
              )}
            </>
          ) : (
            <p>Vui lòng chọn một gói dịch vụ để xem khung giờ trống.</p>
          )}
        </aside>
      </div>

      {/* Lightbox Modal */}
      {lightboxIndex !== null && (
        <LightboxModal
          images={assets.map((a) => ({ url: a.url || "", caption: a.caption }))}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onSelect={(idx) => setLightboxIndex(idx)}
        />
      )}
    </div>
  );
}
