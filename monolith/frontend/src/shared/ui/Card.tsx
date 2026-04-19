import * as React from "react";

export function Card({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={[
        "rounded-2xl border shadow-sm backdrop-blur-xl",
        "bg-[rgb(var(--panel))] border-[rgb(var(--border))]",
        className,
      ].join(" ")}
    />
  );
}