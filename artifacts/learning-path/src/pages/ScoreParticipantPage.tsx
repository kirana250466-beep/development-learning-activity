import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { getScores, getQuestions, getAICriteria, saveScore, gradeWithAI } from "@/lib/api";
import type { ScoreEntry, Question, AICriteria, AIGradeResult } from "@/lib/api";
import { ChevronDown, ChevronUp, Loader2, Download, ExternalLink, CheckCircle, XCircle } from "lucide-react";
import TopBar from "@/components/TopBar";

interface PendingAIResult {
  username: string;
  questionIdx: number;
  result: AIGradeResult;
  feedbackEncoded: string;
  updatedFeedback: Record<number, string>;
  newScore: number;
  scoreEntry: ScoreEntry;
}

interface GradeProgress {
  startedAt: number;
}

const SPREADSHEET_URL =
  "https://docs.google.com/spreadsheets/d/1W-2YOhp3zFks_UD5P56rj0WycZ_6Gn1Fs105Cg3ePIA/edit";

export default function ScoreParticipantPage() {
  const { user } = useAuth();
  const { testName } = useParams<{ testName: string }>();
  const [, setLocation] = useLocation();

  const decodedTestName = decodeURIComponent(testName || "");

  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [aiCriteria, setAiCriteria] = useState<AICriteria>({ ai_enabled: false, criteria: "" });
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeGradings, setActiveGradings] = useState<Set<string>>(new Set());
  const [gradingErrors, setGradingErrors] = useState<Record<string, string>>({});
  const [localFeedback, setLocalFeedback] = useState<Record<string, Record<number, string>>>({});
  const [localScores, setLocalScores] = useState<Record<string, number>>({});
  const [pendingAIResult, setPendingAIResult] = useState<PendingAIResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [gradeProgress, setGradeProgress] = useState<Record<string, GradeProgress>>({});
  const [savedAnswers, setSavedAnswers] = useState<Record<string, Record<number, string>>>({});

  useEffect(() => {
    if (!user || user.role !== "developer") { setLocation("/"); return; }

    Promise.all([
      getScores(decodedTestName),
      getQuestions(decodedTestName),
      getAICriteria(decodedTestName),
    ]).then(([sc, qs, criteria]) => {
      setScores(sc);
      setQuestions(qs);
      setAiCriteria(criteria);

      const fb: Record<string, Record<number, string>> = {};
      const sc2: Record<string, number> = {};
      sc.forEach((s) => {
        fb[s.username] = { ...s.feedback };
        sc2[s.username] = s.score;
      });
      setLocalFeedback(fb);
      setLocalScores(sc2);
      const sa: Record<string, Record<number, string>> = {};
      sc.forEach((s) => {
        sa[s.username] = { ...s.answers };
      });
      setSavedAnswers(sa);

      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user, decodedTestName, setLocation]);

  if (!user) return null;

  const uniqueParticipants = [...new Set(scores.map((s) => s.username))];
  const passingScore = questions[0]?.passing_score ?? 75;

  function getParticipantScore(username: string): ScoreEntry | undefined {
    return scores.find((s) => s.username === username);
  }

  async function handleGradeWithAI(username: string, questionIdx: number) {
    const scoreEntry = getParticipantScore(username);
    if (!scoreEntry) return;

    const question = questions.find((q) => q.question_index === questionIdx);
    if (!question) return;

    const userAnswer = scoreEntry.answers[questionIdx] || "";
    if (!userAnswer.trim()) return;

    const gradingKey = `${username}:${questionIdx}`;
    setActiveGradings((prev) => new Set(prev).add(gradingKey));
    setGradeProgress((prev) => ({
      ...prev,
      [gradingKey]: { startedAt: Date.now() },
    }));
    setGradingErrors((prev) => { const n = { ...prev }; delete n[gradingKey]; return n; });

    try {
      const result = await gradeWithAI({
        question: question.question_text,
        answer: userAnswer,
        criteria: aiCriteria.criteria,
        answerKey: question.correct_answer,
        point: question.passing_score ?? 100,
      });

      const feedbackEncoded = JSON.stringify({
        score: result.score,
        feedback: result.feedback,
        strengths: result.strengths,
        weaknesses: result.weaknesses,
        suggestions: result.suggestions,
      });

      const currentFeedback = localFeedback[username] || {};
      const updatedFeedback = {
        ...currentFeedback,
        [questionIdx]: `Skor AI: ${result.score}\n${feedbackEncoded}`,
      };

      let totalScore = 0;
      let gradedCount = 0;
      for (const q of questions) {
        const fb = updatedFeedback[q.question_index] || "";
        const scoreMatch = fb.match(/Skor AI:\s*(\d+)/);
        if (scoreMatch) {
          totalScore += Number(scoreMatch[1]);
          gradedCount++;
        }
      }
      const newScore = gradedCount > 0 ? Math.round(totalScore / gradedCount) : localScores[username] || 0;

      setPendingAIResult({
        username,
        questionIdx,
        result,
        feedbackEncoded,
        updatedFeedback,
        newScore,
        scoreEntry,
      });

    } catch {
      setGradingErrors((prev) => ({
        ...prev,
        [gradingKey]: "AI backend belum tersambung atau sedang sibuk.",
      }));
    } finally {
      setActiveGradings((prev) => {
        const next = new Set(prev);
        next.delete(gradingKey);
        return next;
      });
      setGradeProgress((prev) => {
        const next = { ...prev };
        delete next[gradingKey];
        return next;
      });
    }
  }

  async function confirmSaveAI() {
    if (!pendingAIResult) return;
    const { username, updatedFeedback, newScore, scoreEntry } = pendingAIResult;
    setSaving(true);
    try {
      await saveScore({
        username,
        test_name: decodedTestName,
        score: newScore,
        answers: scoreEntry.answers,
        feedback: updatedFeedback,
        submitted_at: scoreEntry.submitted_at,
      });
      setLocalFeedback((prev) => ({
        ...prev,
        [username]: updatedFeedback,
      }));
      setLocalScores((prev) => ({ ...prev, [username]: newScore }));
      setSavedAnswers((prev) => ({
        ...prev,
        [username]: {
          ...(prev[username] || {}),
          ...scoreEntry.answers,
        },
      }));
      setPendingAIResult(null);
    } catch {
      setGradingErrors((prev) => ({
        ...prev,
        [`${username}:${pendingAIResult.questionIdx}`]:
          "Gagal menyimpan hasil AI ke spreadsheet. Coba lagi.",
      }));
    } finally {
      setSaving(false);
    }
  }

  function cancelSaveAI() {
    setPendingAIResult(null);
  }

  function exportCSV() {
    const header = ["Username", "Test Name", "Score", "Submitted At"];
    const rows = scores.map((s) => [
      s.username,
      s.test_name,
      s.score,
      s.submitted_at,
    ]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scores_${decodedTestName}.csv`;
    a.click();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar title={`Skor: ${decodedTestName}`} showBack />

      <div className="max-w-4xl mx-auto px-4 pt-4">
        <div className={`rounded-xl border px-4 py-3 text-sm ${aiCriteria.ai_enabled ? "bg-sky-50 border-sky-100 text-sky-700" : "bg-gray-50 border-gray-200 text-gray-600"}`}>
          {aiCriteria.ai_enabled ? "AI backend tersambung untuk tes ini." : "AI backend belum diaktifkan untuk tes ini."}
        </div>
      </div>

      {activeGradings.size > 0 && (
        <div className="sticky top-0 z-50 bg-amber-500 text-white px-4 py-3 flex items-center justify-center gap-3 shadow-md">
          <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" />
          <span className="font-medium text-sm">
            AI sedang menilai <strong>{activeGradings.size}</strong> jawaban — mohon tunggu...
          </span>
        </div>
      )}

      {pendingAIResult && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-800">Hasil Penilaian AI</h3>
                <p className="text-xs text-gray-500 mt-0.5">{pendingAIResult.username}</p>
              </div>
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-1.5">
                <span className="text-xs text-blue-500 font-semibold">Skor</span>
                <span className="text-2xl font-black text-blue-600">{pendingAIResult.result.score}</span>
              </div>
            </div>

            <div className="px-6 py-4 space-y-3">
              {pendingAIResult.result.feedback && (
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                  <div className="text-xs font-bold text-purple-500 uppercase tracking-wide mb-1">📝 Penilaian</div>
                  <p className="text-sm text-gray-700">{pendingAIResult.result.feedback}</p>
                </div>
              )}
              {pendingAIResult.result.strengths && (
                <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                  <div className="text-xs font-bold text-green-600 uppercase tracking-wide mb-1">✅ Kelebihan</div>
                  <p className="text-sm text-gray-700">{pendingAIResult.result.strengths}</p>
                </div>
              )}
              {pendingAIResult.result.weaknesses && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                  <div className="text-xs font-bold text-red-500 uppercase tracking-wide mb-1">⚠️ Kekurangan</div>
                  <p className="text-sm text-gray-700">{pendingAIResult.result.weaknesses}</p>
                </div>
              )}
              {pendingAIResult.result.suggestions && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <div className="text-xs font-bold text-blue-500 uppercase tracking-wide mb-1">💡 Saran</div>
                  <p className="text-sm text-gray-700">{pendingAIResult.result.suggestions}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={cancelSaveAI}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                Buang
              </button>
              <button
                onClick={confirmSaveAI}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {saving ? "Menyimpan..." : "Simpan Nilai"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-gradient-to-r from-teal-400 to-blue-500 rounded-2xl p-5 mb-6 text-white">
          <h2 className="text-xl font-bold">{decodedTestName}</h2>
          <div className="flex items-center gap-4 mt-2 text-white/80 text-sm">
            <span>{uniqueParticipants.length} peserta</span>
            <span>{questions.length} soal</span>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              data-testid="btn-export-csv"
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition"
            >
              <Download className="w-4 h-4" />
              Unduh CSV
            </button>
            <a
              href={SPREADSHEET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition"
            >
              <ExternalLink className="w-4 h-4" />
              Lihat Spreadsheet
            </a>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : uniqueParticipants.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            Belum ada peserta yang mengerjakan tes ini.
          </div>
        ) : (
          <div className="space-y-4">
            {uniqueParticipants.map((username) => {
              const entry = getParticipantScore(username);
              if (!entry) return null;
              const score = localScores[username] ?? entry.score;
              const isPassed = score >= passingScore;
              const isExpanded = expandedUser === username;

              return (
                <div
                  key={username}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
                >
                  <div className="px-5 py-4 flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                        isPassed ? "bg-green-500" : "bg-red-400"
                      }`}
                    >
                      {score}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">{username}</div>
                      <div className="text-sm text-gray-400">
                        Disubmit: {entry.submitted_at}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                          isPassed
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-600"
                        }`}
                      >
                        {isPassed ? "Lulus" : "Belum Lulus"}
                      </span>
                      <button
                        data-testid={`btn-expand-${username}`}
                        onClick={() =>
                          setExpandedUser(isExpanded ? null : username)
                        }
                        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition"
                      >
                        Jawaban
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-100 px-5 py-4 space-y-6">
                      {questions.map((q, qi) => {
                        const userAnswer =
                          savedAnswers[username]?.[q.question_index] ||
                          entry.answers[q.question_index] ||
                          "";
                        const feedbackText =
                          localFeedback[username]?.[q.question_index] || "";
                        const gradingKey = `${username}:${q.question_index}`;
                        const isGrading = activeGradings.has(gradingKey);
                        const gradingError = gradingErrors[gradingKey] || "";
                        const progressInfo = gradeProgress[gradingKey];
                        const progressPercent = progressInfo
                          ? Math.min(
                              95,
                              Math.max(8, Math.round(((Date.now() - progressInfo.startedAt) / (12 * 60 * 1000)) * 100))
                            )
                          : 0;
                        const rawContent = feedbackText.replace(/^Skor AI:\s*\d+\n?/, "");
                        let parsed: { feedback?: string; strengths?: string; weaknesses?: string; suggestions?: string } | null = null;
                        try {
                          parsed = JSON.parse(rawContent);
                        } catch {
                          parsed = null;
                        }
                        const hasAiFeedback =
                          Boolean(parsed?.feedback || parsed?.strengths || parsed?.weaknesses || parsed?.suggestions) ||
                          Boolean(rawContent.trim());

                        return (
                          <div key={q.question_index}>
                            <div className="flex gap-2 mb-2">
                              <span className="text-sm font-semibold text-gray-400">
                                {qi + 1}
                              </span>
                              <span className="text-sm font-medium text-gray-800">
                                {q.question_text}
                              </span>
                            </div>

                            <div className="pl-5">
                              <div className="text-xs font-semibold text-sky-500 mb-1 uppercase tracking-wide">
                                Jawaban Peserta:
                              </div>
                              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
                                {userAnswer || (
                                  <span className="text-gray-400 italic">
                                    Tidak dijawab
                                  </span>
                                )}
                              </p>

                              <div className="flex items-center gap-2 mt-3 flex-wrap">
                                {aiCriteria.ai_enabled && q.type === "essay" && (
                                  <button
                                    data-testid={`btn-grade-ai-${username}-${qi}`}
                                    onClick={() =>
                                      handleGradeWithAI(username, q.question_index)
                                    }
                                    disabled={isGrading}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-semibold hover:bg-green-600 transition disabled:opacity-60"
                                  >
                                    {isGrading ? (
                                      <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        Menilai...
                                      </>
                                    ) : (
                                      "Nilai dengan AI"
                                    )}
                                  </button>
                                )}
                                {feedbackText && (
                                  <span className="text-xs text-gray-500 px-2 py-1 rounded bg-gray-100">
                                    Nilai Sekarang: {feedbackText.match(/Skor AI:\s*(\d+)/)?.[1] ?? "-"}
                                  </span>
                                )}
                                {gradingError && (
                                  <span className="text-xs text-red-500 px-2 py-1 rounded bg-red-50 border border-red-100">
                                    ⚠️ {gradingError}
                                  </span>
                                )}
                              </div>

                              {isGrading && (
                                <div className="mt-3">
                                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                    <span>Progress AI</span>
                                    <span>{progressPercent}%</span>
                                  </div>
                                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-500 transition-all duration-300"
                                      style={{ width: `${progressPercent}%` }}
                                    />
                                  </div>
                                </div>
                              )}

                              {hasAiFeedback && (
                                <div className="mt-3 space-y-2">
                                  {parsed?.feedback ? (
                                    <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                                      <div className="text-xs font-bold text-purple-500 uppercase tracking-wide mb-1">📝 Penilaian</div>
                                      <p className="text-sm text-gray-700">{parsed.feedback}</p>
                                    </div>
                                  ) : rawContent.trim() ? (
                                    <div className="bg-white border border-purple-100 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap">
                                      {rawContent}
                                    </div>
                                  ) : null}

                                  {parsed?.strengths && (
                                    <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                                      <div className="text-xs font-bold text-green-600 uppercase tracking-wide mb-1">✅ Kelebihan</div>
                                      <p className="text-sm text-gray-700">{parsed.strengths}</p>
                                    </div>
                                  )}
                                  {parsed?.weaknesses && (
                                    <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                                      <div className="text-xs font-bold text-red-500 uppercase tracking-wide mb-1">⚠️ Kekurangan</div>
                                      <p className="text-sm text-gray-700">{parsed.weaknesses}</p>
                                    </div>
                                  )}
                                  {parsed?.suggestions && (
                                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                                      <div className="text-xs font-bold text-blue-500 uppercase tracking-wide mb-1">💡 Saran</div>
                                      <p className="text-sm text-gray-700">{parsed.suggestions}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
