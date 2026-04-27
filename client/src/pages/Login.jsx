import { useState } from "react";
import { Lock, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../components/AuthContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("student@demo.com");
  const [password, setPassword] = useState("pass123456");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const user = await login(email, password);
      navigate(user.role === "TEACHER" ? "/teacher" : "/student", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form className="panel w-full max-w-md p-6" onSubmit={onSubmit}>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink">韩语智能训练</h1>
          <p className="mt-2 text-sm text-muted">学生每日训练，教师集中追踪。</p>
        </div>
        <label className="mb-3 block text-sm font-semibold text-slate-700">
          邮箱
          <span className="mt-1 flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2">
            <Mail size={16} className="text-muted" />
            <input className="w-full outline-none" value={email} onChange={(e) => setEmail(e.target.value)} />
          </span>
        </label>
        <label className="mb-4 block text-sm font-semibold text-slate-700">
          密码
          <span className="mt-1 flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2">
            <Lock size={16} className="text-muted" />
            <input
              className="w-full outline-none"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </span>
        </label>
        {error ? <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "登录中..." : "登录"}
        </button>
        <div className="mt-4 grid gap-2 text-xs text-muted">
          <button
            type="button"
            className="text-left hover:text-brand"
            onClick={() => {
              setEmail("student@demo.com");
              setPassword("pass123456");
            }}
          >
            学生演示账号：student@demo.com / pass123456
          </button>
          <button
            type="button"
            className="text-left hover:text-brand"
            onClick={() => {
              setEmail("student2@demo.com");
              setPassword("pass123456");
            }}
          >
            学生2账号：student2@demo.com / pass123456
          </button>
          <button
            type="button"
            className="text-left hover:text-brand"
            onClick={() => {
              setEmail("student3@demo.com");
              setPassword("pass123456");
            }}
          >
            学生3账号：student3@demo.com / pass123456
          </button>
          <button
            type="button"
            className="text-left hover:text-brand"
            onClick={() => {
              setEmail("student4@demo.com");
              setPassword("pass123456");
            }}
          >
            学生4账号：student4@demo.com / pass123456
          </button>
          <button
            type="button"
            className="text-left hover:text-brand"
            onClick={() => {
              setEmail("teacher@demo.com");
              setPassword("pass123456");
            }}
          >
            教师演示账号：teacher@demo.com / pass123456
          </button>
        </div>
      </form>
    </div>
  );
}
