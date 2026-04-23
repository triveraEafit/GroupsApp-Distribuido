import React from "react";
import { Card } from "@/shared/ui/Card";
import { Button } from "@/shared/ui/Button";
import { useTheme } from "@/shared/theme/useTheme";

export default function Settings() {
  const { theme, isDark, toggle } = useTheme();

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-[rgb(var(--panel))] px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.12)] backdrop-blur-xl">
        <h1 className="text-3xl font-extrabold tracking-[-0.03em] text-[rgb(var(--text))]">Settings</h1>
        <p className="mt-1 text-sm text-[rgb(var(--muted))]">
          Centro de ajustes para ir organizando preferencias visuales y del workspace.
        </p>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-[24px] p-6">
          <div className="text-sm font-semibold text-[rgb(var(--text))]">Appearance</div>
          <div className="mt-2 text-sm text-[rgb(var(--muted))]">
            Tema actual: <span className="font-semibold text-[rgb(var(--text))]">{theme}</span>
          </div>
          <div className="mt-4 flex gap-3">
            <Button onClick={toggle}>{isDark ? "Switch To Light" : "Switch To Dark"}</Button>
          </div>
        </Card>

        <Card className="rounded-[24px] p-6">
          <div className="text-sm font-semibold text-[rgb(var(--text))]">Workspace</div>
          <div className="mt-2 text-sm text-[rgb(var(--muted))]">
            Aqui podemos ir sumando ajustes como notificaciones, privacidad del chat, densidad visual y atajos.
          </div>
        </Card>
      </div>
    </div>
  );
}
