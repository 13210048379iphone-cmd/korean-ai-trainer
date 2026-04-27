import { Headphones, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { API_BASE, api } from "../api/client.js";

export default function TeacherDashboard() {
  const [students, setStudents] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [audio, setAudio] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    Promise.all([api("/api/teacher/students"), api("/api/teacher/analytics"), api("/api/teacher/audio")]).then(
      ([studentData, analyticsData, audioData]) => {
        setStudents(studentData);
        setAnalytics(analyticsData);
        setAudio(audioData);
      }
    );
  }, []);

  const chart = students.map((student) => ({
    name: student.name,
    avg: student.studyRecords.length
      ? Math.round(student.studyRecords.reduce((sum, item) => sum + item.score, 0) / student.studyRecords.length)
      : 0
  }));

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 md:grid-cols-4">
        <Stat icon={Users} label="学生数" value={analytics?.students ?? 0} />
        <Stat label="平均分" value={analytics?.avgScore ?? 0} />
        <Stat icon={Headphones} label="语音记录" value={analytics?.audioCount ?? 0} />
        <Stat label="朗读均分" value={analytics?.audioAvgScore ?? 0} />
      </section>

      <section className="panel p-4">
        <h2 className="mb-3 text-lg font-bold">学生表现</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="avg" fill="#176b87" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="panel p-4">
          <h2 className="mb-3 text-lg font-bold">学生列表</h2>
          <div className="grid gap-2">
            {students.map((student) => (
              <button
                key={student.id}
                className="rounded-md border border-line p-3 text-left hover:bg-slate-50"
                onClick={async () => setSelected(await api(`/api/teacher/students/${student.id}`))}
              >
                <div className="flex justify-between">
                  <span className="font-bold">{student.name}</span>
                  <span className="text-sm text-muted">{student.level}</span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  学习记录 {student._count.studyRecords} · 语音 {student._count.audioRecords}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="panel p-4">
          <h2 className="mb-3 text-lg font-bold">高频错误</h2>
          <div className="grid gap-2">
            {analytics?.topErrors?.map((item) => (
              <div key={item.id} className="flex justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
                <span>{item.student.name} · {item.content}</span>
                <span>{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {selected ? (
        <section className="panel p-4">
          <h2 className="mb-3 text-lg font-bold">{selected.name} 详情</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <MiniList title="错题" items={selected.errorRecords.map((x) => `${x.content} · ${x.count}`)} />
            <MiniList title="词汇" items={selected.vocabularyStatuses.map((x) => `${x.word} · ${x.status}`)} />
            <MiniList title="考试" items={selected.examResults.map((x) => `${x.weekKey} · ${Math.round(x.total)}`)} />
          </div>
        </section>
      ) : null}

      <section className="panel p-4">
        <h2 className="mb-3 text-lg font-bold">学生语音记录</h2>
        <div className="grid gap-2">
          {audio.map((item) => (
            <div key={item.id} className="rounded-md bg-slate-50 p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-semibold">{item.student.name}</span>
                <span>分数 {Math.round(item.score)}</span>
              </div>
              <p className="mt-1">{item.sentence}</p>
              <p className="mt-1 text-muted">转写：{item.transcript || "无"}</p>
              <AudioPreview audioUrl={item.audioUrl} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 text-sm text-muted">{Icon ? <Icon size={16} /> : null}{label}</div>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function MiniList({ title, items }) {
  return (
    <div className="rounded-md border border-line p-3">
      <h3 className="mb-2 font-bold">{title}</h3>
      <div className="grid gap-1 text-sm text-muted">
        {items.slice(0, 8).map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </div>
  );
}

function AudioPreview({ audioUrl }) {
  const canvasRef = useRef(null);
  const [duration, setDuration] = useState(0);
  const src = toAbsoluteAudioUrl(audioUrl);

  useEffect(() => {
    let active = true;
    async function draw() {
      if (!src || !canvasRef.current) return;
      try {
        const response = await fetch(src);
        if (!response.ok) return;
        const bytes = await response.arrayBuffer();
        const context = new (window.AudioContext || window.webkitAudioContext)();
        const buffer = await context.decodeAudioData(bytes.slice(0));
        if (!active || !canvasRef.current) {
          await context.close();
          return;
        }

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        const data = buffer.getChannelData(0);
        const bars = 50;
        const step = Math.floor(data.length / bars) || 1;
        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "#c9d7eb";
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "#176b87";
        for (let i = 0; i < bars; i += 1) {
          const start = i * step;
          const end = Math.min(start + step, data.length);
          let sum = 0;
          for (let j = start; j < end; j += 1) sum += Math.abs(data[j]);
          const avg = sum / Math.max(end - start, 1);
          const barH = Math.max(2, avg * height * 2.2);
          const barW = width / bars - 1;
          ctx.fillRect(i * (width / bars), (height - barH) / 2, barW, barH);
        }
        await context.close();
      } catch {
        // ignore decode errors to avoid blocking teacher page
      }
    }
    draw();
    return () => {
      active = false;
    };
  }, [src]);

  if (!src) return <p className="mt-2 text-xs text-muted">无可播放音频</p>;

  return (
    <div className="mt-2 rounded-md border border-line bg-white p-2">
      <div className="mb-2 flex items-center justify-between text-xs text-muted">
        <span>时长：{duration ? `${duration.toFixed(1)}s` : "读取中..."}</span>
      </div>
      <canvas ref={canvasRef} width={320} height={48} className="mb-2 h-12 w-full rounded-sm" />
      <audio
        className="w-full"
        controls
        src={src}
        onLoadedMetadata={(event) => setDuration(Number(event.currentTarget.duration || 0))}
      />
    </div>
  );
}

function toAbsoluteAudioUrl(audioUrl) {
  if (!audioUrl) return "";
  if (audioUrl.startsWith("http://") || audioUrl.startsWith("https://")) return audioUrl;
  if (audioUrl.startsWith("/")) return `${API_BASE}${audioUrl}`;
  return `${API_BASE}/${audioUrl}`;
}
