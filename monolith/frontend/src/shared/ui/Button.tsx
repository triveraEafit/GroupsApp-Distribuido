import * as React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

const base =
  "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition " +
  "focus:outline-none focus:ring-2 focus:ring-[rgb(var(--primary))]/30 focus:ring-offset-2 focus:ring-offset-transparent " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

export function Button({ variant = "primary", className = "", ...props }: Props) {
  const style =
    variant === "primary"
      ? "text-white shadow-sm bg-gradient-to-b from-[rgb(var(--primary))] to-[rgb(var(--primary2))] hover:brightness-110 active:brightness-95"
      : variant === "secondary"
      ? "bg-[rgb(var(--panel2))] border border-[rgb(var(--border))] text-[rgb(var(--text))] hover:brightness-105"
      : "bg-transparent text-[rgb(var(--text))] hover:bg-[rgb(var(--panel2))]";

  return <button {...props} className={[base, style, className].join(" ")} />;
}