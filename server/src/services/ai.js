import fs from "node:fs";
import OpenAI from "openai";
import { compareSpeech } from "./scoring.js";

const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

function parseJson(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text?.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    try {
      return JSON.parse(match[0]);
    } catch {
      return fallback;
    }
  }
}

export function fallbackDailyTask(level = "A1", errors = []) {
  const focus = errors[0]?.content || "학교";
  return {
    readings: [
      {
        id: "reading-1",
        title: "아침 인사",
        text: `안녕하세요. 저는 오늘 ${focus}에 가요. 친구와 같이 한국어를 공부해요.`,
        translation: "你好。我今天去学校。和朋友一起学习韩语。"
      },
      {
        id: "reading-2",
        title: "하루 계획",
        text: "오늘은 날씨가 좋아요. 저는 커피를 마시고 책을 읽어요.",
        translation: "今天天气很好。我喝咖啡并读书。"
      }
    ],
    vocabulary: [
      { word: "학교", meaning: "学校", choices: ["学校", "医院", "公司", "机场"], answer: "学校" },
      { word: "친구", meaning: "朋友", choices: ["朋友", "老师", "学生", "家人"], answer: "朋友" },
      { word: "공부하다", meaning: "学习", choices: ["学习", "休息", "工作", "运动"], answer: "学习" },
      { word: "날씨", meaning: "天气", choices: ["天气", "时间", "心情", "房间"], answer: "天气" },
      { word: "좋아요", meaning: "好", choices: ["好", "远", "贵", "冷"], answer: "好" },
      { word: "마시다", meaning: "喝", choices: ["喝", "吃", "听", "看"], answer: "喝" },
      { word: "책", meaning: "书", choices: ["书", "笔", "包", "椅子"], answer: "书" },
      { word: "읽다", meaning: "读", choices: ["读", "写", "说", "买"], answer: "读" },
      { word: "오늘", meaning: "今天", choices: ["今天", "明天", "昨天", "晚上"], answer: "今天" },
      { word: "같이", meaning: "一起", choices: ["一起", "马上", "非常", "已经"], answer: "一起" }
    ],
    review: errors.slice(0, 5),
    level
  };
}

const VOCAB_DICTIONARY = [
  { word: "학교", meaning: "学校", distractors: ["医院", "公司", "机场"] },
  { word: "친구", meaning: "朋友", distractors: ["老师", "学生", "家人"] },
  { word: "공부하다", meaning: "学习", distractors: ["休息", "工作", "运动"] },
  { word: "날씨", meaning: "天气", distractors: ["时间", "心情", "房间"] },
  { word: "좋아요", meaning: "好", distractors: ["远", "贵", "冷"] },
  { word: "마시다", meaning: "喝", distractors: ["吃", "听", "看"] },
  { word: "책", meaning: "书", distractors: ["笔", "包", "椅子"] },
  { word: "읽다", meaning: "读", distractors: ["写", "说", "买"] },
  { word: "오늘", meaning: "今天", distractors: ["明天", "昨天", "晚上"] },
  { word: "같이", meaning: "一起", distractors: ["马上", "非常", "已经"] },
  { word: "시장", meaning: "市场", distractors: ["车站", "教室", "公园"] },
  { word: "가족", meaning: "家人", distractors: ["同学", "同事", "邻居"] },
  { word: "연습", meaning: "练习", distractors: ["休息", "旅行", "比赛"] },
  { word: "발음", meaning: "发音", distractors: ["语法", "拼写", "语速"] }
];

function uniqWords(words = []) {
  return [...new Set(words.filter(Boolean).map((item) => String(item).trim()))];
}

function shuffle(list) {
  return [...list].sort(() => Math.random() - 0.5);
}

function toVocabItem(word) {
  const entry = VOCAB_DICTIONARY.find((item) => item.word === word);
  if (!entry) {
    return {
      word,
      meaning: `词义：${word}`,
      choices: [`词义：${word}`, "表示地点", "表示动作", "表示人物"],
      answer: `词义：${word}`
    };
  }
  return {
    word: entry.word,
    meaning: entry.meaning,
    choices: shuffle([entry.meaning, ...entry.distractors]).slice(0, 4),
    answer: entry.meaning
  };
}

function ensureReadingContainsWords(text, words) {
  const source = text || "오늘 한국어를 연습해요.";
  const missing = words.filter((word) => !source.includes(word));
  if (!missing.length) return source;
  return `${source} ${missing.join(" ")}.`;
}

function enforceDailyTaskConstraints(task, { level, errors, unknownWords }) {
  const normalized = task && typeof task === "object" ? { ...task } : {};
  const errorWordPool = uniqWords(errors.map((item) => item.content));
  const backupWords = VOCAB_DICTIONARY.map((item) => item.word);
  const unknownPool = uniqWords([...unknownWords, ...errorWordPool, ...backupWords]).slice(0, 12);
  const errorPool = errors.map((item) => ({
    content: item.content,
    errorType: item.errorType,
    count: item.count
  }));
  const review = errorPool.slice(0, 8);

  const readings = (normalized.readings || [])
    .slice(0, 2)
    .map((reading, index) => ({
      id: reading.id || `reading-${index + 1}`,
      title: reading.title || `朗读 ${index + 1}`,
      text: String(reading.text || ""),
      translation: String(reading.translation || "")
    }));

  while (readings.length < 2) {
    readings.push({
      id: `reading-${readings.length + 1}`,
      title: `朗读 ${readings.length + 1}`,
      text: "오늘은 한국어 발음을 연습해요.",
      translation: "今天练习韩语发音。"
    });
  }

  // 每篇朗读至少包含 2-3 个未掌握词（不足时尽量填充）
  readings.forEach((reading, index) => {
    const focus = unknownPool.slice(index * 3, index * 3 + 3);
    reading.text = ensureReadingContainsWords(reading.text, focus.slice(0, Math.max(2, Math.min(3, focus.length))));
  });

  const unknownTargetCount = Math.ceil(10 * 0.7);
  const unknownItems = unknownPool.slice(0, unknownTargetCount).map(toVocabItem);
  const existing = (normalized.vocabulary || [])
    .map((item) => ({
      word: String(item.word || ""),
      meaning: String(item.meaning || ""),
      choices: Array.isArray(item.choices) ? item.choices.map(String).slice(0, 4) : [],
      answer: String(item.answer || "")
    }))
    .filter((item) => item.word && item.choices.length === 4 && item.answer);

  const used = new Set(unknownItems.map((item) => item.word));
  const merged = [...unknownItems];
  for (const item of existing) {
    if (merged.length >= 10) break;
    if (used.has(item.word)) continue;
    used.add(item.word);
    merged.push(item);
  }
  const fillPool = shuffle(VOCAB_DICTIONARY.map((item) => item.word));
  for (const word of fillPool) {
    if (merged.length >= 10) break;
    if (used.has(word)) continue;
    used.add(word);
    merged.push(toVocabItem(word));
  }

  return {
    readings,
    vocabulary: merged.slice(0, 10),
    review,
    level
  };
}

function fallbackPersonalizedTask(level, errors, unknownWords = []) {
  const base = fallbackDailyTask(level, errors);
  return enforceDailyTaskConstraints(base, { level, errors, unknownWords });
}

export async function generateDailyTask({ level, errors, records, unknownWords }) {
  const fallback = fallbackPersonalizedTask(level, errors, unknownWords);
  if (!client) return fallback;

  const weakWords = uniqWords(unknownWords).slice(0, 20);
  const topErrorWords = uniqWords(errors.map((item) => item.content)).slice(0, 20);
  const prompt = [
    "Generate a Korean learning daily task as strict JSON.",
    "Schema: { readings:[{id,title,text,translation}], vocabulary:[{word,meaning,choices,answer}], review:[{content,errorType,count}], level }.",
    "Constraints:",
    "1) exactly 2 readings and each reading MUST include at least 2-3 words from unknownWords list.",
    "2) exactly 10 vocabulary multiple-choice items and at least 70% must come from unknownWords list.",
    "3) review list must come from errorRecords only, do not invent new review items.",
    "4) choices in Chinese, answer equals one choice.",
    `Student level: ${level}.`,
    `unknownWords: ${JSON.stringify(weakWords)}`,
    `errorRecords: ${JSON.stringify(errors)}`,
    `topErrorWords: ${JSON.stringify(topErrorWords)}`,
    `Recent scores: ${JSON.stringify(records)}`
  ].join("\n");

  try {
    const response = await client.responses.create({
      model: process.env.AI_TEXT_MODEL || "gpt-5.2",
      input: prompt
    });

    const raw = parseJson(response.output_text, fallback);
    return enforceDailyTaskConstraints(raw, { level, errors, unknownWords });
  } catch {
    return fallback;
  }
}

export async function generateWeeklyExam({ level, errors }) {
  const fallback = {
    listening: [
      {
        audioText: "저는 아침에 물을 마셔요.",
        question: "说话者早上喝什么？",
        choices: ["水", "咖啡", "茶", "牛奶"],
        answer: "水"
      }
    ],
    vocabulary: fallbackDailyTask(level, errors).vocabulary.slice(0, 5),
    reading: {
      text: "저는 한국어를 매일 연습해요. 발음이 조금 어려워요.",
      prompt: "请朗读这段文字。"
    },
    rubric: { listening: 30, vocabulary: 40, reading: 30 }
  };
  if (!client) return fallback;

  try {
    const response = await client.responses.create({
      model: process.env.AI_TEXT_MODEL || "gpt-5.2",
      input: `Generate a weekly Korean exam for level ${level} as strict JSON with listening, vocabulary, reading, rubric. Use Chinese for questions/choices. Errors: ${JSON.stringify(errors)}`
    });
    return parseJson(response.output_text, fallback);
  } catch {
    return fallback;
  }
}

export async function transcribeAudio(filePath) {
  if (!client) return "";
  try {
    const transcription = await client.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: process.env.AI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
      language: "ko"
    });
    return transcription.text || "";
  } catch {
    return "";
  }
}

export async function analyzeSpeech({ standard, transcript }) {
  const local = compareSpeech(standard, transcript);
  if (!client || !transcript) return local;

  try {
    const response = await client.responses.create({
      model: process.env.AI_TEXT_MODEL || "gpt-5.2",
      input: `Analyze Korean reading accuracy as JSON {score, missingWords, wrongWords, feedback, similarityScore, keywordMatchScore, lengthScore, verdict}. Standard: ${standard}. Transcript: ${transcript}. Use Chinese feedback and keep score based on similarity + keyword + length.`
    });
    const ai = parseJson(response.output_text, local);
    return {
      ...local,
      ...ai,
      score: Number(ai.score ?? local.score ?? local.finalScore),
      finalScore: Number(ai.finalScore ?? local.score ?? local.finalScore),
      similarityScore: Number(ai.similarityScore ?? local.similarityScore),
      keywordMatchScore: Number(ai.keywordMatchScore ?? local.keywordMatchScore),
      lengthScore: Number(ai.lengthScore ?? local.lengthScore),
      verdict: ai.verdict || local.verdict,
      feedback: ai.feedback || local.feedback
    };
  } catch {
    return local;
  }
}

export async function createSpeech(text) {
  if (!client) return null;
  try {
    const audio = await client.audio.speech.create({
      model: process.env.AI_TTS_MODEL || "gpt-4o-mini-tts",
      voice: "alloy",
      input: text
    });
    return Buffer.from(await audio.arrayBuffer());
  } catch {
    return null;
  }
}
