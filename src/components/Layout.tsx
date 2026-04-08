import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Compass, Download, Heart, User } from "lucide-react";
import SearchBar from "./SearchBar";

interface LayoutProps {
  children: ReactNode;
  onSwitchProfile: () => void;
}

export default function Layout({ children, onSwitchProfile }: LayoutProps) {
  const location = useLocation();
  const isWatching = location.pathname.startsWith("/watch/");

  if (isWatching) {
    return <>{children}</>;
  }

  const navLinks = [
    { to: "/", icon: Home, label: "Home" },
    { to: "/browse", icon: Compass, label: "Browse" },
    { to: "/watchlist", icon: Heart, label: "Watchlist" },
    { to: "/downloads", icon: Download, label: "Downloads" },
  ];

  const isActive = (to: string) =>
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Top Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-zinc-950 via-zinc-950/95 to-transparent">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
          <div className="flex h-14 sm:h-16 items-center justify-between gap-4">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <span className="text-xl sm:text-2xl font-black tracking-[0.18em] text-rose-400">
                MOTCHI
              </span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-6">
              {navLinks.map(({ to, icon: Icon, label }) => (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                    isActive(to)
                      ? "text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              ))}
            </div>

            {/* Search + Profile */}
            <div className="flex items-center gap-2 sm:gap-3">
              <SearchBar />
              <button
                onClick={onSwitchProfile}
                className="flex items-center gap-2 rounded-full bg-zinc-800 px-2.5 py-1.5 sm:px-3 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                <User size={16} />
                <span className="hidden sm:inline">Profile</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="pt-14 sm:pt-16 pb-16 md:pb-0">{children}</main>

      {/* Mobile bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800/80 safe-area-bottom">
        <div className="flex items-center justify-around h-14">
          {navLinks.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                isActive(to)
                  ? "text-rose-400"
                  : "text-zinc-500 active:text-zinc-300"
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
