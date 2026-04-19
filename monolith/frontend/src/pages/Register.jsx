import React, { useState } from "react";
import { register } from "@/shared/api/client";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";

export default function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const canSubmit =
    username.trim() &&
    email.trim() &&
    password.trim().length >= 6 &&
    password === confirm;

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setOk("");

    if (password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setErr("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await register({ username, email, password });
      setOk("Registered! Redirecting to login...");
      setTimeout(() => navigate("/login"), 600);
    } catch (e) {
      setErr(e.message || "Register failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[rgb(var(--text))]">Create your account</h1>
        <p className="mt-1 text-sm text-[rgb(var(--muted))]">
          Register to create and join groups.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Username"
          placeholder="your_username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />
        <Input
          label="Email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <Input
          label="Password"
          placeholder="••••••••"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <Input
          label="Confirm password"
          placeholder="••••••••"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />

        {err ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {err}
          </div>
        ) : null}

        {ok ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            {ok}
          </div>
        ) : null}

        <Button className="w-full" disabled={!canSubmit || loading}>
          {loading ? "Creating..." : "Create account"}
        </Button>
      </form>

      <p className="text-sm text-[rgb(var(--muted))]">
        Already have an account?{" "}
        <Link className="font-semibold text-[rgb(var(--text))] hover:underline" to="/login">
          Sign in
        </Link>
      </p>
    </div>
  );
}