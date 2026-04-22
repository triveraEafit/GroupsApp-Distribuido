import React, { useState } from "react";
import { register } from "@/shared/api/client";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/shared/ui/Button";

function getStrength(password) {
  let score = 0;
  if (password.length >= 6) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password) || password.length >= 10) score += 1;
  return score;
}

export default function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focusedField, setFocusedField] = useState("");
  const [touched, setTouched] = useState({});

  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const canSubmit =
    username.trim() &&
    email.trim() &&
    password.trim().length >= 6 &&
    password === confirm;
  const strength = getStrength(password);
  const isUsernameValid = username.trim().length >= 3;
  const isEmailValid = /\S+@\S+\.\S+/.test(email.trim());
  const isConfirmValid = confirm.length > 0 && confirm === password;

  function onBlurField(field) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setFocusedField("");
  }

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
    <div className="space-y-6 text-white">
      <div>
        <h1 className="text-[1.5rem] font-bold">Create account</h1>
        <p className="mt-1 text-sm text-white/50">
          Register to create and manage your groups.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <div className={["float-field", focusedField === "username" || username ? "is-active" : ""].join(" ")}>
            <label htmlFor="register-username">Username</label>
            <input
              id="register-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onFocus={() => setFocusedField("username")}
              onBlur={() => onBlurField("username")}
              autoComplete="username"
            />
          </div>
          {touched.username ? (
            <div className={["mt-1 text-xs", isUsernameValid ? "text-emerald-400" : "text-red-400"].join(" ")}>
              {isUsernameValid ? "✓ Looks good" : "Username must have at least 3 characters."}
            </div>
          ) : null}
        </div>

        <div>
          <div className={["float-field", focusedField === "email" || email ? "is-active" : ""].join(" ")}>
            <label htmlFor="register-email">Email</label>
            <input
              id="register-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocusedField("email")}
              onBlur={() => onBlurField("email")}
              autoComplete="email"
            />
          </div>
          {touched.email ? (
            <div className={["mt-1 text-xs", isEmailValid ? "text-emerald-400" : "text-red-400"].join(" ")}>
              {isEmailValid ? "✓ Valid email" : "Please enter a valid email address."}
            </div>
          ) : null}
        </div>

        <div>
          <div className={["float-field", focusedField === "password" || password ? "is-active" : ""].join(" ")}>
            <label htmlFor="register-password">Password</label>
            <input
              id="register-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocusedField("password")}
              onBlur={() => onBlurField("password")}
              autoComplete="new-password"
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
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={[
                  "h-1.5 rounded-full",
                  i < strength
                    ? strength <= 1
                      ? "bg-red-400"
                      : strength <= 2
                        ? "bg-yellow-400"
                        : "bg-emerald-400"
                    : "bg-white/10",
                ].join(" ")}
              />
            ))}
          </div>
        </div>

        <div>
          <div className={["float-field", focusedField === "confirm" || confirm ? "is-active" : ""].join(" ")}>
            <label htmlFor="register-confirm">Confirm password</label>
            <input
              id="register-confirm"
              type={showConfirm ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onFocus={() => setFocusedField("confirm")}
              onBlur={() => onBlurField("confirm")}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-white/55"
              tabIndex={-1}
            >
              👁
            </button>
          </div>
          {touched.confirm ? (
            <div className={["mt-1 text-xs", isConfirmValid ? "text-emerald-400" : "text-red-400"].join(" ")}>
              {isConfirmValid ? "✓ Passwords match" : "Passwords do not match."}
            </div>
          ) : null}
        </div>

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

        <Button
          className="h-12 w-full rounded-xl bg-[linear-gradient(135deg,#6366f1,#7c3aed)] font-semibold transition hover:-translate-y-[1px] hover:opacity-90"
          disabled={!canSubmit || loading}
        >
          {loading ? "Creating..." : "Create account"}
        </Button>
      </form>

      <p className="text-sm text-white/55">
        Already have an account?{" "}
        <Link className="font-semibold text-white hover:underline" to="/login">
          Sign in
        </Link>
      </p>
    </div>
  );
}