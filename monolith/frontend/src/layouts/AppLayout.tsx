import * as React from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/shared/ui/Button";
import { tokenStorage } from "@/shared/auth/tokenStorage";
import { useTheme } from "@/shared/theme/useTheme";
import { getUserIdFromToken } from "@/shared/api/client";

function IconMessages() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 10h10" />
      <path d="M7 14h6" />
      <path d="M21 12c0 4.97-4.03 9-9 9a9.8 9.8 0 0 1-4.02-.83L3 21l.96-4.34A8.95 8.95 0 0 1 3 12c0-4.97 4.03-9 9-9s9 4.03 9 9Z" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15.2A3.2 3.2 0 1 0 12 8.8a3.2 3.2 0 0 0 0 6.4Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .74 1.7 1.7 0 0 0-.2 1.2V21.5a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-.99-1.57A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 3 15a1.7 1.7 0 0 0-.74-1 1.7 1.7 0 0 0-1.2-.2H1.5a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.57-.99A1.7 1.7 0 0 0 3 7a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 7 3a1.7 1.7 0 0 0 1-.74 1.7 1.7 0 0 0 .2-1.2V1.5a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 .99 1.57A1.7 1.7 0 0 0 17 3a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 21 7a1.7 1.7 0 0 0 .74 1 1.7 1.7 0 0 0 1.2.2h.09a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.57.99A1.7 1.7 0 0 0 19.4 15Z" />
    </svg>
  );
}

function NavItem({ to, label }: { to: string; label: string }) {
  const icon = label === "Mensajes" ? <IconMessages /> : <IconSettings />;
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "inline-flex items-center gap-2 text-sm font-semibold px-3.5 py-2.5 rounded-2xl transition",
          isActive
            ? "bg-[rgb(var(--panel2))] border border-[rgb(var(--border))] text-[rgb(var(--text))] shadow-[0_10px_30px_rgba(0,0,0,0.08)]"
            : "text-[rgb(var(--muted))] hover:text-[rgb(var(--text))] hover:bg-[rgb(var(--panel2))]",
        ].join(" ")
      }
    >
      {icon}
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
        : location.pathname.startsWith("/settings")
          ? "Settings"
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
      <header className="sticky top-0 z-10 border-b border-[rgb(var(--border))] bg-[rgba(var(--bg),0.55)] backdrop-blur-2xl">
        <div className="mx-auto flex h-[68px] max-w-[1720px] items-center gap-3 px-5 xl:px-8">
          <button
            type="button"
            onClick={requestMobileSidebar}
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--panel2))] text-base"
            aria-label="Abrir lista de conversaciones"
          >
            ≡
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(var(--primary),0.9),rgba(var(--primary2),0.9))] text-white shadow-[0_12px_30px_rgba(0,122,255,0.25)]">
              <IconMessages />
            </div>
            <div>
              <div className="font-extrabold tracking-[-0.03em]">GroupsApp</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-[rgb(var(--muted))]">Workspace</div>
            </div>
          </div>

          <nav className="flex items-center gap-1 rounded-[22px] border border-[rgb(var(--border))] bg-[rgb(var(--panel))] px-1.5 py-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
            <NavItem to="/chat" label="Mensajes" />
            <NavItem to="/settings" label="Settings" />
          </nav>

          <div className="flex-1" />

          <div className="hidden xl:flex items-center gap-3 rounded-[24px] border border-[rgb(var(--border))] bg-[rgb(var(--panel))] px-4 py-2 shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
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
          <Button variant="secondary" onClick={toggle} title={isDark ? "Light mode" : "Dark mode"} className="h-10 w-10 rounded-full p-0 border-white/10 bg-[rgb(var(--panel))]">
            {isDark ? "☀" : "☾"}
          </Button>

          <Button variant="secondary" onClick={logout} title="Logout" className="h-10 w-10 rounded-full p-0 border-white/10 bg-[rgb(var(--panel))]">
            ↪
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[1720px] px-5 py-6 xl:px-8">
        <Outlet />
      </main>
    </div>
  );
}
