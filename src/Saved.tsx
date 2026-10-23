import { Link } from "react-router-dom";
import { useApp } from "./context";
import { Alert, Empty, Loading, ProviderCard } from "./ui";
export function Saved() {
  const { providers, favorites, loading, error, refresh } = useApp();
  const saved = providers.filter(
    (p) => p.status === "APPROVED" && favorites.has(p.id),
  );
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
          <button className="btn ghost" onClick={() => void refresh()}>
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
      {favorites.size > saved.length && (
        <p className="muted">
          Một số creator đã lưu đang tạm ẩn hoặc chưa nhận lịch.
        </p>
      )}
    </div>
  );
}
