import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { getQuestions, getScores, saveScore } from "@/lib/api";
import type { Question } from "@/lib/api";
import { ChevronLeft, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import TopBar from "@/components/TopBar";

export default function QuizPage() {
  const { user } = useAuth();
  const { testName } = useParams<{ testName: string }>();
  const [, setLocation] = useLocation();

  const decodedTestName = decodeURIComponent(testName || "");

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const isPreview = new URLSearchParams(window.location.search).get("preview") === "1";

  useEffect(() => {
    if (!user) { setLocation("/"); return; }
    getQuestions(decodedTestName).then((qs) => {
      setQuestions(qs);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user, decodedTestName, setLocation]);

  if (!user) return null;

  const answeredCount = Object.values(answers).filter((a) => a.trim().length > 0).length;

  async function handleSubmit() {
    if (isPreview) return;
    setSubmitting(true);
    setSubmitError("");

    try {
      let calculatedScore = 0;
      const hasOnlyEssay = questions.every((q) => q.type === "essay");

      for (const q of questions) {
        const userAnswer = answers[q.question_index] || "";
        if (q.type === "multiple_choice") {
          const correct =
            userAnswer.trim().toLowerCase() === q.correct_answer.trim().toLowerCase();
          const pts = 100 / questions.length;
          calculatedScore += correct ? pts : 0;
        }
      }
      calculatedScore = Math.round(calculatedScore);

      let scoreToSave = calculatedScore;

      if (hasOnlyEssay) {
        const existingScores = await getScores(decodedTestName);
        const myExisting = existingScores.find((s) => s.username === user!.username);
        if (myExisting) {
          scoreToSave = myExisting.score;
        }
      }

      await saveScore({
        username: user!.username,
        test_name: decodedTestName,
        score: scoreToSave,
        answers,
        feedback: {},
        submitted_at: new Date().toLocaleString("id-ID"),
      });

      setSubmitted(true);
    } catch (err) {
      setSubmitError("Gagal mengirim jawaban. Periksa koneksi dan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopBar title={decodedTestName} showBack />
        <div className="max-w-2xl mx-auto px-4 py-16">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-9 h-9 text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Jawaban berhasil dikirim!
            </h2>
            <p className="text-gray-400 text-sm mb-8">
              Skor akan muncul setelah diproses.
            </p>
            <button
              data-testid="button-kembali"
              onClick={() => window.history.back()}
              className="flex items-center gap-1.5 mx-auto px-6 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition"
            >
              <ChevronLeft className="w-4 h-4" />
              Kembali
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <TopBar title={decodedTestName} showBack />
      {isPreview && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-700 text-center py-2 text-sm font-medium">
          Mode Preview — jawaban tidak akan disimpan
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-8">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            Belum ada soal untuk tes ini.
          </div>
        ) : (
          <div className="space-y-5">
            {questions.map((q, i) => (
              <div
                key={q.question_index}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-6"
              >
                <div className="flex gap-3 mb-4">
                  <span className="w-7 h-7 rounded-full bg-sky-100 text-sky-600 font-bold text-sm flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="font-medium text-gray-900 pt-0.5">{q.question_text}</div>
                </div>

                {q.media_url && (
                  <img
                    src={q.media_url}
                    alt="media"
                    className="mb-4 rounded-lg max-h-60 object-contain"
                  />
                )}

                {q.type === "multiple_choice" ? (
                  <div className="space-y-2 pl-10">
                    {q.options.map((opt, oi) => (
                      <label
                        key={oi}
                        className="flex items-center gap-3 cursor-pointer group"
                      >
                        <input
                          type="radio"
                          name={`q_${q.question_index}`}
                          value={opt}
                          checked={answers[q.question_index] === opt}
                          onChange={() =>
                            setAnswers((prev) => ({
                              ...prev,
                              [q.question_index]: opt,
                            }))
                          }
                          className="w-4 h-4 accent-sky-500"
                        />
                        <span className="text-gray-700 group-hover:text-gray-900 transition text-sm">
                          {opt}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <textarea
                    data-testid={`textarea-answer-${i}`}
                    value={answers[q.question_index] || ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [q.question_index]: e.target.value,
                      }))
                    }
                    placeholder="Tulis jawaban Anda di sini..."
                    rows={4}
                    className="w-full ml-10 px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 resize-y focus:outline-none focus:ring-2 focus:ring-sky-400 transition"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {!loading && questions.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 flex items-center justify-between max-w-3xl mx-auto gap-3">
          <div className="flex-1">
            <span className="text-sm text-gray-500">
              {answeredCount} dari {questions.length} soal dijawab
            </span>
            {submitError && (
              <div className="flex items-center gap-1.5 text-red-500 text-xs mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {submitError}
              </div>
            )}
          </div>
          {!isPreview && (
            <button
              data-testid="button-submit"
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-semibold text-sm hover:from-sky-600 hover:to-blue-700 transition disabled:opacity-60 flex items-center gap-2 shadow-sm"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Mengirim...</>
              ) : "Submit Jawaban"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
