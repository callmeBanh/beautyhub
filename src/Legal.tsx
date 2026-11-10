import { Link } from "react-router-dom";

function DraftNotice() {
  return (
    <p className="legal-draft-notice" role="note">
      Bản nháp, cần rà soát pháp lý trước khi công bố
    </p>
  );
}

export function Terms() {
  return (
    <article className="page narrow prose legal-page">
      <DraftNotice />
      <h1>Điều khoản sử dụng BeautyHub</h1>
      <p>
        Điều khoản này mô tả cách sử dụng nền tảng BeautyHub. Nội dung đang ở
        dạng dự thảo và cần được rà soát trước khi công bố.
      </p>

      <h2>1. Vai trò của BeautyHub</h2>
      <p>
        BeautyHub là nền tảng kết nối khách hàng với Photographer và Makeup
        Artist độc lập. Creator tự cung cấp dịch vụ; BeautyHub không trực tiếp
        thực hiện và không bảo đảm chất lượng, kết quả hoặc mức độ phù hợp của
        dịch vụ do từng creator cung cấp.
      </p>

      <h2>2. Tài khoản và thông tin dịch vụ</h2>
      <p>
        Người dùng cần cung cấp thông tin chính xác khi tạo tài khoản, hồ sơ,
        gói dịch vụ hoặc yêu cầu đặt lịch. Creator chịu trách nhiệm về nội dung
        hồ sơ, giá và thông tin dịch vụ do mình đăng tải.
      </p>

      <h2>3. Yêu cầu đặt lịch</h2>
      <p>
        Khách hàng có thể xem hồ sơ, chọn gói và gửi yêu cầu đặt lịch trên
        BeautyHub. Việc gửi yêu cầu không thay thế thỏa thuận trực tiếp về các
        chi tiết dịch vụ chưa được thể hiện trong hồ sơ.
      </p>

      <h2>4. Tiền cọc và hòa giải</h2>
      <p>
        Khách chuyển cọc trực tiếp cho creator qua VietQR. BeautyHub không nhận,
        giữ hoặc chuyển tiền cọc. Creator tự xác nhận đã nhận cọc; admin BeautyHub
        chỉ hỗ trợ hòa giải khi có tranh chấp. [CHỜ CHỐT: tỉ lệ hoàn khi hủy
        trước N giờ]
      </p>

      <h2>5. Liên hệ và cập nhật điều khoản</h2>
      <p>
        Người dùng có thể gửi câu hỏi hoặc yêu cầu liên quan đến điều khoản tại{" "}
        <strong>[LIÊN HỆ]</strong>. BeautyHub sẽ cập nhật nội dung điều khoản
        khi có thông tin chính thức được phê duyệt.
      </p>
      <p>
        Xem thêm <Link to="/privacy">Chính sách quyền riêng tư</Link>.
      </p>
    </article>
  );
}

export function Privacy() {
  return (
    <article className="page narrow prose legal-page">
      <DraftNotice />
      <h1>Chính sách quyền riêng tư</h1>
      <p>
        Chính sách dự thảo này tóm tắt dữ liệu BeautyHub xử lý và các lựa chọn
        hiện có. Cần được rà soát pháp lý trước khi công bố.
      </p>

      <h2>1. Dữ liệu có thể được xử lý</h2>
      <ul>
        <li>
          Tài khoản: thông tin đăng nhập và email do nhà cung cấp xác thực trả
          về.
        </li>
        <li>
          Hồ sơ: tên hiển thị, số điện thoại, thông tin creator, phong cách,
          khu vực, gói dịch vụ, ảnh portfolio và đánh giá.
        </li>
        <li>
          Đặt lịch: tên, số điện thoại, khu vực, địa chỉ, thời gian hẹn và ghi
          chú do khách nhập.
        </li>
        <li>Thông tin tài khoản nhận cọc của creator.</li>
        <li>
          Thông tin kỹ thuật cần thiết để vận hành và bảo vệ phiên đăng nhập.
        </li>
      </ul>

      <h2>2. Mục đích và dịch vụ xử lý</h2>
      <p>
        BeautyHub sử dụng dữ liệu để đăng nhập, hiển thị hồ sơ và gói dịch vụ,
        xử lý yêu cầu đặt lịch, hỗ trợ người dùng và vận hành nền tảng. Dữ liệu
        ứng dụng được lưu trữ qua Supabase (xác thực, cơ sở dữ liệu và lưu trữ
        tệp).
      </p>
      <p>
        Google Analytics 4 chỉ được tải khi ứng dụng được cấu hình Measurement
        ID và người dùng chấp nhận. Sự kiện phân tích không gửi tên, email, số
        điện thoại hoặc ID tài khoản; lựa chọn đồng ý/từ chối được lưu trong
        localStorage của trình duyệt.
      </p>

      <h2>3. Cookie và lựa chọn analytics</h2>
      <p>
        BeautyHub không tải Google Analytics trước khi có sự đồng ý. Bạn có thể
        chọn “Từ chối” trên banner hoặc mở “Tùy chọn cookie” ở chân trang để đổi
        lựa chọn. Khi từ chối, Google Analytics không được bật; các chức năng
        tài khoản và đặt lịch vẫn hoạt động.
      </p>
      <p>
        Phiên xác thực Supabase có thể được lưu trong bộ nhớ trình duyệt để duy
        trì đăng nhập. Thời hạn lưu cookie/analytics và cấu hình triển khai cần
        được xác nhận trước khi công bố.
      </p>

      <h2>4. Quyền của bạn</h2>
      <p>
        Bạn có thể yêu cầu xem, chỉnh sửa hoặc xóa dữ liệu cá nhân bằng cách
        liên hệ BeautyHub. Yêu cầu sẽ được tiếp nhận qua <strong>[LIÊN HỆ]</strong>;
        quy trình xác minh và thời hạn xử lý cần được chốt trước khi công bố.
      </p>

      <h2>5. Liên hệ</h2>
      <p>
        Mọi câu hỏi hoặc yêu cầu về dữ liệu cá nhân: <strong>[LIÊN HỆ]</strong>.
      </p>
      <p>
        Xem thêm <Link to="/terms">Điều khoản sử dụng</Link>.
      </p>
    </article>
  );
}
