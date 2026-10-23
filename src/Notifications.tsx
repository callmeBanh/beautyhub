import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bell } from "lucide-react";
import { client, rpc } from "./api";
import { useApp } from "./context";
import { dateTime, errorText, labels, type Notice } from "./domain";
import { Alert, Empty, Loading } from "./ui";

export function useUnreadNotifications() {
  const { user, authLoading } = useApp();
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    setCount(0);
    if (!user || authLoading) return;
    async function load() {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      try {
        const result = await client()
          .from("notifications")
          .select("id", { head: true, count: "exact" })
          .is("read_at", null);
        if (active && !result.error) setCount(result.count || 0);
      } catch {
        /* A badge must not interrupt booking. */
      }
    }
    void load();
    const timer = setInterval(() => void load(), 30000);
    window.addEventListener("online", load);
    window.addEventListener("beautyhub:notices-read", load);
    document.addEventListener("visibilitychange", load);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("online", load);
      window.removeEventListener("beautyhub:notices-read", load);
      document.removeEventListener("visibilitychange", load);
    };
  }, [user?.id, authLoading]);
  return count;
}

export function Notifications() {
  const { user } = useApp();
  const [items, setItems] = useState<Notice[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const generation = useRef(0);
  async function load() {
    const version = ++generation.current;
    try {
      const result = await client()
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (version !== generation.current) return;
      if (result.error) throw result.error;
      setItems(result.data || []);
      setError("");
    } catch (e) {
      if (version === generation.current) setError(errorText(e));
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    const poll = () => {
      if (document.visibilityState === "visible" && navigator.onLine)
        void load();
    };
    const timer = setInterval(poll, 30000);
    document.addEventListener("visibilitychange", poll);
    window.addEventListener("online", poll);
    return () => {
      generation.current++;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
      window.removeEventListener("online", poll);
    };
  }, [user?.id]);
  return (
    <div className="page narrow">
      <span className="eyebrow">CẬP NHẬT</span>
      <h1>Thông báo của bạn</h1>
      <p className="muted">
        Cập nhật trong ứng dụng khi có mạng; thông báo chưa được gửi ra màn hình
        khóa.
      </p>
      <div className="actions">
        <button
          className="btn ghost"
          disabled={busy || loading}
          onClick={() => {
            setLoading(true);
            void load();
          }}
        >
          Làm mới thông báo
        </button>
        {items.some((n) => !n.read_at) && (
          <button
            className="text-button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await rpc("mark_notifications_read");
                await load();
                window.dispatchEvent(new Event("beautyhub:notices-read"));
              } catch (e) {
                setError(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Đánh dấu đã đọc
          </button>
        )}
      </div>
      {error && <Alert>{error}</Alert>}
      {loading ? (
        <Loading />
      ) : items.length ? (
        <div className="notification-list">
          {items.map((n) => (
            <Link
              className={n.read_at ? "notice" : "notice unread"}
              to={n.booking_id ? `/bookings/${n.booking_id}` : "/studio"}
              key={n.id}
            >
              <Bell size={18} />
              <div>
                <strong>{labels[n.text] || n.text}</strong>
                <small>{dateTime(n.created_at)}</small>
                {!n.read_at && <small>Chưa đọc</small>}
              </div>
              <ArrowRight size={16} />
            </Link>
          ))}
        </div>
      ) : (
        !error && (
          <Empty title="Bạn chưa có thông báo">
            Các cập nhật về booking sẽ xuất hiện tại đây.
          </Empty>
        )
      )}
    </div>
  );
}
