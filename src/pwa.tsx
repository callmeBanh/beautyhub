import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { Download, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";
import { Alert } from "./ui";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
type PwaState = {
  installed: boolean;
  canInstall: boolean;
  updateReady: boolean;
  error: string;
  install: () => Promise<void>;
  update: () => void;
};
const PwaContext = createContext<PwaState>(null!);
export const usePwa = () => useContext(PwaContext);
export function PwaProvider({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [worker, setWorker] = useState<ServiceWorker | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const display = matchMedia("(display-mode: standalone)");
    const check = () =>
      setInstalled(
        display.matches ||
          Boolean(
            (navigator as Navigator & { standalone?: boolean }).standalone,
          ),
      );
    check();
    display.addEventListener("change", check);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      display.removeEventListener("change", check);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    let active = true;
    let registration: ServiceWorkerRegistration | undefined;
    const inspect = () => {
      if (active && registration?.waiting && navigator.serviceWorker.controller)
        setWorker(registration.waiting);
    };
    const start = async () => {
      try {
        registration = await navigator.serviceWorker.register("/sw.js", {
          updateViaCache: "none",
        });
        inspect();
        registration.addEventListener("updatefound", () => {
          registration?.installing?.addEventListener("statechange", inspect);
        });
      } catch {
        if (active)
          setError(
            "Chưa chuẩn bị được chế độ cài đặt/ngoại tuyến. Bạn vẫn có thể sử dụng website khi có mạng.",
          );
      }
    };
    void start();
    const onVisible = () => {
      if (document.visibilityState === "visible" && navigator.onLine)
        void registration?.update().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  async function install() {
    if (!prompt) return;
    setError("");
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      setError(
        "Không mở được cửa sổ cài đặt. Hãy dùng menu cài ứng dụng của trình duyệt.",
      );
    } finally {
      setPrompt(null);
    }
  }
  function update() {
    if (!worker || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => location.reload(),
      { once: true },
    );
    worker.postMessage({ type: "SKIP_WAITING" });
  }
  return (
    <PwaContext.Provider
      value={{
        installed,
        canInstall: Boolean(prompt),
        updateReady: Boolean(worker),
        error,
        install,
        update,
      }}
    >
      {children}
    </PwaContext.Provider>
  );
}

export function UpdateNotice() {
  const { updateReady, update } = usePwa();
  const [dismissed, setDismissed] = useState(false);
  if (!updateReady || dismissed) return null;
  return (
    <section
      className="app-update"
      role="status"
      aria-label="Bản cập nhật ứng dụng"
    >
      <div>
        <strong>BeautyHub có phiên bản mới</strong>
        <p>Lưu biểu mẫu đang nhập trước khi cập nhật. Trang sẽ được tải lại.</p>
      </div>
      <button className="btn small" onClick={update}>
        <RefreshCw size={16} />
        Cập nhật
      </button>
      <button className="text-button" onClick={() => setDismissed(true)}>
        Để sau
      </button>
    </section>
  );
}

export function InstallPage() {
  const { installed, canInstall, install, error, updateReady, update } =
    usePwa();
  return (
    <div className="page narrow install-page">
      <img
        className="app-icon"
        src="/icons/icon-192.png"
        width={96}
        height={96}
        alt=""
      />
      <span className="eyebrow">BEAUTYHUB TRÊN ĐIỆN THOẠI</span>
      <h1>
        Khoảnh khắc của bạn.
        <br />
        Luôn ở gần.
      </h1>
      <p className="muted">
        Thêm BeautyHub vào màn hình chính để mở nhanh creator yêu thích và lịch
        hẹn, với cùng một tài khoản như trên website.
      </p>
      {installed ? (
        <p className="success" role="status">
          Bạn đang dùng BeautyHub ở chế độ ứng dụng.
        </p>
      ) : canInstall ? (
        <button className="btn" onClick={() => void install()}>
          <Download size={18} />
          Cài BeautyHub
        </button>
      ) : (
        <p className="info-banner">
          Dùng hướng dẫn bên dưới để thêm ứng dụng. Tùy thiết bị, trình duyệt có
          thể chưa hiện nút cài tự động.
        </p>
      )}
      {error && <Alert>{error}</Alert>}
      <div className="install-instructions">
        <section className="panel">
          <Smartphone size={24} />
          <h2>iPhone / iPad</h2>
          <ol>
            <li>Mở BeautyHub bằng Safari.</li>
            <li>
              Nhấn Chia sẻ, chọn <strong>Thêm vào màn hình chính</strong>.
            </li>
            <li>
              Bật mở dưới dạng ứng dụng nếu thiết bị có tùy chọn, rồi nhấn Thêm.
            </li>
          </ol>
        </section>
        <section className="panel">
          <Download size={24} />
          <h2>Android / máy tính</h2>
          <ol>
            <li>Mở BeautyHub bằng Chrome hoặc Edge.</li>
            <li>
              Chọn <strong>Cài đặt ứng dụng</strong> hoặc{" "}
              <strong>Thêm vào màn hình chính</strong> trong menu trình duyệt.
            </li>
            <li>Xác nhận và mở biểu tượng BeautyHub.</li>
          </ol>
        </section>
        <section className="panel">
          <ShieldCheck size={24} />
          <h2>Khi mất mạng</h2>
          <p>
            Ứng dụng có màn hình giúp bạn kết nối lại. Đặt lịch, báo chuyển
            tiền, hoàn tiền và tải ảnh cần mạng; yêu cầu không được xếp hàng gửi
            ngầm.
          </p>
          <p>
            Chỉ tài nguyên giao diện công khai được lưu ngoại tuyến. Lịch hẹn,
            địa chỉ và ảnh riêng tư không nằm trong bộ nhớ cache của ứng dụng.
          </p>
          <p>
            Thông báo hiện được kiểm tra trong BeautyHub; chưa có thông báo đẩy
            ra màn hình khóa.
          </p>
        </section>
      </div>
      {updateReady && (
        <section className="panel">
          <h2>Phiên bản mới đã sẵn sàng</h2>
          <p>Lưu biểu mẫu trước khi tải lại.</p>
          <button className="btn" onClick={update}>
            Cập nhật ứng dụng
          </button>
        </section>
      )}
      <Link className="btn ghost" to="/explore">
        Khám phá creator
      </Link>
    </div>
  );
}
