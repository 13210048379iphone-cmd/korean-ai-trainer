import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api/client.js";

export default function DataPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const load = () => api("/api/student/records").then(setData);
    load();
    window.addEventListener("profile:changed", load);
    return () => window.removeEventListener("profile:changed", load);
  }, []);

  if (!data) return <div className="panel p-6">加载中...</div>;

  const chart = data.records.map((item) => ({
    date: new Date(item.date).toLocaleDateString(),
    score: Math.round(item.score),
    type: item.type === "reading" ? "朗读" : item.type === "vocab" ? "词汇" : item.type === "exam" ? "考试" : item.type
  }));
  const sortedErrors = [...data.errors].sort((a, b) => b.count - a.count);

  return (
    <div className="grid gap-4">
      <section className="panel p-4">
        <h2 className="text-lg font-bold">今日对比反馈</h2>
        <div className="mt-2 grid gap-2 text-sm md:grid-cols-3">
          <p>今日均分：{data.progressFeedback?.todayAverageScore ?? 0}</p>
          <p>昨日均分：{data.progressFeedback?.yesterdayAverageScore ?? 0}</p>
          <p>分数变化：{data.progressFeedback?.scoreDelta ?? 0}</p>
          <p>今日错误：{data.progressFeedback?.todayErrorCount ?? 0}</p>
          <p>昨日错误：{data.progressFeedback?.yesterdayErrorCount ?? 0}</p>
          <p>错误减少：{data.progressFeedback?.errorReduction ?? 0}</p>
        </div>
      </section>

      <section className="panel p-4">
        <h2 className="mb-3 text-lg font-bold">分数趋势</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line dataKey="score" stroke="#e85b9a" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="panel p-4">
          <h2 className="mb-3 text-lg font-bold">错词列表</h2>
          <div className="grid gap-2">
            {sortedErrors.map((item) => (
              <div key={item.id} className="flex justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
                <span>
                  {item.content}
                  {item.contentMeaning ? `（${item.contentMeaning}）` : ""}
                </span>
                <span>
                  {item.errorTypeLabel || item.errorType} · {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel p-4">
          <h2 className="mb-3 text-lg font-bold">词汇状态</h2>
          <div className="grid gap-2">
            {data.vocabulary.map((item) => (
              <div key={item.id} className="flex justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
                <span>
                  {item.word}
                  {item.meaning ? `（${item.meaning}）` : ""}
                </span>
                <span>{item.statusLabel || item.status} · 错 {item.errorCount}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel p-4">
        <h2 className="mb-3 text-lg font-bold">学习记录</h2>
        <div className="overflow-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-2">日期</th>
                <th>类型</th>
                <th>分数</th>
              </tr>
            </thead>
            <tbody>
              {[...data.records].reverse().map((item) => (
                <tr key={item.id} className="border-t border-line">
                  <td className="py-2">{new Date(item.date).toLocaleString()}</td>
                  <td>{item.type === "reading" ? "朗读" : item.type === "vocab" ? "词汇" : item.type === "exam" ? "考试" : item.type}</td>
                  <td>{Math.round(item.score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel p-4">
        <h2 className="mb-3 text-lg font-bold">个人周报（每周数据表）</h2>
        <div className="overflow-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-2">周区间</th>
                <th>总训练次数</th>
                <th>周均分</th>
                <th>口语均分</th>
                <th>词汇均分</th>
                <th>考试均分</th>
                <th>周错误总数</th>
              </tr>
            </thead>
            <tbody>
              {(data.weeklyReport || []).map((item) => (
                <tr key={item.weekStart} className="border-t border-line">
                  <td className="py-2">{item.weekRange}</td>
                  <td>{item.sessionCount}</td>
                  <td>{item.avgScore}</td>
                  <td>{item.readingAvg}</td>
                  <td>{item.vocabAvg}</td>
                  <td>{item.examAvg}</td>
                  <td>{item.errorCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
