const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzLVld2O8FYm9kib8L4OPcXeUZR2iWQLq1TpBhpDAeSKPrb1pjmHtSso9G4WZevrDhIgQ/exec";

const AI_TUNNEL_URL =
  import.meta.env.VITE_AI_TUNNEL_URL ||
  "https://api.sistemai.my.id";

export interface User {
  username: string;
  access_code: string;
  program: string;
  role: "participant" | "developer";
}

export interface ProgramStructure {
  program: string;
  progress: string;
  test_group: string;
  order: number;
  test_name: string;
  form_link: string;
}

export interface Question {
  test_name: string;
  question_index: number;
  type: "essay" | "multiple_choice";
  question_text: string;
  options: string[];
  correct_answer: string;
  passing_score: number;
  ai_enabled: boolean;
  media_url: string;
}

export interface ScoreEntry {
  username: string;
  test_name: string;
  score: number;
  answers: Record<number, string>;
  feedback: Record<number, string>;
  submitted_at: string;
}

export interface AICriteria {
  ai_enabled: boolean;
  criteria: string;
}

async function fetchFromSheet(params: Record<string, string>) {
  const url = new URL(APPS_SCRIPT_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  let res: Response;
  try {
    res = await fetch(url.toString());
  } catch {
    throw new Error("NETWORK_ERROR");
  }

  const text = await res.text();

  if (text.includes("Script function not found") || text.includes("<!DOCTYPE") || text.includes("<html")) {
    throw new Error("APPS_SCRIPT_ERROR");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("APPS_SCRIPT_ERROR");
  }
}

async function postToSheet(body: object) {
  let res: Response;
  try {
    res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("NETWORK_ERROR");
  }

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("APPS_SCRIPT_ERROR");
  }
}

export async function getMainData(): Promise<{
  users: User[];
  program_structure: ProgramStructure[];
}> {
  return fetchFromSheet({ action: "getData" });
}

export async function getScores(testName?: string): Promise<ScoreEntry[]> {
  if (testName) {
    return fetchFromSheet({ action: "getScores", testName });
  }
  return fetchFromSheet({ action: "getAllScores" });
}

export async function getQuestions(testName: string): Promise<Question[]> {
  return fetchFromSheet({ action: "getQuestions", testName });
}

export async function getAICriteria(testName: string): Promise<AICriteria> {
  return fetchFromSheet({ action: "getAICriteria", testName });
}

export async function saveScore(data: {
  username: string;
  test_name: string;
  score: number;
  answers: Record<number, string>;
  feedback: Record<number, string>;
  submitted_at: string;
}) {
  return postToSheet({ action: "saveScore", ...data });
}

export async function saveQuestions(data: {
  test_name: string;
  questions: Partial<Question>[];
}) {
  return postToSheet({ action: "saveQuestion", ...data });
}

export async function saveAICriteria(data: {
  test_name: string;
  ai_enabled: boolean;
  criteria: string;
}) {
  return postToSheet({ action: "saveAICriteria", ...data });
}

export interface AIGradeResult {
  score: number;
  feedback: string;
  strengths: string;
  weaknesses: string;
  suggestions: string;
}

export async function gradeWithAI(params: {
  question: string;
  answer: string;
  criteria: string;
  answerKey?: string;
  point?: number;
}): Promise<AIGradeResult> {
  // Route through backend proxy → Cloudflare backend → Ollama
  // Backend retries up to 8×15s (~2 min) before giving up
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12 * 60 * 1000);

  let res: Response;
  try {
    res = await fetch(`${AI_TUNNEL_URL}/ai-grade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: params.question,
        answer: params.answer,
        key: params.answerKey || "",
        instruction: params.criteria || "Nilai berdasarkan kebenaran dan kelengkapan jawaban",
        point: params.point || 100,
        model: "qwen2.5:7b",
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error || `Server error: ${res.status}`);
  }

  const parsed = await res.json() as {
    score?: number;
    feedback?: string;
    strengths?: string;
    weaknesses?: string;
    suggestions?: string;
  };

  return {
    score: Math.min(100, Math.max(0, Number(parsed.score) || 0)),
    feedback: parsed.feedback || "",
    strengths: parsed.strengths || "",
    weaknesses: parsed.weaknesses || "",
    suggestions: parsed.suggestions || "",
  };
}
