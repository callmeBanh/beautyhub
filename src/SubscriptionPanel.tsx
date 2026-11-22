import { useEffect, useState, type JSX } from "react";
import { BadgeCheck, Check } from "lucide-react";
import { client } from "./api";
import { Alert, Loading } from "./ui";
import { useApp } from "./context";

export type SubscriptionSettings = {
  subscription_price_vnd: number;
  subscription_period_days: number;
  subscription_enforced: boolean;
  free_portfolio_limit: number;
};

type SubscriptionRecord = {
  current_period_end: string | null;
};

function fmt(d: string): string {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function SubscriptionPanel({
  providerId,
  settings,
}: {
  providerId: string;
  settings: SubscriptionSettings | null;
}): JSX.Element {
  const { toast } = useApp();
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pollStatus, setPollStatus] = useState<"idle" | "polling" | "success" | "timeout">("idle");
  const [isCancelled] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("cancel") === "true",
  );

  useEffect(() => {
    let active = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    async function fetchSub() {
      return client()
        .from("creator_subscriptions")
        .select("current_period_end")
        .eq("provider_id", providerId)
        .maybeSingle();
    }

    async function init() {
      try {
        const { data, error } = await fetchSub();
        if (!active) return;
        if (error) {
          setFetchError("Không thể tải thông tin gói dịch vụ. Vui lòng tải lại trang.");
        } else {
          setSubscription(data ?? null);
        }
        setLoading(false);

        const initialEnd = data?.current_period_end ?? null;
        const params = new URLSearchParams(window.location.search);
        const cancelled = params.get("cancel") === "true";
        const isReturning = (params.get("status") === "PAID" || Boolean(params.get("orderCode"))) && !cancelled;
        if (!isReturning) return;

        setPollStatus("polling");
        intervalId = setInterval(async () => {
          try {
            const { data: latest, error: pollError } = await fetchSub();
            if (!active || pollError) return;
            const newEnd = latest?.current_period_end ?? null;
            const isUpdated =
              Boolean(newEnd) &&
              (!initialEnd || new Date(newEnd!).getTime() > new Date(initialEnd).getTime());
            if (isUpdated) {
              setSubscription(latest ?? null);
              setPollStatus("success");
              toast("Gói Creator đã được kích hoạt.");
              if (intervalId) clearInterval(intervalId);
              if (timeoutId) clearTimeout(timeoutId);
            }
          } catch {
            // Ignore transient polling errors
          }
        }, 3000);

        timeoutId = setTimeout(() => {
          if (!active) return;
          if (intervalId) clearInterval(intervalId);
          setPollStatus((prev) => (prev === "polling" ? "timeout" : prev));
        }, 60000);
      } catch {
        if (active) {
          setFetchError("Không thể tải thông tin gói dịch vụ.");
          setLoading(false);
        }
      }
    }

    void init();
    return () => {
      active = false;
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [providerId, toast]);

  async function handleSubscribe() {
    setBusy(true);
    setActionError(null);
    try {
      const { data, error } = await client().functions.invoke<{ checkoutUrl?: string }>(
        "create-subscription-link",
        { body: {} },
      );
      if (error) throw error;
      if (!data?.checkoutUrl) throw new Error("Missing checkout URL");
      window.location.assign(data.checkoutUrl);
    } catch {
      setActionError("Không thể tạo liên kết thanh toán payOS. Vui lòng thử lại sau.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;

  const priceVnd = `${(settings?.subscription_price_vnd ?? 99000).toLocaleString("vi-VN")}đ`;
  const periodDays = settings?.subscription_period_days ?? 30;
  const freeLimit = settings?.free_portfolio_limit ?? 10;
  const currentPeriodEnd = subscription?.current_period_end ?? null;
  const endMs = currentPeriodEnd ? Date.parse(currentPeriodEnd) : NaN;
  const hasEnd = Number.isFinite(endMs);
  const now = Date.now();
  const isActive = hasEnd && endMs > now;
  const isExpired = hasEnd && endMs <= now;
  const isFree = !hasEnd;
  const daysLeft = isActive ? Math.max(1, Math.ceil((endMs - now) / 86400000)) : 0;
  const isExpiringSoon = isActive && daysLeft <= 5;

  const buttonLabel = busy
    ? "Đang chuyển tới payOS…"
    : isFree
      ? `Kích hoạt Gói Creator — ${priceVnd} / ${periodDays} ngày`
      : isActive
        ? `Gia hạn thêm ${periodDays} ngày`
        : "Gia hạn";

  return (
    <div className="panel">
      {settings?.subscription_enforced === false && (
        <div className="info-banner">
          Hiện BeautyHub chưa bật giới hạn — bạn vẫn nhận booking bình thường. Gói sẽ bắt buộc từ khi BeautyHub thông báo.
        </div>
      )}
      {isCancelled && <div className="info-banner">Bạn đã huỷ thanh toán.</div>}
      {pollStatus === "polling" && <div className="info-banner">Đang xác nhận thanh toán…</div>}
      {pollStatus === "timeout" && (
        <div className="info-banner">
          Thanh toán đang được xử lý. Tải lại trang sau ít phút nếu chưa thấy cập nhật.
        </div>
      )}
      {isExpiringSoon && <div className="info-banner">Gói sắp hết hạn trong {daysLeft} ngày.</div>}
      {fetchError && <Alert>{fetchError}</Alert>}

      <div aria-live="polite">
        <span className="eyebrow">Gói dịch vụ</span>
        {isFree && <h2>Tài khoản Free</h2>}
        {isActive && (
          <>
            <h2>Gói Creator</h2>
            <p>Đang hoạt động đến {fmt(currentPeriodEnd!)}</p>
          </>
        )}
        {isExpired && (
          <>
            <h2>Gói Creator</h2>
            <p>
              Đã hết hạn ngày {fmt(currentPeriodEnd!)}. Booking đã xác nhận trước đó vẫn giữ nguyên; bạn chưa nhận được booking mới.
            </p>
          </>
        )}
      </div>

      <div className="metrics">
        <div className="metric">
          <small>Gói hiện tại</small>
          <strong>{isFree ? "Free" : "Creator"}</strong>
        </div>
        <div className="metric">
          <small>Trạng thái</small>
          <strong>{isFree ? "Miễn phí" : isActive ? "Hoạt động" : "Hết hạn"}</strong>
        </div>
        <div className="metric">
          <small>Hạn dùng</small>
          <strong>{hasEnd ? fmt(currentPeriodEnd!) : "—"}</strong>
        </div>
        <div className="metric">
          <small>Phí duy trì</small>
          <strong>{priceVnd}</strong>
        </div>
      </div>

      <div>
        <button type="button" className="btn" disabled={busy} onClick={() => void handleSubscribe()}>
          <BadgeCheck size={18} aria-hidden="true" />
          {buttonLabel}
        </button>
        {isActive && (
          <p className="muted" style={{ marginTop: "10px" }}>
            Gia hạn khi còn hạn sẽ được cộng nối vào ngày hết hạn hiện tại.
          </p>
        )}
      </div>

      {actionError && (
        <div style={{ marginTop: "16px" }}>
          <Alert>{actionError}</Alert>
        </div>
      )}

      <section style={{ marginTop: "28px" }}>
        <h3>Quyền lợi Gói Creator</h3>
        {[
          "Nhận booking mới từ khách",
          `Không bị giới hạn ảnh Free (Free tối đa ${freeLimit} ảnh, Gói Creator tối đa 12 ảnh)`,
          "Không hoa hồng — chỉ phí gói cố định",
        ].map((item) => (
          <div className="list-row" key={item}>
            <Check size={18} aria-hidden="true" />
            <div>
              <strong>{item}</strong>
            </div>
          </div>
        ))}
        <p className="muted" style={{ marginTop: "14px" }}>
          BeautyHub không cam kết số lượng booking.
        </p>
      </section>
    </div>
  );
}
