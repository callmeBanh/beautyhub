import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  HelpCircle,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { labels, money, minPrice, type Provider, type FaqItem } from "./domain";

export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Camera size={36} />
      <h3>{title}</h3>
      <div>{children}</div>
    </div>
  );
}

export function Alert({ children }: { children: ReactNode }) {
  return (
    <div className="alert" role="alert">
      {children}
    </div>
  );
}

export function Loading() {
  return (
    <div className="loading" role="status">
      <span />
      Đang tải…
    </div>
  );
}

export function Badge({ status }: { status: string }) {
  return (
    <span className={`badge status-${status.toLowerCase()}`}>
      {labels[status] || status}
    </span>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function RatingStars({ rating }: { rating: number }) {
  const rounded = Math.round(rating);
  return (
    <div className="star-rating" aria-label={`Đánh giá ${rating}/5 sao`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={14}
          fill={i <= rounded ? "#e59838" : "none"}
          color={i <= rounded ? "#e59838" : "#c4bcb0"}
        />
      ))}
    </div>
  );
}

export function ProviderCard({ p }: { p: Provider }) {
  const reviews = p.reviews.filter((r) => !r.hidden);
  const rating = reviews.length
    ? (
        reviews.reduce((a, r) => a + Number(r.rating), 0) / reviews.length
      ).toFixed(1)
    : p.rating_score
      ? p.rating_score.toFixed(1)
      : null;

  const primaryImage =
    p.portfolio_assets?.find((a) => a.approved && a.url)?.url ||
    p.avatar_url ||
    (p.category === "Photographer"
      ? "/assets/concepts/concept-muse.webp"
      : "/assets/concepts/concept-korean.webp");

  return (
    <Link className="creator-card stagger-in" to={`/creators/${p.slug}`}>
      <div className="creator-image">
        <img
          loading="lazy"
          src={primaryImage}
          alt={`Tác phẩm tiêu biểu của ${p.name}`}
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              p.category === "Photographer"
                ? "/assets/concepts/concept-muse.webp"
                : "/assets/concepts/concept-korean.webp";
          }}
        />
        <div className="card-overlay-badges">
          <span className="verified">
            <ShieldCheck size={13} />
            Đã xác minh
          </span>
          {p.response_time && (
            <span className="response-badge">
              <Clock size={11} /> ~{p.response_time}
            </span>
          )}
        </div>
        <span className="card-arrow" aria-hidden="true">
          <ArrowUpRight size={18} />
        </span>
      </div>
      <div className="creator-meta">
        <h3>{p.name}</h3>
        <span className="rating-pill">
          {rating ? (
            <>
              <Star size={13} fill="#e59838" color="#e59838" />
              <strong>{rating}</strong>
              <small>({reviews.length || 12})</small>
            </>
          ) : (
            <span className="muted">Mới tham gia</span>
          )}
        </span>
      </div>
      <p className="creator-sub">
        <span className="cat-pill">
          {p.category === "Photographer" ? <Camera size={12} /> : <Sparkles size={12} />}
          {p.category}
        </span>
        <span className="dot-sep">·</span>
        <span>{p.districts.slice(0, 2).join(", ")}</span>
      </p>
      <small className="completed-line">{p.completed_count || 50}+ booking hoàn thành</small>
      <div className="tags">
        {p.styles.slice(0, 3).map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>
      <div className="price-line">
        <span>Từ</span>{" "}
        <strong>
          {Number.isFinite(minPrice(p)) ? money(minPrice(p)) : "Đang cập nhật"}
        </strong>
      </div>
    </Link>
  );
}

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  return (
    <div className="faq-accordion">
      {items.map((item, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div key={idx} className={isOpen ? "faq-item open" : "faq-item"}>
            <button
              className="faq-question"
              onClick={() => setOpenIndex(isOpen ? null : idx)}
              aria-expanded={isOpen}
            >
              <span>{item.question}</span>
              <ChevronDown
                size={18}
                className={isOpen ? "faq-chevron rotate" : "faq-chevron"}
              />
            </button>
            {isOpen && (
              <div className="faq-answer">
                <p>{item.answer}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function LightboxModal({
  images,
  currentIndex,
  onClose,
  onSelect,
}: {
  images: { url: string; caption?: string }[];
  currentIndex: number;
  onClose: () => void;
  onSelect: (index: number) => void;
}) {
  const current = images[currentIndex];
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && currentIndex > 0) onSelect(currentIndex - 1);
      if (e.key === "ArrowRight" && currentIndex < images.length - 1)
        onSelect(currentIndex + 1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentIndex, images.length]);

  if (!current) return null;

  return (
    <div className="lightbox-backdrop" onClick={onClose}>
      <div className="lightbox-dialog" onClick={(e) => e.stopPropagation()}>
        <button
          className="lightbox-close"
          onClick={onClose}
          aria-label="Đóng ảnh"
        >
          <X size={24} />
        </button>
        {currentIndex > 0 && (
          <button
            className="lightbox-nav prev"
            onClick={() => onSelect(currentIndex - 1)}
            aria-label="Ảnh trước"
          >
            <ArrowLeft size={24} />
          </button>
        )}
        <div className="lightbox-media">
          <img src={current.url} alt={current.caption || "Tác phẩm phóng to"} />
          {current.caption && <p className="lightbox-caption">{current.caption}</p>}
        </div>
        {currentIndex < images.length - 1 && (
          <button
            className="lightbox-nav next"
            onClick={() => onSelect(currentIndex + 1)}
            aria-label="Ảnh kế tiếp"
          >
            <ArrowRight size={24} />
          </button>
        )}
        <div className="lightbox-counter">
          {currentIndex + 1} / {images.length}
        </div>
      </div>
    </div>
  );
}

export function FloatingContact({ supportUrl }: { supportUrl?: string }) {
  const target = supportUrl || "https://zalo.me/beautyhub";
  return (
    <div className="floating-contact">
      <a
        href={target}
        target="_blank"
        rel="noreferrer"
        className="floating-btn"
        aria-label="Chat hỗ trợ Zalo"
      >
        <span className="floating-ping" />
        <MessageCircle size={20} />
        <span className="floating-text">Hỗ trợ 24/7</span>
      </a>
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const el = document.getElementById("active-dialog");
    el?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const focusable = el?.querySelectorAll<HTMLElement>(
          "button,input,select,textarea,a[href]",
        );
        if (!focusable?.length) return;
        const first = focusable[0],
          last = focusable[focusable.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === el)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="modal"
        id="active-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        tabIndex={-1}
      >
        <button className="close" onClick={onClose} aria-label="Đóng">
          ×
        </button>
        <h2 id="dialog-title">{title}</h2>
        {children}
      </section>
    </div>
  );
}

export function Steps() {
  return (
    <div className="trust-steps">
      {[
        [
          "01",
          "Chọn gu & Xem tác phẩm thật",
          "Duyệt các bộ ảnh và layout thật 100%, biết rõ giá niêm yết và thời gian còn trống.",
        ],
        [
          "02",
          "Đặt lịch & Giữ cọc 30%",
          "Creator xác nhận nhận lịch trước khi bạn chuyển cọc qua VietQR minh bạch.",
        ],
        [
          "03",
          "Tận hưởng buổi hẹn chu đáo",
          "Được hướng dẫn tạo dáng, dặm phấn kỹ càng và chăm chút suốt buổi chụp.",
        ],
        [
          "04",
          "Nhận ảnh hoàn thiện & Đánh giá",
          "Bàn giao toàn bộ ảnh gốc và ảnh chỉnh màu đúng hạn. Đánh giá chất lượng 4 tiêu chí.",
        ],
      ].map(([n, t, d]) => (
        <article key={n} className="stagger-in">
          <span>{n}</span>
          <h3>{t}</h3>
          <p>{d}</p>
        </article>
      ))}
    </div>
  );
}

export function CheckLine({ children }: { children: ReactNode }) {
  return (
    <p className="check-line">
      <Check size={16} />
      {children}
    </p>
  );
}

export function Breadcrumb({ label }: { label: string }) {
  return (
    <div className="breadcrumb">
      <Link to="/">Trang chủ</Link>
      <ChevronRight size={12} />
      {label}
    </div>
  );
}

export function useClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  return now;
}
