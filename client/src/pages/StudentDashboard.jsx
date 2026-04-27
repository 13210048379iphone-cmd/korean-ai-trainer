import { RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import ReadingTrainer from "../components/ReadingTrainer.jsx";

export default function StudentDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [answers, setAnswers] = useState({});
  const [message, setMessage] = useState("");
  const [latestResult, setLatestResult] = useState(null);

  async function load() {
    setDashboard(await api("/api/student/dashboard"));
  }

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("profile:changed", handler);
    return () => window.removeEventListener("profile:changed", handler);
  }, []);

  async function regenerate() {
    try {
      const task = await api("/api/student/daily/generate", { method: "POST" });
      setDashboard((prev) => ({ ...prev, task }));
      setMessage("已生成新的今日任务。");
    } catch (error) {
      setMessage(error.message || "今日任务已完成，不能重新生成。");
    }
  }

  async function answer(item, selected) {
    const result = await api("/api/student/vocab/answer", {
      method: "POST",
      body: JSON.stringify({ word: item.word, selected, answer: item.answer })
    });
    setAnswers((prev) => ({ ...prev, [item.word]: { selected, ...result } }));
    setMessage(result.correct ? "回答正确，已记录。" : `回答错误，正确答案是：${item.answer}`);
    setLatestResult(result);
    await load();
  }

  if (!dashboard) return <div className="panel p-6">加载中...</div>;

  const { student, task, today, recentErrors, progressFeedback, taskProgress } = dashboard;
  return (
    <div className="grid gap-4">
      <section className="grid gap-3 md:grid-cols-4">
        <Stat label="当前等级" value={student.level} />
        <Stat label="连续学习" value={`${student.streakDays} 天`} />
        <Stat label="今日朗读" value={`${today.readings} 篇`} />
        <Stat label="今日词汇" value={`${today.vocabulary} 个`} />
      </section>

      <section className="panel p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">今日任务</h2>
            <p className="text-sm text-muted">
              当前题库难度：{student.level}。口语优先：朗读 {taskProgress?.readingTarget ?? 6} 篇，词汇辅助{" "}
              {taskProgress?.vocabTarget ?? 4} 题，错题循环复习。
            </p>
          </div>
          <button className="btn-secondary" onClick={regenerate}>
            <RefreshCcw size={16} />
            刷新今日题目
          </button>
        </div>
        <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
          <p>朗读进度：{taskProgress?.readingDone ?? 0}/{taskProgress?.readingTarget ?? 6}</p>
          <p>词汇进度：{taskProgress?.vocabDone ?? 0}/{taskProgress?.vocabTarget ?? 4}</p>
          <p className={taskProgress?.isCompleted ? "text-green-700" : "text-amber-700"}>
            {taskProgress?.isCompleted ? "今日任务已完成" : "今日任务进行中"}
          </p>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="panel p-4">
          <h2 className="text-lg font-bold">进步反馈</h2>
          <p className="mt-2 text-sm text-muted">
            今日均分 {progressFeedback?.todayAverageScore ?? 0}，昨日均分 {progressFeedback?.yesterdayAverageScore ?? 0}
          </p>
          <p className="mt-1 text-sm">
            分数变化：
            <span className={(progressFeedback?.scoreDelta ?? 0) >= 0 ? "text-green-700" : "text-red-700"}>
              {` ${progressFeedback?.scoreDelta >= 0 ? "+" : ""}${progressFeedback?.scoreDelta ?? 0}`}
            </span>
          </p>
          <p className="mt-1 text-sm">
            错误变化：
            <span className={(progressFeedback?.errorReduction ?? 0) >= 0 ? "text-green-700" : "text-red-700"}>
              {` 减少 ${progressFeedback?.errorReduction ?? 0}`}
            </span>
          </p>
        </div>
        <div className="panel p-4">
          <h2 className="text-lg font-bold">等级与连续学习</h2>
          <p className="mt-2 text-sm text-muted">系统会在完成每日任务后自动更新 streak，并按最近 3 天平均分调整等级。</p>
          {latestResult?.levelUpdate ? (
            <p className="mt-2 text-sm">
              最近3天均分 {latestResult.levelUpdate.recent3DayAverage ?? "-"}，当前等级 {latestResult.levelUpdate.currentLevel}
            </p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-3">
        <h2 className="text-lg font-bold">朗读训练</h2>
        {task.readings?.map((reading) => (
          <ReadingTrainer
            key={reading.id || reading.title}
            reading={reading}
            onSubmitted={async (result) => {
              setLatestResult(result);
              await load();
            }}
          />
        ))}
      </section>

      <section className="panel p-4">
        <h2 className="mb-3 text-lg font-bold">词汇选择题</h2>
        {message ? <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{message}</p> : null}
        <div className="grid gap-3 md:grid-cols-2">
          {task.vocabulary?.map((item) => (
            <div key={item.word} className="rounded-md border border-line p-3">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold">{item.word}</p>
                  <p className="text-xs text-muted">{item.meaning}</p>
                </div>
                {answers[item.word] ? (
                  <span className={answers[item.word].correct ? "text-sm text-green-700" : "text-sm text-red-700"}>
                    {answers[item.word].correct ? "正确" : "错误"}
                  </span>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {item.choices.map((choice) => (
                  <button key={choice} className="btn-secondary" onClick={() => answer(item, choice)}>
                    {choice}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel p-4">
        <h2 className="mb-3 text-lg font-bold">错题复习</h2>
        {recentErrors.length ? (
          <div className="flex flex-wrap gap-2">
            {recentErrors.map((item) => (
              <span key={item.id} className="rounded-md bg-slate-100 px-3 py-2 text-sm">
                {item.content}
                {item.contentMeaning ? `（${item.contentMeaning}）` : ""}
                {` · ${item.errorTypeLabel || "错误"} · ${item.count} 次`}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">暂无错题，完成训练后会自动进入循环复习。</p>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="panel p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}
