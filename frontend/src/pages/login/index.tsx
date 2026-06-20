import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "@/shared/api/client";
import type { UserRole } from "@/shared/api/types";
import { validateLoginFields } from "@/shared/lib/validators";
import { useAuthStore } from "@/store/authStore";
import styles from "@/shared/styles/auth-page.module.css";

function postLoginPath(
  role: UserRole,
  target: string
): string {
  if (role === "ADMIN") {
    if (target.startsWith("/admin")) return target;
    return "/admin";
  }
  if (target.startsWith("/admin")) return "/";
  return target || "/";
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const fromState = (location.state as { from?: string } | null)?.from;
  const redirectParam = new URLSearchParams(location.search).get("redirect");
  const target = redirectParam || fromState || "/";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const fe = validateLoginFields(email, password);
    setFieldErrors(fe);
    if (Object.keys(fe).length > 0) return;

    try {
      const r = await api.login({ email: email.trim(), password });
      setAuth(r.token, r.user);
      const to = postLoginPath(r.user.role, target);
      navigate(to, { replace: true });
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="container" style={{ padding: "40px 0 60px" }}>
      <div className={styles.box}>
        <h1 className={styles.title}>Đăng nhập</h1>
        <p className={styles.hint}>
          Tài khoản <strong>khách</strong> và <strong>quản trị</strong> dùng chung form này. Sau khi đăng nhập, hệ thống
          tự chuyển theo vai trò.
        </p>
        <form noValidate onSubmit={submit} className={styles.form}>
          <label>
            Email
            <input
              className={`input ${fieldErrors.email ? "input--invalid" : ""}`}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFieldErrors((p) => ({ ...p, email: undefined }));
              }}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "login-email-err" : undefined}
            />
            {fieldErrors.email && (
              <span id="login-email-err" className="field-error" role="alert">
                {fieldErrors.email}
              </span>
            )}
          </label>
          <label>
            Mật khẩu
            <input
              className={`input ${fieldErrors.password ? "input--invalid" : ""}`}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setFieldErrors((p) => ({ ...p, password: undefined }));
              }}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? "login-password-err" : undefined}
            />
            {fieldErrors.password && (
              <span id="login-password-err" className="field-error" role="alert">
                {fieldErrors.password}
              </span>
            )}
          </label>
          {err && (
            <p className="form-alert" role="alert">
              {err}
            </p>
          )}
          <button type="submit" className="btn btn-primary">
            Đăng nhập
          </button>
        </form>
        <p className={styles.switch}>
          Chưa có tài khoản? <Link to="/dang-ky">Đăng ký khách</Link>
        </p>
        <p className={styles.switch} style={{ marginTop: 8 }}>
          <Link to="/admin">Trang quản trị</Link> (cần tài khoản ADMIN)
        </p>
      </div>
    </div>
  );
}
