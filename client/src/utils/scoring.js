function normalizeKorean(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^\p{Script=Hangul}\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasHangul(text = "") {
  return /[\uac00-\ud7a3]/.test(text);
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

function pickKeywords(words) {
  const stopwords = new Set([
    "저는",
    "나는",
    "오늘",
    "그리고",
    "에서",
    "으로",
    "에게",
    "합니다",
    "해요",
    "입니다",
    "있어요",
    "없어요"
  ]);
  const unique = [...new Set(words)];
  const filtered = unique.filter((word) => word.length >= 2 && !stopwords.has(word));
  return (filtered.length ? filtered : unique).slice(0, 6);
}

function chunkByThree(words) {
  const size = Math.ceil(words.length / 3) || 1;
  return [words.slice(0, size), words.slice(size, size * 2), words.slice(size * 2)];
}

function segmentCoverageScore(expectedWords, actualWords) {
  if (!expectedWords.length) return 100;
  const actualSet = new Set(actualWords);
  const segments = chunkByThree(expectedWords);
  const coverage = segments.map((segment) => {
    if (!segment.length) return 1;
    const hit = segment.filter((word) => actualSet.has(word)).length;
    return hit / segment.length;
  });
  return Math.round((coverage.reduce((sum, value) => sum + value, 0) / coverage.length) * 100);
}

export function evaluateSpeech(expectedText, recognizedText) {
  const expected = normalizeKorean(expectedText);
  const actual = normalizeKorean(recognizedText);

  if (!actual || !hasHangul(actual)) {
    return {
      similarityScore: 0,
      keywordMatchScore: 0,
      lengthScore: 0,
      segmentCoverageScore: 0,
      finalScore: 0,
      verdict: "retry",
      recognizedText: recognizedText || "",
      message: "未识别清晰，请重新朗读",
      missingWords: [],
      wrongWords: []
    };
  }

  const expectedWords = expected.split(" ").filter(Boolean);
  const actualWords = actual.split(" ").filter(Boolean);
  const actualSet = new Set(actualWords);
  const missingWords = expectedWords.filter((word) => !actualSet.has(word));
  const wrongWords = actualWords.filter((word) => !expectedWords.includes(word));

  const maxLen = Math.max(expected.length, actual.length, 1);
  const distance = levenshtein(expected, actual);
  const similarityScore = Math.max(0, Math.round((1 - distance / maxLen) * 100));

  const keywords = pickKeywords(expectedWords);
  const hit = keywords.filter((word) => actualSet.has(word)).length;
  const keywordMatchScore = keywords.length ? Math.round((hit / keywords.length) * 100) : 100;

  const lengthRatio = Math.min(actualWords.length, expectedWords.length) / Math.max(expectedWords.length, 1);
  const lengthScore = Math.round(Math.max(0, Math.min(1, lengthRatio)) * 100);
  const segmentScore = segmentCoverageScore(expectedWords, actualWords);
  const finalScore = Math.round(
    similarityScore * 0.4 + keywordMatchScore * 0.2 + lengthScore * 0.25 + segmentScore * 0.15
  );

  let verdict = "retry";
  let message = "匹配度较低，需要重读。";
  if (finalScore >= 80) {
    verdict = "correct";
    message = "朗读正确，继续下一题。";
  } else if (finalScore >= 50) {
    verdict = "partial";
    message = "部分正确，建议再读一遍优化发音。";
  }

  return {
    similarityScore,
    keywordMatchScore,
    lengthScore,
    segmentCoverageScore: segmentScore,
    finalScore,
    verdict,
    recognizedText: recognizedText || "",
    message,
    missingWords: [...new Set(missingWords)].slice(0, 8),
    wrongWords: [...new Set(wrongWords)].slice(0, 8)
  };
}
