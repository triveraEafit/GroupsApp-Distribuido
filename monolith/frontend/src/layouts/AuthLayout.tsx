import { NavLink, Outlet } from "react-router-dom";
import { useTheme } from "@/shared/theme/useTheme";

export function AuthLayout() {
  const { isDark, toggle } = useTheme();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0f1117]">
      <div className="pointer-events-none absolute right-[-180px] top-[-180px] h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.15),transparent_65%)]" />
      <div className="pointer-events-none absolute bottom-[-220px] left-[-220px] h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.08),transparent_65%)]" />

      <button
        type="button"
        onClick={toggle}
        className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white"
        title={isDark ? "Light mode" : "Dark mode"}
      >
        {isDark ? "☀" : "☾"}
      </button>

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-[1220px] grid-cols-1 items-center gap-10 px-6 py-8 lg:grid-cols-2">
        <section className="order-2 lg:order-1">
          <div className="flex items-center gap-3">
            <h1 className="text-[2.5rem] font-extrabold tracking-[-0.03em] text-white">GroupsApp</h1>
            <span className="rounded-full bg-indigo-500/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-indigo-300">
              beta
            </span>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {["FastAPI", "JWT", "PostgreSQL", "WebSockets"].map((item) => (
              <span
                key={item}
                className="rounded-full border border-white/10 bg-white/5 px-[10px] py-[3px] text-[12px] text-white/75"
              >
                {item}
              </span>
            ))}
          </div>

          <div className="mt-8 hidden space-y-4 lg:block">
            {[
              ["Modern UI", "Pastel dark/light themes with clean layouts."],
              ["Groups & Messages", "Built to scale with WebSocket messaging."],
              ["Secure Auth", "JWT-based with session management."],
            ].map(([title, subtitle]) => (
              <div key={title} className="flex items-start gap-3">
                <span className="mt-1 text-[13px] text-[#6366f1]">✦</span>
                <div>
                  <div className="text-sm font-semibold text-white">{title}</div>
                  <div className="text-sm text-white/55">{subtitle}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 text-xs text-white/30">
            Tópicos de Telemática — Proyecto académico
          </div>
        </section>

        <section className="order-1 lg:order-2">
          <div className="mx-auto w-full max-w-[460px] rounded-[20px] border border-white/10 bg-[#1a1d2e] p-6 sm:p-10">
            <div className="mb-6 rounded-xl bg-[#0f1117] p-1">
              <div className="grid grid-cols-2 gap-1">
                <NavLink
                  to="/login"
                  className={({ isActive }) =>
                    [
                      "rounded-lg px-3 py-2 text-center text-sm font-semibold transition-all duration-200",
                      isActive ? "bg-[#6366f1] text-white" : "text-white/65 hover:text-white",
                    ].join(" ")
                  }
                >
                  Iniciar sesión
                </NavLink>
                <NavLink
                  to="/register"
                  className={({ isActive }) =>
                    [
                      "rounded-lg px-3 py-2 text-center text-sm font-semibold transition-all duration-200",
                      isActive ? "bg-[#6366f1] text-white" : "text-white/65 hover:text-white",
                    ].join(" ")
                  }
                >
                  Crear cuenta
                </NavLink>
              </div>
            </div>
            <div className="auth-fade">
              <Outlet />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}