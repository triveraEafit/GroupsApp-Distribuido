import React, { useState } from "react";
import { login } from "@/shared/api/client";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/shared/ui/Button";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const canSubmit = username.trim() && password.trim();

  async function onSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setErr("");
    setLoading(true);
    try {
      await login({ username, password });
      navigate("/groups");
    } catch (e) {
      setErr(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 text-white">
      <div>
        <h1 className="text-[1.5rem] font-bold">Welcome back</h1>
        <p className="mt-1 text-sm text-white/50">
          Sign in to manage your groups.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className={["float-field", focusedField === "username" || username ? "is-active" : ""].join(" ")}>
          <label htmlFor="login-username">Username</label>
          <input
            id="login-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onFocus={() => setFocusedField("username")}
            onBlur={() => setFocusedField("")}
            autoComplete="username"
          />
        </div>

        <div className={["float-field", focusedField === "password" || password ? "is-active" : ""].join(" ")}>
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setFocusedField("password")}
            onBlur={() => setFocusedField("")}
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-white/55"
            tabIndex={-1}
          >
            👁
          </button>
        </div>

        {err ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {err}
          </div>
        ) : null}

        <Button
          className="h-12 w-full rounded-xl bg-[linear-gradient(135deg,#6366f1,#7c3aed)] font-semibold transition hover:-translate-y-[1px] hover:opacity-90"
          disabled={!canSubmit || loading}
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Signing in...
            </span>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>

      <p className="text-sm text-white/55">
        No account?{" "}
        <Link className="font-semibold text-white hover:underline" to="/register">
          Create one
        </Link>
      </p>
    </div>
  );
}