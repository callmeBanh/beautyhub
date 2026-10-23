import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useCatalog } from "./useCatalog";
import { useApp } from "./context";
import { Alert, Empty, Loading, ProviderCard } from "./ui";
export function Saved() {
  const { favorites, user } = useApp();
  const [page, setPage] = useState(1);
  const result = useCatalog(
    {},
    page,
    true,
    `${user?.id}:${[...favorites].sort().join(",")}`,
  );
  const { items: saved, loading, error, total } = result;
  const pages = Math.max(1, Math.ceil(total / 12));
  useEffect(() => {
    if (!loading && !error && page > pages) setPage(pages);
  }, [loading, error, page, pages]);
  return (
    <div className="page">
      <span className="eyebrow">DÀNH RIÊNG CHO BẠN</span>
      <h1>Creator đã lưu.</h1>
      <p className="muted">
        Giữ lại những phong cách bạn yêu thích, rồi chọn người phù hợp khi có kế
        hoạch.
      </p>
      {loading ? (
        <Loading />
      ) : error ? (
        <Alert>
          {error}{" "}
          <button className="btn ghost" onClick={result.retry}>
            Thử lại
          </button>
        </Alert>
      ) : saved.length ? (
        <div className="creator-grid">
          {saved.map((p) => (
            <ProviderCard key={p.id} p={p} />
          ))}
        </div>
      ) : (
        <Empty title="Bạn chưa lưu creator nào">
          <p>
            Nhấn trái tim trên hồ sơ hoặc thẻ creator để lưu vào danh sách này.
          </p>
          <Link className="btn" to="/explore">
            Khám phá creator
          </Link>
        </Empty>
      )}
      {!loading && !error && total > 12 && (
        <nav className="section-title" aria-label="Phân trang creator đã lưu">
          <button
            className="btn ghost"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Trang trước
          </button>
          <span role="status">
            Trang {page}/{pages}
          </span>
          <button
            className="btn ghost"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            Trang sau
          </button>
        </nav>
      )}
      {!loading && !error && favorites.size > total && (
        <p className="muted">
          Một số creator đã lưu đang tạm ẩn hoặc chưa nhận lịch.
        </p>
      )}
    </div>
  );
}
