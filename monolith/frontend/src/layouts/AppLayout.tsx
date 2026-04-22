import * as React from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/shared/ui/Button";
import { tokenStorage } from "@/shared/auth/tokenStorage";
import { useTheme } from "@/shared/theme/useTheme";
import { getUserIdFromToken } from "@/shared/api/client";

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "text-sm font-semibold px-3 py-2 rounded-xl transition",
          isActive
            ? "bg-[rgb(var(--panel2))] border border-[rgb(var(--border))]"
            : "text-[rgb(var(--muted))] hover:text-[rgb(var(--text))] hover:bg-[rgb(var(--panel2))]",
        ].join(" ")
      }
    >
      {label}
    </NavLink>
  );
}

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggle } = useTheme();
  const username = tokenStorage.getUsername();
  const userId = getUserIdFromToken();
  const accountLabel = username || (userId ? `User #${userId}` : "Session");
  const routeLabel =
    location.pathname.startsWith("/chat")
      ? "Chat"
      : location.pathname.startsWith("/groups")
        ? "Groups"
        : "Workspace";

  React.useEffect(() => {
    if (routeLabel === "Chat") return;
    document.title = `${accountLabel} · ${routeLabel} · GroupsApp`;
  }, [accountLabel, routeLabel]);

  const logout = () => {
    tokenStorage.clear();
    navigate("/login", { replace: true });
  };

  const requestMobileSidebar = () => {
    window.dispatchEvent(new CustomEvent("groupsapp:toggle-sidebar"));
  };

  return (
    <div className="min-h-screen theme-bg">
      <header className="sticky top-0 z-10 border-b border-[rgb(var(--border))] bg-[rgb(var(--panel))] backdrop-blur-xl">
        <div className="mx-auto flex h-[52px] max-w-[1200px] items-center gap-3 px-4">
          <button
            type="button"
            onClick={requestMobileSidebar}
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--panel2))] text-base"
            aria-label="Abrir lista de conversaciones"
          >
            ≡
          </button>
          <div className="font-extrabold tracking-[-0.02em]">GroupsApp</div>

          <nav className="flex items-center gap-1">
            <NavItem to="/chat" label="Mensajes" />
          </nav>

          <div className="flex-1" />

          <div className="hidden md:flex items-center gap-3 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--panel2))] px-3 py-1.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[rgb(var(--primary))] to-[rgb(var(--primary2))] text-sm font-semibold text-white">
              {accountLabel.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-[rgb(var(--text))]">
                {accountLabel}
              </div>
              <div className="text-[11px] text-[rgb(var(--muted))]">
                Active tab · {routeLabel}
              </div>
            </div>
          </div>

          <div className="h-6 w-px bg-[rgb(var(--border))]" />
          <Button variant="secondary" onClick={toggle} title={isDark ? "Light mode" : "Dark mode"} className="h-9 w-9 rounded-full p-0">
            {isDark ? "☀" : "☾"}
          </Button>

          <Button variant="secondary" onClick={logout} title="Logout" className="h-9 w-9 rounded-full p-0">
            ↪
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
