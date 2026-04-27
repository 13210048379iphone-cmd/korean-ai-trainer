import { Mic, Play, Square, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "../api/client.js";

export default function ReadingTrainer({ reading, onSubmitted }) {
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [displayMode, setDisplayMode] = useState("ko");
  const [expandZh, setExpandZh] = useState(false);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const recognitionRef = useRef(null);

  async function playStandard() {
    const utterance = new SpeechSynthesisUtterance(reading.text);
    utterance.lang = "ko-KR";
    window.speechSynthesis.speak(utterance);
  }

  async function startRecording() {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setResult({
        finalScore: 0,
        verdict: "retry",
        similarityScore: 0,
        keywordMatchScore: 0,
        lengthScore: 0,
        missingWords: [],
        wrongWords: [],
        feedback: "浏览器没有麦克风权限，请允许录音或手动输入识别文本。"
      });
      return;
    }
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    mediaRef.current = recorder;
    recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
    recorder.onstop = () => {
      setBlob(new Blob(chunksRef.current, { type: "audio/webm" }));
      stream.getTracks().forEach((track) => track.stop());
    };
    recorder.start();
    setRecording(true);
    setResult(null);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = "ko-KR";
        recognition.interimResults = true;
        recognition.continuous = true;
        recognition.onresult = (event) => {
          const text = Array.from(event.results)
            .map((item) => item[0].transcript)
            .join(" ");
          setTranscript(text);
        };
        recognition.start();
        recognitionRef.current = recognition;
      } catch {
        // ignore browser limitations, user can type transcript manually
      }
    }
  }

  function stopRecording() {
    mediaRef.current?.stop();
    recognitionRef.current?.stop();
    setRecording(false);
  }

  async function submit() {
    if (!blob && !transcript.trim()) return;
    setLoading(true);
    const form = new FormData();
    form.append("sentence", reading.text);
    form.append("transcript", transcript);
    if (blob) form.append("audio", blob, "reading.webm");
    const response = await api("/api/student/reading/submit", { method: "POST", body: form });
    setResult(response);
    onSubmitted?.(response);
    setLoading(false);
  }

  const zhText = String(reading.translation || "");
  const shortZh = zhText.length > 90 ? `${zhText.slice(0, 90)}...` : zhText;
  const missingText =
    result?.missingWordsDetailed?.map((item) => (item.meaning ? `${item.word}（${item.meaning}）` : item.word)).join("、") ||
    result?.missingWords?.join("、") ||
    "无";
  const wrongText =
    result?.wrongWordsDetailed?.map((item) => (item.meaning ? `${item.word}（${item.meaning}）` : item.word)).join("、") ||
    result?.wrongWords?.join("、") ||
    "无";

  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-ink">{reading.title}</h3>
          <div className="mt-2 inline-flex rounded-md border border-line p-1">
            <button
              className={displayMode === "ko" ? "btn-primary !px-3 !py-1" : "btn-secondary !px-3 !py-1"}
              onClick={() => setDisplayMode("ko")}
            >
              韩文
            </button>
            <button
              className={displayMode === "zh" ? "btn-primary !px-3 !py-1" : "btn-secondary !px-3 !py-1"}
              onClick={() => setDisplayMode("zh")}
            >
              中文
            </button>
          </div>
          {displayMode === "ko" ? (
            <p className="mt-2 text-xl leading-10 text-ink">{reading.text}</p>
          ) : (
            <div className="mt-2">
              <p className="text-base leading-8 text-slate-700">{expandZh ? zhText : shortZh}</p>
              {zhText.length > 90 ? (
                <button className="mt-1 text-sm font-semibold text-brand hover:underline" onClick={() => setExpandZh((prev) => !prev)}>
                  {expandZh ? "收起中文" : "展开中文"}
                </button>
              ) : null}
            </div>
          )}
        </div>
        <button className="btn-secondary shrink-0" onClick={playStandard} title="播放标准音频">
          <Play size={16} />
          播放
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {!recording ? (
          <button className="btn-primary" onClick={startRecording}>
            <Mic size={16} />
            开始录音
          </button>
        ) : (
          <button className="btn-secondary" onClick={stopRecording}>
            <Square size={16} />
            停止
          </button>
        )}
        <button className="btn-secondary" disabled={(!blob && !transcript.trim()) || loading} onClick={submit}>
          <Upload size={16} />
          {loading ? "分析中..." : "提交语音"}
        </button>
      </div>

      {transcript ? <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm text-slate-700">浏览器转写：{transcript}</p> : null}
      <label className="mt-3 block text-sm font-semibold text-slate-700">
        手动输入识别文本（可选）
        <textarea
          className="input mt-1 min-h-20"
          value={transcript}
          onChange={(event) => setTranscript(event.target.value)}
          placeholder="如果浏览器不能自动识别，你可以手动粘贴朗读内容。"
        />
      </label>
      {result ? (
        <div className="mt-3 grid gap-2 rounded-md bg-rose-50 p-3 text-sm">
          <p className="font-bold text-brand">
            最终分：{result.finalScore ?? result.score} · 判定：
            {result.verdict === "correct" ? "正确" : result.verdict === "partial" ? "部分正确" : "需重读"}
          </p>
          <p>
            相似度：{result.similarityScore ?? "-"} · 关键词：{result.keywordMatchScore ?? "-"} · 长度：{result.lengthScore ?? "-"} · 句段覆盖：
            {result.segmentCoverageScore ?? "-"}
          </p>
          <p>缺词：{missingText}</p>
          <p>错词：{wrongText}</p>
          <p>{result.feedback}</p>
        </div>
      ) : null}
    </div>
  );
}
