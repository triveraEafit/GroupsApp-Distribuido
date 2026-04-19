import * as React from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export function Input({ label, error, className = "", ...props }: Props) {
  return (
    <label className="block">
      {label ? (
        <span className="mb-1 block text-sm font-semibold text-[rgb(var(--text))]">
          {label}
        </span>
      ) : null}

      <input
        {...props}
        className={[
          "w-full rounded-xl border px-3 py-2 text-sm outline-none transition",
          "bg-[rgb(var(--panel2))] border-[rgb(var(--border))]",
          "text-[rgb(var(--text))] placeholder:text-[rgb(var(--muted))]",
          error
            ? "focus:ring-2 focus:ring-red-400/30"
            : "focus:ring-2 focus:ring-[rgb(var(--primary))]/25",
          className,
        ].join(" ")}
      />

      {error ? <span className="mt-1 block text-xs text-red-400">{error}</span> : null}
    </label>
  );
}