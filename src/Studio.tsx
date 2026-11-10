import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  CalendarDays,
  Camera,
  Clock,
  DollarSign,
  FileText,
  Gift,
  ImagePlus,
  LayoutDashboard,
  Package as PackageIcon,
  Plus,
  Settings,
  Sparkles,
  Star,
  Upload,
} from "lucide-react";
import { client, compressImage, rpc } from "./api";
import { useApp } from "./context";
import {
  dateTime,
  DISTRICTS,
  deliveryDaysLabel,
  durationHoursToMinutes,
  durationMinutesToHours,
  effectiveStatus,
  errorText,
  formatDuration,
  localDate,
  money,
  validatePayoutAccount,
  SERVICES,
  serviceLabel,
  STYLES,
  validatePackageDetails,
  type Booking,
  type Package,
  type PackageDetailsInput,
  type PayoutAccount,
} from "./domain";
import { buildVietQrUrl, VIETQR_BANKS } from "./vietqr";
import {
  Alert,
  Badge,
  Empty,
  Field,
  FormattedCopy,
  Loading,
  Modal,
} from "./ui";
import { BookingCard } from "./Bookings";

type PackageDraft = {
  name: string;
  service: string;
  description: string;
  price: string;
  duration: string;
  days: string;
  original_photo_count: string;
  edited_photo_count: string;
  revision_count: string;
  included_items: string;
  customer_benefits: string;
  includes: string;
  exclusions: string;
  active: boolean;
};
type PackageSavePayload = {
  id: string | null;
  name: string;
  service: string;
  description: string;
  duration: number;
  price: number;
  days: number;
  includes: string;
  exclusions: string;
  active: boolean;
  details: PackageDetailsInput;
};
function packageDraft(item: Package | "new"): PackageDraft {
  if (item === "new") {
    return {
      name: "",
      service: "Personal",
      description: "",
      price: "",
      duration: "",
      days: "",
      original_photo_count: "",
      edited_photo_count: "",
      revision_count: "",
      included_items: "",
      customer_benefits: "",
      includes: "",
      exclusions: "",
      active: true,
    };
  }
  return {
    name: item.name,
    service: item.service,
    description: item.description,
    price: String(item.price),
    duration: durationMinutesToHours(item.duration),
    days: item.delivery_days == null ? "" : String(item.delivery_days),
    original_photo_count: String(item.original_photo_count ?? ""),
    edited_photo_count: String(item.edited_photo_count ?? ""),
    revision_count: String(item.revision_count ?? ""),
    included_items: (item.included_items || []).join("\n"),
    customer_benefits: (item.customer_benefits || []).join("\n"),
    includes: item.includes,
    exclusions: item.exclusions,
    active: item.active,
  };
}
function packageLines(value: string) {
  const items = value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : null;
}
function PayoutAccountEditor({
  providerId,
  account,
  busy,
  onSave,
}: {
  providerId: string;
  account: PayoutAccount | null;
  busy: boolean;
  onSave: (value: Omit<PayoutAccount, "updated_at">) => Promise<void>;
}) {
  const [bankBin, setBankBin] = useState(account?.bank_bin || "");
  const [accountNumber, setAccountNumber] = useState(
    account?.account_number || "",
  );
  const [accountName, setAccountName] = useState(account?.account_name || "");
  const [error, setError] = useState("");
  const bank = VIETQR_BANKS.find((item) => item.bin === bankBin);
  const data = {
    bank_bin: bankBin,
    bank_name: bank?.shortName || "",
    account_number: accountNumber.trim(),
    account_name: accountName.trim(),
  };
  const validation = validatePayoutAccount(data);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (validation) {
      setError(validation);
      return;
    }
    try {
      setError("");
      await onSave({ provider_id: providerId, ...data });
    } catch (e) {
      setError(errorText(e));
    }
  }
  return (
    <section className="panel">
      <h2>Thông tin nhận cọc trực tiếp</h2>
      <p className="muted">
        Khách chuyển tiền trực tiếp cho bạn qua VietQR. BeautyHub không nhận hay
        giữ tiền cọc.
      </p>
      {error && <Alert>{error}</Alert>}
      <form className="form-grid" onSubmit={(event) => void submit(event)}>
        <Field label="Ngân hàng">
          <select
            required
            value={bankBin}
            onChange={(event) => setBankBin(event.target.value)}
          >
            <option value="">Chọn ngân hàng</option>
            {VIETQR_BANKS.map((item) => (
              <option key={item.bin} value={item.bin}>
                {item.shortName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Số tài khoản" hint="Từ 6 đến 19 chữ số.">
          <input
            required
            inputMode="numeric"
            pattern="[0-9]{6,19}"
            maxLength={19}
            value={accountNumber}
            onChange={(event) => setAccountNumber(event.target.value)}
          />
        </Field>
        <Field label="Tên chủ tài khoản" hint="IN HOA, không dấu, tối đa 50 ký tự.">
          <input
            required
            maxLength={50}
            pattern="[A-Z0-9 ]{1,50}"
            value={accountName}
            onChange={(event) => setAccountName(event.target.value)}
          />
        </Field>
        <button className="btn" disabled={busy || Boolean(validation)}>
          {busy ? "Đang lưu…" : "Lưu thông tin nhận cọc"}
        </button>
      </form>
      {!validation && (
        <div className="deposit-qr-preview">
          <h3>Xem trước QR thử · 300.000đ · mã BH TEST</h3>
          <img
            src={buildVietQrUrl({
              bankBin,
              accountNo: accountNumber,
              accountHolder: accountName,
              amount: 300000,
              memo: "BH TEST",
            })}
            alt="QR chuyển khoản thử nghiệm"
            width={240}
            height={240}
          />
        </div>
      )}
    </section>
  );
}
function parsePackagePrice(value: string) {
  const trimmed = value.trim();
  if (!/^(?:\d+|\d{1,3}(?:[.,]\d{3})+)$/.test(trimmed)) return null;
  return Number(trimmed.replace(/[.,]/g, ""));
}
function packageDraftErrors(draft: PackageDraft) {
  const errors: Record<string, string> = {};
  const price = parsePackagePrice(draft.price);
  const duration = durationHoursToMinutes(draft.duration);
  const days = Number(draft.days);
  if (draft.name.trim().length < 2 || draft.name.trim().length > 100)
    errors.name = "Nhập tên gói từ 2 đến 100 ký tự.";
  if (draft.description.trim().length < 10 || draft.description.length > 2000)
    errors.description = "Mô tả cần từ 10 đến 2.000 ký tự.";
  if (price === null || price < 100000 || price > 100000000)
    errors.price = "Giá phải từ 100.000 đến 100.000.000đ.";
  if (duration === null)
    errors.duration = "Nhập từ 0,5 đến 8 giờ theo bước 0,5.";
  if (!/^\d+$/.test(draft.days) || days < 0 || days > 60)
    errors.days = "Nhập số ngày làm việc từ 0 đến 60.";
  for (const [key, label, max] of [
    ["original_photo_count", "Số ảnh gốc", 500],
    ["edited_photo_count", "Số ảnh chỉnh sửa", 500],
    ["revision_count", "Số lần chỉnh sửa", 20],
  ] as const) {
    const value = draft[key];
    if (value && (!/^\d+$/.test(value) || Number(value) > max))
      errors[key] = `${label} phải là số nguyên từ 0 đến ${max}.`;
  }
  if (!draft.includes.trim()) errors.includes = "Nhập thông tin đã tính trong giá.";
  const detailsError = validatePackageDetails({
    original_photo_count: draft.original_photo_count
      ? Number(draft.original_photo_count)
      : null,
    edited_photo_count: draft.edited_photo_count
      ? Number(draft.edited_photo_count)
      : null,
    revision_count: draft.revision_count ? Number(draft.revision_count) : null,
    included_items: packageLines(draft.included_items),
    customer_benefits: packageLines(draft.customer_benefits),
  });
  if (detailsError) {
    if (detailsError.startsWith("Số ảnh gốc")) errors.original_photo_count = detailsError;
    else if (detailsError.startsWith("Số ảnh chỉnh sửa"))
      errors.edited_photo_count = detailsError;
    else if (detailsError.startsWith("Số lần chỉnh sửa"))
      errors.revision_count = detailsError;
    else if (detailsError.startsWith("Quyền lợi"))
      errors.customer_benefits = detailsError;
    else if (detailsError.includes("danh sách"))
      errors.included_items = detailsError;
    else if (detailsError.includes("quyền lợi"))
      errors.customer_benefits = detailsError;
    else errors.included_items = detailsError;
  }
  return errors;
}

function PackageEditor({
  item,
  category,
  error,
  busy,
  onClose,
  onSave,
}: {
  item: Package | "new";
  category: string;
  error: string;
  busy: boolean;
  onClose: () => void;
  onSave: (payload: PackageSavePayload) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(() => packageDraft(item));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const photoService = category === "Photographer";
  const includedPlaceholder = photoService
    ? "Trang phục hỗ trợ\nĐịa điểm chụp\n2 concept ngoại cảnh"
    : "Trang điểm dự tiệc\nPhụ kiện tóc\nTạo kiểu tóc";
  const previewDuration =
    durationHoursToMinutes(draft.duration) || (item === "new" ? 0 : item.duration);
  const previewPrice = parsePackagePrice(draft.price);
  function update<K extends keyof PackageDraft>(key: K, value: PackageDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: "" }));
  }
  const fieldErrorProps = (key: keyof PackageDraft) => ({
    "aria-invalid": Boolean(fieldErrors[key]),
    "aria-describedby": fieldErrors[key] ? `package-${key}-error` : undefined,
  });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = packageDraftErrors(draft);
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) return;
    const details: PackageDetailsInput = {
      original_photo_count: draft.original_photo_count
        ? Number(draft.original_photo_count)
        : null,
      edited_photo_count: draft.edited_photo_count
        ? Number(draft.edited_photo_count)
        : null,
      revision_count: draft.revision_count ? Number(draft.revision_count) : null,
      included_items: packageLines(draft.included_items),
      customer_benefits: packageLines(draft.customer_benefits),
    };
    const saved = await onSave({
      id: item === "new" ? null : item.id,
      name: draft.name.trim(),
      service: draft.service,
      description: draft.description.trim(),
      duration: durationHoursToMinutes(draft.duration)!,
      price: parsePackagePrice(draft.price)!,
      days: Number(draft.days),
      includes: draft.includes.trim(),
      exclusions: draft.exclusions.trim(),
      active: draft.active,
      details,
    });
    if (saved) onClose();
  }
  const errorFor = (key: keyof PackageDraft, id = `package-${key}-error`) =>
    fieldErrors[key] ? (
      <small className="field-error" id={id} role="alert">
        {fieldErrors[key]}
      </small>
    ) : null;
  return (
    <Modal
      title={item === "new" ? "Tạo gói dịch vụ" : "Chỉnh sửa gói"}
      onClose={onClose}
      className="package-editor-modal"
    >
      <div className="package-editor-layout">
        <form className="form-grid package-editor-form" noValidate onSubmit={submit}>
          {error && <Alert>{error}</Alert>}
          <section className="package-form-section">
            <h3>
              <FileText size={18} /> Thông tin cơ bản
            </h3>
            <Field label="Tên gói">
              <input
                name="name"
                required
                minLength={2}
                maxLength={100}
                value={draft.name}
                placeholder={
                  photoService
                    ? "VD: Chụp kỷ yếu nhóm 5 người"
                    : "VD: Trang điểm dự tiệc"
                }
                {...fieldErrorProps("name")}
                onChange={(event) => update("name", event.target.value)}
              />
              {errorFor("name", "package-name-error")}
            </Field>
            <div className="field">
              <span>Dịch vụ</span>
              <div className="package-service-summary">
                {photoService ? <Camera size={19} /> : <Sparkles size={19} />}
                <strong>
                  {photoService ? "Nhiếp ảnh" : "Trang điểm"}
                </strong>
                <small>Theo dịch vụ chính trong hồ sơ creator.</small>
              </div>
            </div>
            <fieldset className="package-need-group">
              <legend>Nhu cầu</legend>
              <div className="package-need-options" role="group" aria-label="Chọn nhu cầu của gói">
                {SERVICES.map((service) => (
                  <button
                    key={service}
                    type="button"
                    className={
                      draft.service === service
                        ? "package-need-option selected"
                        : "package-need-option"
                    }
                    aria-pressed={draft.service === service}
                    onClick={() => update("service", service)}
                  >
                    {service === "anniversary" ? (
                      <Gift size={16} aria-hidden="true" />
                    ) : service === "Couple" ? (
                      <Sparkles size={16} aria-hidden="true" />
                    ) : (
                      <Camera size={16} aria-hidden="true" />
                    )}
                    {serviceLabel(service)}
                  </button>
                ))}
              </div>
            </fieldset>
            <Field label="Mô tả">
              <textarea
                name="description"
                required
                minLength={10}
                maxLength={2000}
                rows={3}
                value={draft.description}
                placeholder="VD: Combo chụp ngoại cảnh 2 concept, có chỉnh sửa màu và tư vấn dáng"
                {...fieldErrorProps("description")}
                onChange={(event) => update("description", event.target.value)}
              />
              {errorFor("description")}
            </Field>
          </section>

          <section className="package-form-section">
            <h3>
              <DollarSign size={18} /> Giá và thời gian
            </h3>
            <div className="form-grid two">
              <Field label="Giá (VND)" hint="Nhập số tiền; dấu chấm hoặc phẩy phân cách hàng nghìn đều được.">
                <input
                  type="text"
                  inputMode="numeric"
                  name="price"
                  required
                  value={draft.price}
                  placeholder="VD: 900.000"
                  {...fieldErrorProps("price")}
                  onChange={(event) => update("price", event.target.value)}
                />
                {errorFor("price")}
              </Field>
              <Field
                label="Thời gian thực hiện (giờ)"
                hint="Tối thiểu 0,5 giờ; nhập theo bước 0,5."
              >
                <input
                  type="text"
                  inputMode="decimal"
                  name="duration"
                  required
                  value={draft.duration}
                  placeholder="VD: 2"
                  {...fieldErrorProps("duration")}
                  onChange={(event) => update("duration", event.target.value)}
                />
                {errorFor("duration")}
              </Field>
              <Field label="Thời gian giao sản phẩm (tính theo ngày làm việc)">
                <input
                  type="number"
                  name="days"
                  min={0}
                  max={60}
                  required
                  value={draft.days}
                  placeholder="VD: 7"
                  {...fieldErrorProps("days")}
                  onChange={(event) => update("days", event.target.value)}
                />
                {errorFor("days")}
              </Field>
            </div>
          </section>

          <section className="package-form-section">
            <h3>
              <ImagePlus size={18} /> Sản phẩm bàn giao
            </h3>
            {photoService && (
              <div className="form-grid three">
                <Field label="Số ảnh gốc" hint="Để trống nếu không áp dụng.">
                  <input
                    type="number"
                    name="original_photo_count"
                    min={0}
                    max={500}
                    value={draft.original_photo_count}
                    placeholder="VD: 100"
                    {...fieldErrorProps("original_photo_count")}
                    onChange={(event) =>
                      update("original_photo_count", event.target.value)
                    }
                  />
                  {errorFor("original_photo_count")}
                </Field>
                <Field label="Số ảnh chỉnh sửa" hint="Để trống nếu không áp dụng.">
                  <input
                    type="number"
                    name="edited_photo_count"
                    min={0}
                    max={500}
                    value={draft.edited_photo_count}
                    placeholder="VD: 20"
                    {...fieldErrorProps("edited_photo_count")}
                    onChange={(event) =>
                      update("edited_photo_count", event.target.value)
                    }
                  />
                  {errorFor("edited_photo_count")}
                </Field>
                <Field label="Số lần chỉnh sửa" hint="Để trống nếu không áp dụng.">
                  <input
                    type="number"
                    name="revision_count"
                    min={0}
                    max={20}
                    value={draft.revision_count}
                    placeholder="VD: 2"
                    {...fieldErrorProps("revision_count")}
                    onChange={(event) =>
                      update("revision_count", event.target.value)
                    }
                  />
                  {errorFor("revision_count")}
                </Field>
              </div>
            )}
            <Field
              label="Gói gồm gì (mỗi dòng một hạng mục)"
              hint="Liệt kê cụ thể các phần khách nhận; trường này khác với phần mô tả ngắn về những gì đã tính trong giá bên dưới."
            >
              <textarea
                name="included_items"
                maxLength={4000}
                rows={4}
                value={draft.included_items}
                placeholder={includedPlaceholder}
                {...fieldErrorProps("included_items")}
                onChange={(event) => update("included_items", event.target.value)}
              />
              {errorFor("included_items")}
            </Field>
          </section>

          <section className="package-form-section">
            <h3>
              <Gift size={18} /> Quyền lợi và phụ phí
            </h3>
            <Field
              label="Quyền lợi của khách (mỗi dòng một mục)"
              hint="Nêu trải nghiệm hoặc hỗ trợ đi kèm, không lặp lại hạng mục bàn giao."
            >
              <textarea
                name="customer_benefits"
                maxLength={4000}
                rows={3}
                value={draft.customer_benefits}
                placeholder={"Tư vấn concept trước buổi chụp\nHướng dẫn tạo dáng"}
                {...fieldErrorProps("customer_benefits")}
                onChange={(event) =>
                  update("customer_benefits", event.target.value)
                }
              />
              {errorFor("customer_benefits")}
            </Field>
            <Field
              label="Thông tin đã tính trong giá"
              hint="Mô tả ngắn phần dịch vụ đã bao gồm trong giá; không lặp danh sách hạng mục bàn giao ở trên."
            >
              <textarea
                name="includes"
                required
                maxLength={1000}
                rows={2}
                value={draft.includes}
                placeholder="VD: Bao gồm chụp tại studio và chỉnh màu 20 ảnh"
                {...fieldErrorProps("includes")}
                onChange={(event) => update("includes", event.target.value)}
              />
              {errorFor("includes")}
            </Field>
            <Field
              label="Không bao gồm / phụ phí công bố"
              hint="Nêu rõ chi phí phát sinh đã biết; để trống nếu không có."
            >
              <textarea
                name="exclusions"
                maxLength={1000}
                rows={2}
                value={draft.exclusions}
                placeholder="VD: Phụ phí di chuyển ngoài nội thành: 100.000đ"
                onChange={(event) => update("exclusions", event.target.value)}
              />
            </Field>
            <label className="checkbox">
              <input
                type="checkbox"
                name="active"
                checked={draft.active}
                onChange={(event) => update("active", event.target.checked)}
              />
              Mở nhận booking cho gói này
            </label>
          </section>
          <div className="package-form-actions">
            <button type="button" className="btn ghost" onClick={onClose}>
              Hủy
            </button>
            <button className="btn" disabled={busy}>
              {busy ? "Đang lưu…" : "Lưu gói"}
            </button>
          </div>
        </form>

        <aside className="package-preview" aria-live="polite">
          <div className="package-preview-heading">
            <Sparkles size={17} />
            <div>
              <strong>Xem trước</strong>
              <small>Khách sẽ thấy thông tin gói như sau</small>
            </div>
          </div>
          <article className="package-card">
            <div className="package-top">
              <span className="eyebrow">{serviceLabel(draft.service)}</span>
            </div>
            <div className="package-title-row">
              <h3>{draft.name || "Tên gói dịch vụ"}</h3>
              <div className="package-price">
                {draft.price && previewPrice !== null
                  ? money(previewPrice)
                  : "Giá dịch vụ"}
              </div>
            </div>
            <p className="package-desc">
              {draft.description || "Mô tả dịch vụ sẽ hiển thị tại đây."}
            </p>
            <div className="package-meta-chips">
              {previewDuration > 0 && (
                <span>
                  <Clock size={13} /> {formatDuration(previewDuration)}
                </span>
              )}
              {draft.days !== "" && deliveryDaysLabel(Number(draft.days)) && (
                <span>
                  <Check size={13} />
                  {deliveryDaysLabel(Number(draft.days))}
                </span>
              )}
              {draft.original_photo_count && (
                <span>{draft.original_photo_count} ảnh gốc</span>
              )}
              {draft.edited_photo_count && (
                <span>{draft.edited_photo_count} ảnh chỉnh sửa</span>
              )}
              {draft.revision_count && (
                <span>{draft.revision_count} lần chỉnh sửa</span>
              )}
            </div>
            {packageLines(draft.included_items)?.length ? (
              <div className="package-preview-includes">
                <strong>Gói gồm gì</strong>
                <FormattedCopy value={draft.included_items} />
              </div>
            ) : (
              <p className="muted">Các hạng mục gói gồm sẽ hiển thị tại đây.</p>
            )}
          </article>
        </aside>
      </div>
    </Modal>
  );
}

export function Studio() {
  const { user, profile, providers, refresh, toast } = useApp();
  const own = providers.find((p) => p.owner_id === user!.id);
  const [tab, setTab] = useState(own ? "overview" : "profile"),
    [bookings, setBookings] = useState<Booking[]>([]),
    [payoutAccount, setPayoutAccount] = useState<PayoutAccount | null>(null),
    [hours, setHours] = useState<
      { id: string; starts_at: string; ends_at: string }[]
    >([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [edit, setEdit] = useState<Package | "new" | null>(null);
  async function load() {
    if (!own) return;
    const [a, b, payout] = await Promise.all([
      client()
        .from("bookings")
        .select("*")
        .eq("provider_id", own.id)
        .order("starts_at"),
      client()
        .from("availability")
        .select("*")
        .eq("provider_id", own.id)
        .order("starts_at"),
      client()
        .from("provider_payout_accounts")
        .select("*")
        .eq("provider_id", own.id)
        .maybeSingle(),
    ]);
    if (a.error || b.error || payout.error) {
      setError((a.error || b.error || payout.error)!.message);
      return;
    }
    setBookings(a.data || []);
    setHours(b.data || []);
    setPayoutAccount((payout.data as PayoutAccount | null) || null);
  }
  useEffect(() => {
    void load();
  }, [own?.id]);
  async function run(fn: () => Promise<unknown>, message = "Đã lưu thay đổi.") {
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
      await load();
      toast(message);
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  function openPackageEditor(item: Package | "new") {
    setError("");
    setEdit(item);
  }
  const sections = [
    ["overview", "Tổng quan", LayoutDashboard],
    ["deposit", "Nhận cọc", DollarSign],
    ["profile", "Hồ sơ creator", Settings],
    ["packages", "Gói dịch vụ", PackageIcon],
    ["portfolio", "Portfolio", Camera],
    ["calendar", "Lịch làm việc", CalendarDays],
    ["reviews", "Đánh giá", Star],
  ] as const;
  const incoming = bookings.filter((b) => effectiveStatus(b) === "REQUESTED");
  const upcoming = bookings.filter((b) =>
    ["CONFIRMED", "PAYMENT_REVIEW", "AWAITING_DEPOSIT"].includes(
      effectiveStatus(b),
    ),
  );
  return (
    <div className="workspace">
      <aside className="workspace-sidebar">
        <Link className="workspace-brand" to="/" aria-label="BeautyHub trang chủ">
          <img src="/assets/brand-mark.png" alt="" width="44" height="44" />
          <span>beautyhub</span>
        </Link>
        <span className="eyebrow">CREATOR SPACE</span>
        <h2>{own?.name || "Góc sáng tạo của bạn"}</h2>
        {own && <Badge status={own.status} />}
        <nav>
          {sections.map(([k, t, Icon]) => (
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
        <Link to="/account">Tài khoản & số điện thoại →</Link>
      </aside>
      <div className="workspace-main">
        <span className="eyebrow">BEAUTYHUB / CREATOR</span>
        <div className="page-heading">
          <div>
            <h1>{sections.find((s) => s[0] === tab)?.[1]}</h1>
            <p className="muted">
              {own
                ? "Chăm chút từng buổi hẹn, từ lời chào đầu tiên."
                : "Tạo hồ sơ để bắt đầu nhận booking tại TP.HCM."}
            </p>
          </div>
          {own && ["DRAFT", "REJECTED"].includes(own.status) && (
            <button
              className="btn"
              disabled={busy}
              onClick={() =>
                run(
                  () => rpc("submit_provider"),
                  "Đã gửi hồ sơ. BeautyHub sẽ kiểm tra trước khi mở nhận lịch.",
                )
              }
            >
              Gửi hồ sơ để duyệt
            </button>
          )}
        </div>
        {error && <Alert>{error}</Alert>}
        {!profile?.phone && (
          <Alert>
            Hãy thêm số điện thoại ở <Link to="/account">Tài khoản</Link> trước
            khi gửi hồ sơ duyệt.
          </Alert>
        )}
        {own && own.status !== "APPROVED" && (
          <div className="info-banner">
            Hồ sơ chưa được mở nhận lịch. Hoàn thiện thông tin, ít nhất 3 ảnh
            thật, gói dịch vụ và lịch trống rồi gửi duyệt.
          </div>
        )}
        {own && !payoutAccount && (
          <Alert>
            Hãy cập nhật thông tin nhận cọc để khách có thể chuyển cọc trực tiếp
            cho bạn và xác nhận lịch.
          </Alert>
        )}
        {tab === "deposit" && own && (
          <PayoutAccountEditor
            key={`${own.id}:${payoutAccount?.updated_at || "new"}`}
            providerId={own.id}
            account={payoutAccount}
            busy={busy}
            onSave={async (value) => {
              const saved = await run(
                async () => {
                  const { error: saveError } = await client()
                    .from("provider_payout_accounts")
                    .upsert(value, { onConflict: "provider_id" });
                  if (saveError) throw saveError;
                },
                "Đã lưu thông tin nhận cọc.",
              );
              if (!saved) throw new Error("Không thể lưu thông tin nhận cọc.");
            }}
          />
        )}
        {tab === "overview" && (
          <>
            <div className="metrics">
              {[
                ["Cần phản hồi", incoming.length],
                ["Booking đang xử lý", upcoming.length],
                [
                  "Đã hoàn thành",
                  bookings.filter((b) => b.status === "COMPLETED").length,
                ],
                [
                  "Cọc đã nhận",
                  money(
                    bookings
                      .filter((b) => b.payment_status === "PAID")
                      .reduce((s, b) => s + b.deposit, 0),
                  ),
                ],
              ].map(([t, n]) => (
                <div className="metric" key={t}>
                  <small>{t}</small>
                  <strong>{n}</strong>
                </div>
              ))}
            </div>
            <section className="panel">
              <h2>Yêu cầu cần phản hồi</h2>
              {incoming.length ? (
                incoming.map((b) => <BookingCard key={b.id} b={b} />)
              ) : (
                <Empty title="Chưa có yêu cầu mới">
                  Yêu cầu mới sẽ xuất hiện tại đây.
                </Empty>
              )}
            </section>
            <section className="panel">
              <h2>Lịch sắp tới & giao dịch cần kiểm tra</h2>
              {upcoming.length ? (
                upcoming.map((b) => <BookingCard key={b.id} b={b} />)
              ) : (
                <p className="muted">Bạn chưa có booking sắp tới.</p>
              )}
            </section>
            <button
              className="btn ghost"
              disabled={busy}
              onClick={() => run(load, "Đã cập nhật lịch.")}
            >
              Làm mới dữ liệu
            </button>
          </>
        )}
        {tab === "profile" && (
          <form
            className="panel form-grid"
            key={own?.id || "new"}
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await run(() =>
                rpc("save_provider", {
                  p_slug: f.get("slug"),
                  p_name: f.get("name"),
                  p_category: f.get("category"),
                  p_bio: f.get("bio"),
                  p_districts: f.getAll("districts"),
                  p_styles: f.getAll("styles"),
                }),
              );
            }}
          >
            <div className="form-grid two">
              <Field label="Tên hiển thị">
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={100}
                  defaultValue={own?.name}
                  placeholder="VD: Lan Anh Studio"
                />
              </Field>
              <Field
                label="Đường dẫn hồ sơ"
                hint="Chữ thường không dấu, số và dấu gạch ngang. Ví dụ: lan-anh-studio"
              >
                <input
                  name="slug"
                  required
                  pattern="[a-z0-9][a-z0-9-]{2,60}"
                  defaultValue={own?.slug}
                  placeholder="VD: lan-anh-studio"
                />
              </Field>
              <fieldset className="service-category-choices">
                <legend>Dịch vụ chính</legend>
                <div>
                  <label className="service-choice">
                    <input
                      type="radio"
                      name="category"
                      value="Photographer"
                      defaultChecked={
                        (own?.category || "Photographer") === "Photographer"
                      }
                    />
                    <Camera size={18} />
                    <span>Nhiếp ảnh</span>
                  </label>
                  <label className="service-choice">
                    <input
                      type="radio"
                      name="category"
                      value="Makeup Artist"
                      defaultChecked={own?.category === "Makeup Artist"}
                    />
                    <Sparkles size={18} />
                    <span>Trang điểm</span>
                  </label>
                </div>
              </fieldset>
            </div>
            <Field label="Giới thiệu">
              <textarea
                name="bio"
                required
                minLength={40}
                maxLength={2000}
                rows={5}
                defaultValue={own?.bio}
                placeholder="VD: Mình chuyên chụp chân dung tự nhiên, tư vấn concept và hướng dẫn tạo dáng..."
              />
            </Field>
            <fieldset>
              <legend>Khu vực phục vụ</legend>
              <div className="checkbox-grid">
                {DISTRICTS.map((d) => (
                  <label className="checkbox" key={d}>
                    <input
                      type="checkbox"
                      name="districts"
                      value={d}
                      defaultChecked={own?.districts.includes(d)}
                    />
                    {d}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Phong cách · chọn 2–4</legend>
              <div className="checkbox-grid">
                {STYLES.map((s) => (
                  <label className="checkbox" key={s}>
                    <input
                      type="checkbox"
                      name="styles"
                      value={s}
                      defaultChecked={own?.styles.includes(s)}
                    />
                    {s}
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="muted">
              Thay đổi hồ sơ sẽ đưa hồ sơ về bản nháp để duyệt lại. Các booking
              hiện có vẫn được giữ nguyên.
            </p>
            <button className="btn" disabled={busy}>
              Lưu hồ sơ
            </button>
          </form>
        )}
        {tab === "packages" && (
          <>
            {own?.packages.length ? (
              <button className="btn" onClick={() => openPackageEditor("new")}>
                <Plus size={16} />
                Thêm gói dịch vụ
              </button>
            ) : null}
            <div className="studio-packages">
              {own?.packages.map((p) => (
                <article className="panel" key={p.id}>
                  <div className="studio-package-top">
                    <span className="eyebrow">{serviceLabel(p.service)}</span>
                    <span
                      className={
                        p.active
                          ? "package-status active"
                          : "package-status hidden"
                      }
                    >
                      {p.active ? "Đang mở" : "Đang ẩn"}
                    </span>
                  </div>
                  <h2>{p.name}</h2>
                  <p>{p.description}</p>
                  <div className="package-meta-chips">
                    <strong>{money(p.price)}</strong>
                    <span>
                      <Clock size={13} /> {formatDuration(p.duration)}
                    </span>
                    {deliveryDaysLabel(p.delivery_days) && (
                      <span>
                        <Check size={13} />
                        {deliveryDaysLabel(p.delivery_days)}
                      </span>
                    )}
                    {p.edited_photo_count != null && (
                      <span>{p.edited_photo_count} ảnh chỉnh sửa</span>
                    )}
                  </div>
                  <button className="btn ghost" onClick={() => openPackageEditor(p)}>
                    Chỉnh sửa
                  </button>
                </article>
              ))}
            </div>
            {own && own.packages.length === 0 && (
              <div className="package-empty panel">
                <PackageIcon size={34} aria-hidden="true" />
                <h2>Hãy tạo gói dịch vụ đầu tiên</h2>
                <p>
                  Thêm giá, thời lượng và quyền lợi để khách hiểu rõ dịch vụ
                  trước khi gửi yêu cầu.
                </p>
                <button className="btn" onClick={() => openPackageEditor("new")}>
                  <Plus size={16} />
                  Tạo gói đầu tiên
                </button>
              </div>
            )}
            {!own && (
              <Empty title="Tạo hồ sơ trước khi thêm gói">
                <button
                  className="text-button"
                  onClick={() => setTab("profile")}
                >
                  Tạo hồ sơ
                </button>
              </Empty>
            )}
          </>
        )}
        {tab === "portfolio" && (
          <>
            <form
              className="panel form-grid"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const file = f.get("image") as File;
                await run(async () => {
                  if (!own) throw new Error("Tạo hồ sơ trước khi tải ảnh.");
                  const blob = await compressImage(file);
                  const path = `${user!.id}/${crypto.randomUUID()}.webp`;
                  const { error: e } = await client()
                    .storage.from("portfolio")
                    .upload(path, blob, {
                      contentType: "image/webp",
                      upsert: false,
                    });
                  if (e) throw e;
                  await rpc("add_portfolio", {
                    p_path: path,
                    p_caption: f.get("caption"),
                  });
                }, "Đã tải ảnh. Ảnh sẽ hiển thị công khai sau khi được duyệt.");
              }}
            >
              <h2>Tác phẩm thật, câu chuyện thật.</h2>
              <p>
                Tối đa 12 ảnh, tự động nén về WebP dưới 512 KB. Chỉ tải ảnh bạn
                có quyền sử dụng và được người trong ảnh cho phép công bố.
              </p>
              <Field
                label="Chọn ảnh"
                hint="Ví dụ: chọn ảnh JPG, PNG hoặc WebP dưới 12 MB."
              >
                <input
                  type="file"
                  name="image"
                  accept="image/jpeg,image/png,image/webp"
                  required
                  disabled={!own}
                />
              </Field>
              <Field label="Mô tả tác phẩm">
                <input
                  name="caption"
                  maxLength={200}
                  required
                  placeholder="VD: Concept nàng thơ, chân dung ngoài trời..."
                />
              </Field>
              <label className="checkbox">
                <input type="checkbox" required />
                Tôi có quyền sử dụng và công bố ảnh này.
              </label>
              <button
                className="btn"
                disabled={
                  busy || !own || (own?.portfolio_assets.length || 0) >= 12
                }
              >
                <Upload size={16} />
                {busy ? "Đang tải ảnh…" : "Tải ảnh lên"}
              </button>
            </form>
            <div className="studio-gallery">
              {own?.portfolio_assets.map((a) => (
                <figure key={a.id}>
                  {a.url && <img src={a.url} alt={a.caption} />}
                  <figcaption>
                    {a.caption}
                    <small>{a.approved ? "Đã duyệt" : "Chờ kiểm tra"}</small>
                  </figcaption>
                </figure>
              ))}
            </div>
          </>
        )}
        {tab === "calendar" && (
          <>
            <form
              className="panel form-grid"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const date = f.get("date");
                await run(() =>
                  rpc("add_availability", {
                    p_start: new Date(
                      `${date}T${f.get("start")}:00+07:00`,
                    ).toISOString(),
                    p_end: new Date(
                      `${date}T${f.get("end")}:00+07:00`,
                    ).toISOString(),
                  }),
                );
              }}
            >
              <h2>Mở thời gian nhận lịch</h2>
              <p>
                Giờ TP.HCM (UTC+7). Khách chỉ thấy khung giờ đủ thời lượng gói
                và không trùng booking.
              </p>
              <div className="form-grid three">
                <Field label="Ngày" hint="Chọn một ngày trong 90 ngày tới.">
                  <input
                    type="date"
                    name="date"
                    min={localDate()}
                    max={localDate(89)}
                    required
                  />
                </Field>
                <Field label="Từ giờ" hint="VD: 09:00">
                  <input
                    type="time"
                    name="start"
                    required
                    defaultValue="09:00"
                    step="1800"
                  />
                </Field>
                <Field label="Đến giờ" hint="VD: 17:00">
                  <input
                    type="time"
                    name="end"
                    required
                    defaultValue="17:00"
                    step="1800"
                  />
                </Field>
              </div>
              <button className="btn" disabled={busy || !own}>
                Mở lịch
              </button>
            </form>
            <section className="panel">
              <h2>Thời gian đang mở</h2>
              <p className="muted">
                Đóng một khoảng giờ ngăn booking mới; không hủy các booking đã
                nhận.
              </p>
              {hours
                .filter((h) => Date.parse(h.ends_at) > Date.now())
                .map((h) => (
                  <div className="list-row" key={h.id}>
                    <CalendarDays size={18} />
                    <div>
                      <strong>{dateTime(h.starts_at)}</strong>
                      <p>Đến {dateTime(h.ends_at)}</p>
                    </div>
                    <button
                      className="btn ghost small"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => rpc("remove_availability", { p_id: h.id }),
                          "Đã đóng khoảng giờ cho booking mới.",
                        )
                      }
                    >
                      Đóng khoảng giờ
                    </button>
                  </div>
                ))}
            </section>
          </>
        )}
        {tab === "reviews" && (
          <section className="panel">
            <h2>Đánh giá từ booking hoàn thành</h2>
            {own?.reviews.length ? (
              own.reviews.map((r) => (
                <article className="review" key={r.id}>
                  <strong>
                    {r.author_name} · ★ {Number(r.rating).toFixed(1)}
                  </strong>
                  <p>{r.text}</p>
                </article>
              ))
            ) : (
              <Empty title="Chưa có đánh giá">
                Đánh giá sẽ xuất hiện sau khi khách hoàn thành dịch vụ.
              </Empty>
            )}
          </section>
        )}
        {edit && (
          <PackageEditor
            key={edit === "new" ? "new-package" : edit.id}
            item={edit}
            category={own?.category || "Photographer"}
            error={error}
            busy={busy}
            onClose={() => {
              setEdit(null);
              setError("");
            }}
            onSave={(payload) =>
              run(
                () =>
                  rpc("save_package_details", {
                    p_id: payload.id,
                    p_name: payload.name,
                    p_service: payload.service,
                    p_description: payload.description,
                    p_duration: payload.duration,
                    p_price: payload.price,
                    p_days: payload.days,
                    p_includes: payload.includes,
                    p_exclusions: payload.exclusions,
                    p_active: payload.active,
                    p_original_photo_count:
                      payload.details.original_photo_count,
                    p_edited_photo_count:
                      payload.details.edited_photo_count,
                    p_revision_count: payload.details.revision_count,
                    p_included_items: payload.details.included_items,
                    p_customer_benefits: payload.details.customer_benefits,
                  }),
                "Đã lưu gói dịch vụ.",
              )
            }
          />
        )}
      </div>
    </div>
  );
}
