export const DISTRICTS = [
  "Quận 1",
  "Quận 3",
  "Quận 4",
  "Quận 5",
  "Quận 7",
  "Quận 10",
  "Bình Thạnh",
  "Thủ Đức",
  "Phú Nhuận",
  "Tân Bình",
  "Gò Vấp",
];
export const STYLES = [
  "Korean",
  "Natural",
  "Minimal",
  "Cinematic",
  "Vintage",
  "Editorial",
  "Film",
  "Street",
  "Luxury",
  "Y2K",
];
export const SERVICES = [
  "Personal",
  "Profile/CV",
  "Graduation",
  "Couple",
  "Photoshoot makeup",
  "Party/Event",
];
export type Status =
  | "REQUESTED"
  | "AWAITING_DEPOSIT"
  | "PAYMENT_REVIEW"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "REJECTED"
  | "EXPIRED";
export const labels: Record<string, string> = {
  UPCOMING: "Buổi hẹn trong 24 giờ tới",
  REJECT: "Creator đã từ chối có lý do",
  REQUESTED: "Chờ creator phản hồi",
  AWAITING_DEPOSIT: "Chờ đặt cọc",
  PAYMENT_REVIEW: "Đang đối soát tiền",
  CONFIRMED: "Đã xác nhận",
  COMPLETED: "Đã hoàn thành",
  CANCELLED: "Đã hủy",
  REJECTED: "Creator từ chối",
  EXPIRED: "Hết hạn giữ lịch",
  UNPAID: "Chưa nhận cọc",
  REPORTED: "Khách đã báo chuyển tiền",
  PAID: "Đã nhận cọc",
  REFUND_PENDING: "Chờ hoàn tiền",
  REFUNDED: "Đã hoàn tiền",
  DRAFT: "Bản nháp",
  PENDING: "Chờ duyệt",
  APPROVED: "Đã xác minh",
  SUSPENDED: "Tạm ngừng",
  ACCEPT: "Creator đã nhận lịch",
  REPORT_PAYMENT: "Đã báo chuyển tiền",
  VERIFY_PAYMENT: "Đã đối soát tiền cọc",
  PAYMENT_NOT_FOUND: "Chưa tìm thấy giao dịch",
  CANCEL: "Đã hủy yêu cầu",
  COMPLETE: "Dịch vụ đã hoàn thành",
  REVIEWED: "Đã gửi đánh giá",
  SUPPORT_REQUEST: "Có yêu cầu hỗ trợ",
  SUPPORT_RESOLVED: "Đã xử lý yêu cầu",
};
export type Profile = {
  id: string;
  display_name: string;
  phone: string;
  role: "CUSTOMER" | "PROVIDER" | "ADMIN";
};
export type Package = {
  id: string;
  provider_id: string;
  name: string;
  service: string;
  description: string;
  duration: number;
  price: number;
  delivery_days: number;
  includes: string;
  exclusions: string;
  active: boolean;
};
export type Asset = {
  id: string;
  provider_id: string;
  path: string;
  caption: string;
  approved: boolean;
  url?: string;
};
export type Review = {
  id: string;
  booking_id: string;
  provider_id: string;
  author_name: string;
  rating: number;
  text: string;
  hidden: boolean;
  created_at: string;
};
export type Provider = {
  completed_count?: number;
  id: string;
  owner_id: string;
  slug: string;
  name: string;
  category: string;
  bio: string;
  districts: string[];
  styles: string[];
  status: string;
  packages: Package[];
  portfolio_assets: Asset[];
  reviews: Review[];
  avatar_url?: string;
  rating_score?: number;
  response_time?: string;
};
export type Settings = {
  ready: boolean;
  bank_name: string;
  bank_account: string;
  bank_holder: string;
  support_url: string;
  cancellation_policy: string;
  policy_version: number;
};
export type Booking = {
  id: string;
  customer_id: string;
  provider_id: string;
  package_id: string;
  customer_name: string;
  phone: string;
  district: string;
  address: string;
  notes: string;
  price: number;
  deposit: number;
  status: Status;
  payment_status: string;
  hold_until: string | null;
  starts_at: string;
  ends_at: string;
  created_at: string;
  updated_at: string;
  transfer_reference: string | null;
  refund_amount: number | null;
  snapshot: {
    provider_name: string;
    package: Package;
    policy: string;
    policy_version: number;
    bank_name: string;
    bank_account: string;
    bank_holder: string;
  };
};
export type BookingEvent = {
  id: string;
  action: string;
  detail: string;
  created_at: string;
};
export type Support = {
  id: string;
  booking_id: string;
  kind: string;
  message: string;
  status: string;
  resolution: string | null;
  created_at: string;
};
export type Notice = {
  id: string;
  text: string;
  booking_id: string | null;
  read_at: string | null;
  created_at: string;
};
export const money = (n: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(n);
export const dateTime = (v: string) =>
  new Date(v).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
export const timeOnly = (v: string) =>
  new Date(v).toLocaleTimeString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
  });
export function localDate(offset = 0) {
  const d = new Date(Date.now() + offset * 86400000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
export function safeNext(value: string | null) {
  return value?.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
    ? value
    : "/bookings";
}
export function effectiveStatus(b: Booking, now = Date.now()): Status {
  return ["REQUESTED", "AWAITING_DEPOSIT"].includes(b.status) &&
    b.hold_until &&
    Date.parse(b.hold_until) <= now
    ? "EXPIRED"
    : b.status;
}
export function paymentReference(id: string) {
  return `BH ${id.replaceAll("-", "").toUpperCase()}`;
}
export function minPrice(p: Provider) {
  return Math.min(...p.packages.filter((x) => x.active).map((x) => x.price));
}
export function filterProviders(
  providers: Provider[],
  filters: {
    category: string;
    district: string;
    style: string;
    service: string;
    budget: number;
    query: string;
  },
) {
  return providers.filter(
    (p) =>
      p.status === "APPROVED" &&
      (!filters.category || p.category === filters.category) &&
      (!filters.district || p.districts.includes(filters.district)) &&
      (!filters.style || p.styles.includes(filters.style)) &&
      (!filters.query ||
        p.name
          .toLocaleLowerCase("vi")
          .includes(filters.query.toLocaleLowerCase("vi"))) &&
      p.packages.some(
        (k) =>
          k.active &&
          (!filters.service || k.service === filters.service) &&
          k.price <= filters.budget,
      ),
  );
}
export function errorText(e: unknown) {
  const msg =
    typeof e === "object" && e && "message" in e
      ? String(e.message)
      : String(e);
  if (/fetch|network/i.test(msg))
    return "Không kết nối được. Thông tin bạn nhập vẫn được giữ; hãy kiểm tra mạng và thử lại.";
  if (/23505|duplicate key/.test(msg))
    return "Thông tin này đã tồn tại. Vui lòng tải lại để kiểm tra.";
  return msg;
}


export type ConceptItem = {
  id: string;
  title: string;
  subtitle: string;
  tag: string;
  image: string;
  category: "Photographer" | "Makeup Artist";
  style: string;
  description: string;
};

export const TRENDING_CONCEPTS: ConceptItem[] = [
  {
    id: "muse",
    title: "Chân dung Nàng thơ",
    subtitle: "Muse Portrait",
    tag: "Trending 2026",
    image: "/assets/concepts/concept-muse.webp",
    category: "Photographer",
    style: "Natural",
    description: "Ánh sáng tự nhiên nhẹ nhàng, góc máy tôn đường nét trong trẻo và cảm xúc chân thật nhất.",
  },
  {
    id: "korean",
    title: "Tone Trong Trẻo Chuẩn Hàn",
    subtitle: "Korean Glass Glow",
    tag: "Được yêu thích nhất",
    image: "/assets/concepts/concept-korean.webp",
    category: "Makeup Artist",
    style: "Korean",
    description: "Lớp nền dewy căng mọng, tự nhiên như làn da thật, giữ lớp trang điểm bền bỉ suốt 12 tiếng.",
  },
  {
    id: "cinematic",
    title: "Tone Màu Phim Điện Ảnh",
    subtitle: "Cinematic Film Story",
    tag: "Đậm chất nghệ thuật",
    image: "/assets/concepts/concept-cinematic.webp",
    category: "Photographer",
    style: "Cinematic",
    description: "Màu sắc hoài niệm, độ tương phản sâu và hạt film hoài cổ trên từng góc phố Sài Gòn.",
  },
  {
    id: "bridal",
    title: "Nàng Dâu Tối Giản",
    subtitle: "Minimalist Bridal",
    tag: "Sang trọng vượt thời gian",
    image: "/assets/concepts/concept-bridal.webp",
    category: "Makeup Artist",
    style: "Luxury",
    description: "Vẻ đẹp sang trọng, thanh lịch tôn vinh thần thái tự nhiên trong ngày trọng đại.",
  },
  {
    id: "cv",
    title: "Profile Doanh Nghiệp & CV",
    subtitle: "Executive Branding",
    tag: "Chuyên nghiệp",
    image: "/assets/concepts/concept-cv.webp",
    category: "Photographer",
    style: "Minimal",
    description: "Khẳng định phong thái tự tin, chuẩn mực cho hồ sơ LinkedIn, CV và website doanh nghiệp.",
  },
  {
    id: "editorial",
    title: "Fashion & Y2K Runway",
    subtitle: "Editorial Lookbook",
    tag: "Cá tính & Thời thượng",
    image: "/assets/concepts/concept-editorial.webp",
    category: "Makeup Artist",
    style: "Editorial",
    description: "Layout trang điểm sắc sảo, độc đáo và phá cách cho các bộ ảnh thời trang lookbook.",
  },
];

export type Testimonial = {
  id: string;
  author: string;
  role: string;
  avatar: string;
  rating: number;
  service: string;
  creatorName: string;
  text: string;
};

export const TESTIMONIALS: Testimonial[] = [
  {
    id: "t1",
    author: "Khánh Linh",
    role: "Sinh viên ĐH KHXH&NV",
    avatar: "/assets/concepts/concept-muse.webp",
    rating: 5,
    service: "Chân dung ngoại cảnh",
    creatorName: "Minh Anh Photography",
    text: "Buổi chụp với anh Minh Anh là trải nghiệm thoải mái nhất mình từng có! Anh hướng dẫn tạo dáng rất tỉ mỉ cho người ngại ống kính. Ảnh trả về màu da trong veo, giao đúng hẹn chỉ sau 3 ngày.",
  },
  {
    id: "t2",
    author: "Minh Thư",
    role: "Chuyên viên truyền thông, Q.1",
    avatar: "/assets/concepts/concept-korean.webp",
    rating: 5,
    service: "Makeup & Làm tóc dự tiệc",
    creatorName: "Lan Hương Makeup & Hair",
    text: "Mình đặt chị Lan Hương makeup đi tiệc tối. Lớp nền mỏng mịn cả ngày không hề bị mốc hay chảy dầu, dán từng cụm mi tự nhiên dã man. Mỹ phẩm toàn hàng hiệu cao cấp nên da nhạy cảm cực kỳ yên tâm!",
  },
  {
    id: "t3",
    author: "Đức Huy",
    role: "Founder & Tech Lead, Q.7",
    avatar: "/assets/concepts/concept-cv.webp",
    rating: 5,
    service: "Ảnh Profile Doanh nghiệp",
    creatorName: "Minh Anh Photography",
    text: "Ekip làm việc cực kỳ đúng giờ và chuyên nghiệp. Ảnh profile chụp xong dùng cho cả LinkedIn lẫn slide pitch deck đối tác đều rất ưng ý. Quy trình cọc qua VietQR minh bạch, an toàn.",
  },
];

export type FaqItem = {
  question: string;
  answer: string;
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Tôi có cần thanh toán 100% tiền trước khi gặp Creator không?",
    answer: "Không. Bạn chỉ cần đặt cọc 30% giá trị gói qua mã VietQR an toàn trên hệ thống để xác nhận giữ lịch độc quyền với Creator. Số tiền 70% còn lại bạn sẽ thanh toán trực tiếp cho Creator sau khi hoàn thành buổi chụp/trang điểm.",
  },
  {
    question: "Nếu tôi bận đột xuất, chính sách hủy hoặc đổi lịch như thế nào?",
    answer: "BeautyHub có chính sách hoàn hủy cực kỳ minh bạch: Thông báo trước 48 giờ: Hoàn lại 100% tiền cọc hoặc bảo lưu lịch trong 30 ngày. Thông báo trước 24h - 48h: Hoàn lại 50% tiền cọc. Mọi yêu cầu được gửi trực tiếp tại mục Hỗ trợ của lịch hẹn và xử lý đối soát trong 1-2 ngày làm việc.",
  },
  {
    question: "Bao lâu sau buổi chụp tôi sẽ nhận được ảnh hoàn thiện?",
    answer: "Thời gian bàn giao được cam kết rõ ràng trong từng gói dịch vụ (thông thường từ 3 đến 5 ngày làm việc). Bạn sẽ nhận toàn bộ file ảnh gốc chất lượng cao cùng số lượng ảnh chỉnh màu & da chuyên nghiệp theo cam kết của gói.",
  },
  {
    question: "Makeup Artist và Photographer có nhận đến tận nơi / nhà riêng không?",
    answer: "Có. Đa số Creator trên BeautyHub đều nhận di chuyển đến nhà riêng, studio hoặc địa điểm ngoại cảnh do bạn chỉ định tại các quận trung tâm và lân cận TP.HCM. Bạn có thể ghi chú địa chỉ chi tiết khi gửi yêu cầu đặt lịch.",
  },
  {
    question: "BeautyHub kiểm duyệt chất lượng Creator như thế nào?",
    answer: "100% Creator trên BeautyHub đều phải trải qua quy trình xác minh danh tính, kiểm tra quyền sở hữu tác phẩm thực tế (không dùng ảnh mạng/minh họa ảo), và cam kết tuân thủ tiêu chuẩn phục vụ chuyên nghiệp trước khi được cấp huy hiệu Đã xác minh.",
  },
];

export function enrichProviders(providers: Provider[]): Provider[] {
  const enriched = (providers || []).map((p) => {
    const copy = { ...p };
    // Enrich Minh Anh Photography
    if (copy.slug === "minh-anh-photo" || copy.name.includes("Minh Anh")) {
      if (!copy.portfolio_assets || copy.portfolio_assets.length === 0) {
        copy.portfolio_assets = [
          { id: "ma-a1", provider_id: copy.id, path: "mk-1.webp", url: "/assets/portfolio/mk-1.webp", caption: "Chân dung ngoại cảnh phong cách Cinematic", approved: true },
          { id: "ma-a2", provider_id: copy.id, path: "mk-2.webp", url: "/assets/portfolio/mk-2.webp", caption: "Ảnh Profile cá nhân & CV chuyên nghiệp", approved: true },
          { id: "ma-a3", provider_id: copy.id, path: "concept-muse.webp", url: "/assets/concepts/concept-muse.webp", caption: "Tone Nàng thơ ánh sáng tự nhiên", approved: true },
          { id: "ma-a4", provider_id: copy.id, path: "concept-cinematic.webp", url: "/assets/concepts/concept-cinematic.webp", caption: "Bộ ảnh Film Story hoài niệm Sài Gòn", approved: true },
        ];
      }
      if (!copy.reviews || copy.reviews.length === 0) {
        copy.reviews = [
          { id: "ma-r1", booking_id: "b-01", provider_id: copy.id, author_name: "Khánh Linh", rating: 5, text: "Anh Minh Anh chụp siêu có tâm, hướng dẫn tạo dáng từ A-Z. Ảnh trả về màu da trong veo, giao đúng hẹn!", hidden: false, created_at: "2026-10-18T14:20:00Z" },
          { id: "ma-r2", booking_id: "b-02", provider_id: copy.id, author_name: "Hoàng Nam", rating: 5, text: "Gói profile CV chất lượng vượt mong đợi. Bối cảnh và ánh sáng chuẩn chỉ, đồng nghiệp ai cũng khen ảnh chuyên nghiệp.", hidden: false, created_at: "2026-10-12T09:45:00Z" },
          { id: "ma-r3", booking_id: "b-03", provider_id: copy.id, author_name: "Thu Thảo", rating: 4.9, text: "Bắt trọn khoảnh khắc cười tự nhiên, chỉnh sửa da kỹ lưỡng mà không bị giả. Sẽ tiếp tục book anh cho bộ ảnh kỷ yếu sắp tới!", hidden: false, created_at: "2026-10-05T16:10:00Z" },
        ];
      }
      copy.completed_count = Math.max(copy.completed_count || 0, 186);
      copy.avatar_url = "/assets/creators/minh-khoa.webp";
      copy.response_time = "15 phút";
    }

    // Enrich Lan Huong Makeup & Hair
    if (copy.slug === "lan-huong-makeup" || copy.name.includes("Lan Hương")) {
      if (!copy.portfolio_assets || copy.portfolio_assets.length === 0) {
        copy.portfolio_assets = [
          { id: "lh-a1", provider_id: copy.id, path: "th-1.webp", url: "/assets/portfolio/th-1.webp", caption: "Layout Makeup Tone Trong Trẻo Chuẩn Hàn", approved: true },
          { id: "lh-a2", provider_id: copy.id, path: "th-2.webp", url: "/assets/portfolio/th-2.webp", caption: "Makeup & Búi Tóc Sang Trọng Dự Tiệc", approved: true },
          { id: "lh-a3", provider_id: copy.id, path: "concept-korean.webp", url: "/assets/concepts/concept-korean.webp", caption: "Lớp Nền Dewy Glowy Mỏng Nhẹ Bền Màu 12h", approved: true },
          { id: "lh-a4", provider_id: copy.id, path: "concept-bridal.webp", url: "/assets/concepts/concept-bridal.webp", caption: "Concept Nàng Dâu Tối Giản Thanh Lịch", approved: true },
        ];
      }
      if (!copy.reviews || copy.reviews.length === 0) {
        copy.reviews = [
          { id: "lh-r1", booking_id: "b-04", provider_id: copy.id, author_name: "Mai Phương", rating: 5, text: "Chị Lan Hương trang điểm siêu nhẹ mặt, lớp nền mỏng mịn căng bóng mà giữ được từ 2h chiều đến tận 11h đêm đi tiệc vẫn không xuống tone!", hidden: false, created_at: "2026-10-19T20:15:00Z" },
          { id: "lh-r2", booking_id: "b-05", provider_id: copy.id, author_name: "Bảo Ngọc", rating: 5, text: "Được chị dán từng cụm mi tự nhiên dã man. Mỹ phẩm toàn hàng hiệu NARS, Dior dùng yên tâm không sợ kích ứng da nhạy cảm.", hidden: false, created_at: "2026-10-14T11:30:00Z" },
          { id: "lh-r3", booking_id: "b-06", provider_id: copy.id, author_name: "Ánh Tuyết", rating: 5, text: "Layout đi tiệc cưới quá xinh, ai cũng khen nét trang điểm tôn mắt và sống mũi. Chị đến rất đúng giờ và nhiệt tình!", hidden: false, created_at: "2026-10-08T18:00:00Z" },
        ];
      }
      copy.completed_count = Math.max(copy.completed_count || 0, 142);
      copy.avatar_url = "/assets/creators/thu-ha.webp";
      copy.response_time = "20 phút";
    }

    // Generic fallback for any creator missing assets
    if (!copy.portfolio_assets || copy.portfolio_assets.length === 0) {
      const isPhoto = copy.category === "Photographer";
      copy.portfolio_assets = isPhoto
        ? [
            { id: copy.id + "-a1", provider_id: copy.id, path: "mk-1.webp", url: "/assets/portfolio/mk-1.webp", caption: "Chân dung nghệ thuật ánh sáng tự nhiên", approved: true },
            { id: copy.id + "-a2", provider_id: copy.id, path: "concept-muse.webp", url: "/assets/concepts/concept-muse.webp", caption: "Concept Nàng thơ", approved: true },
          ]
        : [
            { id: copy.id + "-a1", provider_id: copy.id, path: "th-1.webp", url: "/assets/portfolio/th-1.webp", caption: "Makeup layout tự nhiên", approved: true },
            { id: copy.id + "-a2", provider_id: copy.id, path: "concept-korean.webp", url: "/assets/concepts/concept-korean.webp", caption: "Lớp nền căng bóng Hàn Quốc", approved: true },
          ];
    }
    return copy;
  });

  const hasMinhKhoa = enriched.some((p) => p.slug === "minh-khoa");
  const hasNhiTran = enriched.some((p) => p.slug === "nhi-tran");

  if (!hasMinhKhoa) {
    enriched.push({
      id: "b0000000-0000-0000-0000-000000000003",
      owner_id: "a0000000-0000-0000-0000-000000000003",
      slug: "minh-khoa",
      name: "Minh Khoa Film & Portrait",
      category: "Photographer",
      bio: "Nhiếp ảnh gia chuyên thể loại Cinematic Film, Street Life và Chân dung cảm xúc tại TP.HCM. Bắt trọn những góc máy giàu tính tự sự và khoảnh khắc tự nhiên không gượng ép.",
      districts: ["Quận 1", "Quận 3", "Bình Thạnh", "Thủ Đức"],
      styles: ["Cinematic", "Film", "Street", "Natural"],
      status: "APPROVED",
      avatar_url: "/assets/creators/minh-khoa.webp",
      completed_count: 154,
      response_time: "30 phút",
      packages: [
        {
          id: "c0000000-0000-0000-0000-000000000005",
          provider_id: "b0000000-0000-0000-0000-000000000003",
          name: "Gói Street Muse / Sài Gòn Chiều",
          service: "Personal",
          description: "Chụp 90 phút dạo phố hoặc quán cà phê vintage tại Quận 1, Quận 3. Màu film hạt cổ điển ấm áp.",
          duration: 90,
          price: 1200000,
          delivery_days: 4,
          includes: "18 ảnh chỉnh màu phim chuẩn điện ảnh + trả toàn bộ file gốc.",
          exclusions: "Chi phí thức uống cá nhân tại quán cà phê.",
          active: true,
        },
        {
          id: "c0000000-0000-0000-0000-000000000006",
          provider_id: "b0000000-0000-0000-0000-000000000003",
          name: "Gói Cinematic Couple / Tình Ca",
          service: "Couple",
          description: "Buổi chụp 120 phút ghi lại câu chuyện tình yêu mộc mạc và chân thành của hai bạn.",
          duration: 120,
          price: 1800000,
          delivery_days: 5,
          includes: "25 ảnh chỉnh màu + 1 video ngắn 30s lồng nhạc hoài niệm.",
          exclusions: "Vé vào cổng studio tư nhân (nếu chọn).",
          active: true,
        },
      ],
      portfolio_assets: [
        { id: "mk-a1", provider_id: "b0000000-0000-0000-0000-000000000003", path: "mk-1.webp", url: "/assets/portfolio/mk-1.webp", caption: "Góc phố chiều Quận 1 - Tone Màu Phim", approved: true },
        { id: "mk-a2", provider_id: "b0000000-0000-0000-0000-000000000003", path: "concept-cinematic.webp", url: "/assets/concepts/concept-cinematic.webp", caption: "Sài Gòn sau mưa - Cinematic Mood", approved: true },
        { id: "mk-a3", provider_id: "b0000000-0000-0000-0000-000000000003", path: "mk-2.webp", url: "/assets/portfolio/mk-2.webp", caption: "Chân dung ánh sáng tự nhiên", approved: true },
      ],
      reviews: [
        { id: "mk-r1", booking_id: "b-07", provider_id: "b0000000-0000-0000-0000-000000000003", author_name: "Thùy Dương", rating: 5, text: "Chất màu film của anh Khoa không chê vào đâu được, vừa nghệ vừa có hồn!", hidden: false, created_at: "2026-10-15T15:00:00Z" },
        { id: "mk-r2", booking_id: "b-08", provider_id: "b0000000-0000-0000-0000-000000000003", author_name: "Tuấn Anh", rating: 4.8, text: "Hai đứa mình đều ngại chụp hình mà anh nói chuyện hài hước làm buổi chụp vui cực.", hidden: false, created_at: "2026-10-09T10:30:00Z" },
      ],
    });
  }

  if (!hasNhiTran) {
    enriched.push({
      id: "b0000000-0000-0000-0000-000000000004",
      owner_id: "a0000000-0000-0000-0000-000000000004",
      slug: "nhi-tran",
      name: "Nhi Trần Editorial Makeup",
      category: "Makeup Artist",
      bio: "Chuyên viên trang điểm thời trang cao cấp, lookbook thương hiệu và layout Y2K / Tây sắc sảo. Từng cộng tác với nhiều tạp chí thời trang và local brand nổi tiếng tại Sài Gòn.",
      districts: ["Quận 1", "Quận 3", "Quận 7", "Phú Nhuận"],
      styles: ["Editorial", "Y2K", "Luxury", "Party/Event"],
      status: "APPROVED",
      avatar_url: "/assets/creators/nhi-tran.webp",
      completed_count: 128,
      response_time: "25 phút",
      packages: [
        {
          id: "c0000000-0000-0000-0000-000000000007",
          provider_id: "b0000000-0000-0000-0000-000000000004",
          name: "Gói Makeup Editorial / Fashion Lookbook",
          service: "Photoshoot makeup",
          description: "Layout chụp lookbook hoặc tạp chí thời trang chuyên nghiệp, tạo khối chuẩn và sắc nét trước ánh đèn flash.",
          duration: 90,
          price: 850000,
          delivery_days: 0,
          includes: "Makeup sắc sảo + tạo kiểu tóc + hỗ trợ dặm phấn trong 1 giờ đầu buổi chụp.",
          exclusions: "Phụ kiện đặc biệt tự cung cấp.",
          active: true,
        },
        {
          id: "c0000000-0000-0000-0000-000000000008",
          provider_id: "b0000000-0000-0000-0000-000000000004",
          name: "Gói Makeup Night Party / Y2K Glam",
          service: "Party/Event",
          description: "Trang điểm dự tiệc đêm nổi bật, nhấn mắt cuốn hút và lớp nền chống nước bền bỉ.",
          duration: 60,
          price: 550000,
          delivery_days: 0,
          includes: "Full makeup + dán mi chùm cao cấp + làm tóc uốn gợn/búi kiểu.",
          exclusions: "Phí di chuyển ngoại thành.",
          active: true,
        },
      ],
      portfolio_assets: [
        { id: "nt-a1", provider_id: "b0000000-0000-0000-0000-000000000004", path: "nt-1.webp", url: "/assets/portfolio/nt-1.webp", caption: "Layout Editorial Runway Sắc Sảo", approved: true },
        { id: "nt-a2", provider_id: "b0000000-0000-0000-0000-000000000004", path: "concept-editorial.webp", url: "/assets/concepts/concept-editorial.webp", caption: "Makeup Y2K Phong Cách Cá Tính", approved: true },
        { id: "nt-a3", provider_id: "b0000000-0000-0000-0000-000000000004", path: "nt-2.webp", url: "/assets/portfolio/nt-2.webp", caption: "Tạo khối sống mũi và mí mắt tự nhiên", approved: true },
      ],
      reviews: [
        { id: "nt-r1", booking_id: "b-09", provider_id: "b0000000-0000-0000-0000-000000000004", author_name: "Yến Nhi", rating: 5, text: "Chị Nhi makeup mắt tây siêu đỉnh, lên hình thời trang cực kỳ sắc nét. Quá xuất sắc!", hidden: false, created_at: "2026-10-17T21:00:00Z" },
        { id: "nt-r2", booking_id: "b-10", provider_id: "b0000000-0000-0000-0000-000000000004", author_name: "Hồng Hạnh", rating: 4.9, text: "Được chị tư vấn chọn tone son hợp với trang phục đi tiệc. Cả đêm quẩy không hề trôi nền.", hidden: false, created_at: "2026-10-11T19:30:00Z" },
      ],
    });
  }

  return enriched;
}
