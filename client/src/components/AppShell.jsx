import { BarChart3, BookOpen, ClipboardList, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";

export default function AppShell() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [activeStudentId, setActiveStudentId] = useState("");
  const [newName, setNewName] = useState("");
  const [newLevel, setNewLevel] = useState("TOPIK0");
  const [profileHint, setProfileHint] = useState("");

  const links = [
    { to: "/student", label: "今日训练", icon: BookOpen },
    { to: "/student/data", label: "学习数据", icon: BarChart3 },
    { to: "/student/exam", label: "每周考试", icon: ClipboardList }
  ];

  async function loadProfiles() {
    const result = await api("/api/profiles");
    setProfiles(result.profiles || []);
    setActiveStudentId(result.activeStudentId || "");
  }

  useEffect(() => {
    loadProfiles();
  }, []);

  async function switchProfile(studentId) {
    const result = await api("/api/profiles/select", {
      method: "POST",
      body: JSON.stringify({ studentId })
    });
    setProfiles(result.profiles || []);
    setActiveStudentId(result.activeStudentId || "");
    const selected = (result.profiles || []).find((item) => item.id === studentId);
    setProfileHint(selected ? `已切换到 ${selected.name}（${selected.level}）` : "已切换学习者");
    window.dispatchEvent(new CustomEvent("profile:changed", { detail: { studentId } }));
    navigate("/student");
  }

  async function createProfile() {
    if (!newName.trim()) return;
    const result = await api("/api/profiles/create", {
      method: "POST",
      body: JSON.stringify({ name: newName.trim(), level: newLevel })
    });
    setProfiles(result.profiles || []);
    setActiveStudentId(result.activeStudentId || "");
    setProfileHint(`已添加用户 ${newName.trim()}（${newLevel}）`);
    setNewName("");
    setNewLevel("TOPIK0");
    window.dispatchEvent(new CustomEvent("profile:changed", { detail: { studentId: result.activeStudentId } }));
    navigate("/student");
  }

  const activeProfile = profiles.find((item) => item.id === activeStudentId);

  return (
    <div className="min-h-screen bg-rose-50/40">
      <header className="border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-lg font-bold text-ink">韩语智能训练</h1>
            <p className="text-xs text-muted">免登录 · 单机模式 · 自动记录每位学习者 · 今天也一起开口说韩语</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="input h-10 min-w-36 py-0"
              value={activeStudentId}
              onChange={(event) => switchProfile(event.target.value)}
              title="切换用户"
            >
              {profiles.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.level} · 连续{item.streakDays}天
                </option>
              ))}
            </select>
            <input
              className="input h-10 min-w-28 py-0"
              placeholder="输入用户名（如 777）"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") createProfile();
              }}
            />
            <select
              className="input h-10 min-w-28 py-0"
              value={newLevel}
              onChange={(event) => setNewLevel(event.target.value)}
              title="选择等级"
            >
              <option value="TOPIK0">TOPIK0（零基础）</option>
              <option value="TOPIK1">TOPIK1（初级）</option>
              <option value="TOPIK2">TOPIK2（中级）</option>
              <option value="TOPIK3">TOPIK3（进阶）</option>
            </select>
            <button className="btn-secondary h-10" onClick={createProfile}>
              <Plus size={16} />
              添加用户
            </button>
          </div>
        </div>
        {profileHint ? (
          <div className="mx-auto max-w-7xl px-4 pb-2">
            <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-brand">{profileHint}</p>
          </div>
        ) : null}
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
                    isActive ? "bg-rose-100 text-brand" : "text-slate-600 hover:bg-rose-50"
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
          {activeProfile ? (
            <p className="mb-3 text-xs text-muted">
              当前学习者：{activeProfile.name}（{activeProfile.level}）
            </p>
          ) : null}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
