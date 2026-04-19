import { Outlet } from "react-router-dom";
import { Card } from "@/shared/ui/Card";
import { Button } from "@/shared/ui/Button";
import { useTheme } from "@/shared/theme/useTheme";

export function AuthLayout() {
  const { isDark, toggle } = useTheme();

  return (
    <div className="min-h-screen theme-bg">
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-[1100px] grid gap-8 lg:grid-cols-2 items-center">
          {/* Left panel */}
          <div className="hidden lg:block">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-4xl font-semibold tracking-tight">GroupsApp</div>
                <p className="mt-2 text-sm text-[rgb(var(--muted))]">
                  FastAPI • JWT • PostgreSQL • Ready for realtime chat
                </p>
              </div>

              <Button variant="secondary" onClick={toggle}>
                {isDark ? "Light mode" : "Dark mode"}
              </Button>
            </div>

            <div className="mt-8 grid gap-4">
              <Card className="p-5">
                <div className="text-sm font-semibold">Modern UI</div>
                <div className="mt-1 text-sm text-[rgb(var(--muted))]">
                  Pastel dark/light themes with clean layouts.
                </div>
              </Card>

              <Card className="p-5">
                <div className="text-sm font-semibold">Groups & Messages</div>
                <div className="mt-1 text-sm text-[rgb(var(--muted))]">
                  Built to scale into group detail + WebSocket messaging.
                </div>
              </Card>
            </div>

            <div className="mt-10 text-xs text-[rgb(var(--muted))]">
              Tópicos de Telemática — Proyecto académico
            </div>
          </div>

          {/* Auth card */}
          <Card className="p-6 sm:p-8">
            <div className="mb-6 flex items-center justify-between lg:hidden">
              <div>
                <div className="text-xl font-semibold">GroupsApp</div>
                <div className="text-sm text-[rgb(var(--muted))]">FastAPI • JWT • PostgreSQL</div>
              </div>
              <Button variant="secondary" onClick={toggle}>
                {isDark ? "Light" : "Dark"}
              </Button>
            </div>

            <Outlet />
          </Card>
        </div>
      </div>
    </div>
  );
}