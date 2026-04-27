import { BarChart3, BookOpen, ClipboardList, GraduationCap, LogOut } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isTeacher = user?.role === "TEACHER";
  const links = isTeacher
    ? [{ to: "/teacher", label: "教师后台", icon: GraduationCap }]
    : [
        { to: "/student", label: "今日训练", icon: BookOpen },
        { to: "/student/data", label: "学习数据", icon: BarChart3 },
        { to: "/student/exam", label: "每周考试", icon: ClipboardList }
      ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold text-ink">韩语智能训练</h1>
            <p className="text-xs text-muted">{isTeacher ? "Teacher Console" : user?.name || "Student"}</p>
          </div>
          <button
            className="btn-secondary"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            <LogOut size={16} />
            退出
          </button>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 md:grid-cols-[220px_1fr]">
        <nav className="panel flex gap-2 p-2 md:flex-col">
          {links.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${
                    isActive ? "bg-cyan-50 text-brand" : "text-slate-600 hover:bg-slate-50"
                  }`
                }
              >
                <Icon size={17} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
