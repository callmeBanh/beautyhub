import { NavLink } from "react-router-dom";
import { CalendarDays, Compass, Heart, UserRound, Camera } from "lucide-react";
export function MobileNav() {
  return (
    <nav className="mobile-bottom-nav" aria-label="Điều hướng nhanh">
      {[
        ["/explore", "Khám phá", Compass],
        ["/saved", "Đã lưu", Heart],
        ["/bookings", "Lịch hẹn", CalendarDays],
        ["/studio", "Creator", Camera],
        ["/account", "Tài khoản", UserRound],
      ].map(([path, label, Icon]) => (
        <NavLink key={String(path)} to={String(path)}>
          <Icon size={20} aria-hidden="true" />
          <span>{String(label)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
