import { useEffect, useState, type JSX } from "react";
import { client, rpc } from "./api";
import { Alert, Loading } from "./ui";
import { useApp } from "./context";
import { errorText, labels } from "./domain";

type SubscriptionRecord = {
  provider_id: string;
  current_period_end: string | null;
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleDateString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function AdminSubscriptions(props: {
  providers: { id: string; name: string; status: string }[];
}): JSX.Element {
  const { toast } = useApp();
  const [subs, setSubs] = useState<Record<string, string | null>>({});
  const [daysMap, setDaysMap] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadSubscriptions() {
    const { data, error: err } = await client()
      .from("creator_subscriptions")
      .select("provider_id,current_period_end");
    if (err) throw err;
    const map: Record<string, string | null> = {};
    for (const row of (data || []) as SubscriptionRecord[]) {
      map[row.provider_id] = row.current_period_end;
    }
    setSubs(map);
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadSubscriptions()
      .catch((err: unknown) => {
        if (active) setError(errorText(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleExtend(providerId: string, name: string) {
    const raw = Number(daysMap[providerId] ?? "30");
    const days = Math.max(1, Math.min(365, Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 30));
    if (!window.confirm(`Gia hạn ${days} ngày cho ${name}?`)) return;

    setBusyId(providerId);
    setError("");
    try {
      await rpc("admin_extend_subscription", { p_provider_id: providerId, p_days: days });
      await loadSubscriptions();
      toast(`Đã gia hạn ${days} ngày.`);
    } catch (err: unknown) {
      setError(errorText(err));
    } finally {
      setBusyId(null);
    }
  }

  const now = Date.now();
  const sorted = [...props.providers].sort((a, b) => {
    const msA = subs[a.id] ? Date.parse(subs[a.id]!) : NaN;
    const msB = subs[b.id] ? Date.parse(subs[b.id]!) : NaN;
    const activeA = Number.isFinite(msA) && msA > now;
    const activeB = Number.isFinite(msB) && msB > now;
    if (activeA !== activeB) return activeA ? -1 : 1;
    return a.name.localeCompare(b.name, "vi");
  });

  return (
    <section
      className="panel table-wrap"
      tabIndex={0}
      role="region"
      aria-label="Danh sách gói Creator"
    >
      {error && <Alert>{error}</Alert>}
      {loading && Object.keys(subs).length === 0 ? (
        <Loading />
      ) : props.providers.length === 0 ? (
        <p className="muted">Chưa có creator nào.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Creator</th>
              <th scope="col">Trạng thái</th>
              <th scope="col">Hạn dùng</th>
              <th scope="col">Gia hạn thủ công</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const end = subs[p.id];
              const ms = end ? Date.parse(end) : NaN;
              const hasPeriod = Number.isFinite(ms);
              const isActive = hasPeriod && ms > now;
              const statusText = hasPeriod ? (isActive ? "Đang hoạt động" : "Hết hạn") : "Free";
              const statusClass = isActive ? "approved" : hasPeriod ? "rejected" : "draft";

              return (
                <tr key={p.id}>
                  <th scope="row">
                    <strong>{p.name}</strong>
                    <div className="muted">{labels[p.status] || p.status}</div>
                  </th>
                  <td>
                    <span className={`badge status-${statusClass}`}>{statusText}</span>
                  </td>
                  <td>{hasPeriod ? formatDate(end) : "—"}</td>
                  <td>
                    <div className="inline-actions">
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={daysMap[p.id] ?? "30"}
                        onChange={(e) => setDaysMap((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        aria-label={`Số ngày gia hạn cho ${p.name}`}
                        disabled={busyId === p.id}
                      />
                      <button
                        type="button"
                        className="btn small"
                        disabled={busyId === p.id}
                        onClick={() => void handleExtend(p.id, p.name)}
                      >
                        Gia hạn
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
