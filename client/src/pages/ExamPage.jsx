import { Play } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import ReadingTrainer from "../components/ReadingTrainer.jsx";

export default function ExamPage() {
  const [paper, setPaper] = useState(null);
  const [answers, setAnswers] = useState({ listening: {}, vocabulary: {} });
  const [readingScore, setReadingScore] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api("/api/student/exam/current").then(setPaper);
  }, []);

  async function submit() {
    const listening = paper.exam.listening.map((item, index) => ({
      answer: item.answer,
      selected: answers.listening[index]
    }));
    const vocabulary = paper.exam.vocabulary.map((item, index) => ({
      answer: item.answer,
      selected: answers.vocabulary[index]
    }));
    setResult(
      await api("/api/student/exam/submit", {
        method: "POST",
        body: JSON.stringify({ listening, vocabulary, readingScore })
      })
    );
  }

  if (!paper) return <div className="panel p-6">加载中...</div>;

  return (
    <div className="grid gap-4">
      <section className="panel p-4">
        <h2 className="text-lg font-bold">每周考试</h2>
        <p className="text-sm text-muted">{paper.weekKey} · 听力、词汇、朗读三项</p>
      </section>

      <section className="panel p-4">
        <h3 className="mb-3 font-bold">听力选择题</h3>
        {paper.exam.listening.map((item, index) => (
          <Question
            key={index}
            title={`${index + 1}. ${item.question}`}
            note={item.audioText}
            speakText={item.audioText}
            choices={item.choices}
            selected={answers.listening[index]}
            onSelect={(choice) =>
              setAnswers((prev) => ({ ...prev, listening: { ...prev.listening, [index]: choice } }))
            }
          />
        ))}
      </section>

      <section className="panel p-4">
        <h3 className="mb-3 font-bold">词汇选择题</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {paper.exam.vocabulary.map((item, index) => (
            <Question
              key={index}
              title={`${item.word} 的意思是？`}
              choices={item.choices}
              selected={answers.vocabulary[index]}
              onSelect={(choice) =>
                setAnswers((prev) => ({ ...prev, vocabulary: { ...prev.vocabulary, [index]: choice } }))
              }
            />
          ))}
        </div>
      </section>

      <section>
        <ReadingTrainer
          reading={{ id: "exam-reading", title: "朗读考试", text: paper.exam.reading.text, translation: paper.exam.reading.prompt }}
          onSubmitted={(response) => setReadingScore(response.score)}
        />
        <label className="mt-3 block text-sm font-semibold">
          朗读分数
          <input
            className="input mt-1 max-w-xs"
            type="number"
            min="0"
            max="100"
            value={readingScore}
            onChange={(e) => setReadingScore(e.target.value)}
          />
        </label>
      </section>

      <button className="btn-primary w-fit" onClick={submit}>
        提交考试
      </button>

      {result ? (
        <section className="panel p-4">
          <h3 className="text-lg font-bold">考试结果：{result.total}</h3>
          <p className="mt-2 text-sm text-muted">
            听力 {Math.round(result.listeningScore)} · 词汇 {Math.round(result.vocabScore)} · 朗读 {readingScore}
          </p>
          <p className="mt-3 rounded-md bg-cyan-50 p-3 text-sm text-brand">{result.advice}</p>
        </section>
      ) : null}
    </div>
  );
}

function Question({ title, note, speakText, choices, selected, onSelect }) {
  function speak() {
    const utterance = new SpeechSynthesisUtterance(speakText);
    utterance.lang = "ko-KR";
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div className="mb-3 rounded-md border border-line p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold">{title}</p>
        {speakText ? (
          <button className="btn-secondary shrink-0" onClick={speak} title="播放听力">
            <Play size={16} />
            播放
          </button>
        ) : null}
      </div>
      {note ? <p className="mt-1 text-sm text-muted">标准句：{note}</p> : null}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {choices.map((choice) => (
          <button
            key={choice}
            className={selected === choice ? "btn-primary" : "btn-secondary"}
            onClick={() => onSelect(choice)}
          >
            {choice}
          </button>
        ))}
      </div>
    </div>
  );
}
