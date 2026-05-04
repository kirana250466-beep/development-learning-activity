import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { getQuestions, saveQuestions } from "@/lib/api";
import { Plus, Trash2, Loader2, Save, ChevronUp, ChevronDown } from "lucide-react";

interface EditableQuestion {
  type: "essay" | "multiple_choice";
  question_text: string;
  options: string[];
  correct_answer: string;
  poin: number;
  ai_enabled: boolean;
  media_url: string;
}

const blankQuestion = (): EditableQuestion => ({
  type: "essay",
  question_text: "",
  options: [],
  correct_answer: "",
  poin: 100,
  ai_enabled: false,
  media_url: "",
});

export default function DevQuestionsPage() {
  const { user } = useAuth();
  const { testName } = useParams<{ testName: string }>();
  const [, setLocation] = useLocation();

  const decodedTestName = decodeURIComponent(testName || "");

  const [passingGrade, setPassingGrade] = useState<number>(75);
  const [questions, setQuestions] = useState<EditableQuestion[]>([blankQuestion()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "developer") { setLocation("/"); return; }

    getQuestions(decodedTestName).then((qs) => {
      if (qs.length > 0) {
        setPassingGrade(qs[0].passing_score ?? 75);
        setQuestions(
          qs.map((q) => ({
            type: q.type,
            question_text: q.question_text,
            options: q.options,
            correct_answer: q.correct_answer,
            poin: 100,
            ai_enabled: q.ai_enabled,
            media_url: q.media_url,
          }))
        );
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user, decodedTestName, setLocation]);

  if (!user) return null;

  function updateQuestion(idx: number, field: keyof EditableQuestion, value: unknown) {
    setQuestions((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  }

  function moveQuestion(idx: number, dir: -1 | 1) {
    setQuestions((prev) => {
      const next = [...prev];
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, blankQuestion()]);
  }

  function removeQuestion(idx: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    setSaving(true);
    await saveQuestions({
      test_name: decodedTestName,
      questions: questions.map((q, i) => ({
        question_index: i,
        type: q.type,
        question_text: q.question_text,
        options: q.options,
        correct_answer: q.correct_answer,
        passing_score: passingGrade,
        ai_enabled: q.ai_enabled,
        media_url: q.media_url,
      })),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-xs">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              data-testid="button-batal"
              onClick={() => window.history.back()}
              className="text-sm text-gray-500 hover:text-gray-700 transition font-medium"
            >
              Batal
            </button>
            <span className="text-gray-300">|</span>
            <span className="font-semibold text-gray-800 text-sm">
              Pembuat Soal &middot; {decodedTestName}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              data-testid="btn-save-questions"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 transition disabled:opacity-60 shadow-sm"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
              ) : saved ? (
                <><Save className="w-4 h-4" /> Tersimpan!</>
              ) : (
                <><Save className="w-4 h-4" /> Simpan</>
              )}
            </button>
            <button
              onClick={() => setLocation("/")}
              className="text-sm text-gray-400 hover:text-gray-600 transition"
              title="Log out"
            >
              Log out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {loading ? (
          <div className="space-y-4">
            <div className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
            {[1, 2].map((i) => (
              <div key={i} className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="bg-teal-50 border border-teal-200 rounded-2xl px-6 py-5 mb-6 flex items-center justify-between gap-6">
              <div className="flex-1">
                <div className="text-xs font-bold text-teal-600 uppercase tracking-wider mb-1">
                  Passing Grade Assignment
                </div>
                <p className="text-sm text-teal-700 leading-relaxed">
                  Skor minimum (0–100) yang harus dicapai peserta pada assignment ini agar
                  dianggap lulus dan membuka assignment berikutnya.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <input
                  data-testid="input-passing-grade"
                  type="number"
                  min={0}
                  max={100}
                  value={passingGrade}
                  onChange={(e) =>
                    setPassingGrade(Math.min(100, Math.max(0, Number(e.target.value))))
                  }
                  className="w-20 px-3 py-2 rounded-xl border border-teal-300 bg-white text-center text-gray-800 font-semibold text-lg focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
                <span className="text-teal-600 font-medium text-sm">/ 100</span>
              </div>
            </div>

            <div className="space-y-6">
              {questions.map((q, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                >
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                    <span className="font-semibold text-gray-800">Soal #{idx + 1}</span>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col">
                        <button
                          onClick={() => moveQuestion(idx, -1)}
                          disabled={idx === 0}
                          className="text-gray-300 hover:text-gray-500 disabled:opacity-30 transition"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => moveQuestion(idx, 1)}
                          disabled={idx === questions.length - 1}
                          className="text-gray-300 hover:text-gray-500 disabled:opacity-30 transition"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                      <button
                        data-testid={`btn-delete-q-${idx}`}
                        onClick={() => removeQuestion(idx)}
                        className="text-red-400 hover:text-red-600 transition p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="px-5 py-5 space-y-5">
                    <textarea
                      data-testid={`textarea-question-${idx}`}
                      value={q.question_text}
                      onChange={(e) => updateQuestion(idx, "question_text", e.target.value)}
                      placeholder="Tulis pertanyaan di sini..."
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 resize-y focus:outline-none focus:ring-2 focus:ring-sky-400 transition"
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
                          Tipe Soal
                        </label>
                        <select
                          value={q.type}
                          onChange={(e) =>
                            updateQuestion(idx, "type", e.target.value as "essay" | "multiple_choice")
                          }
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-sky-400 appearance-none"
                        >
                          <option value="essay">Esai</option>
                          <option value="multiple_choice">Pilihan Ganda</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
                          Poin Soal
                        </label>
                        <input
                          type="number"
                          value={q.poin}
                          min={0}
                          max={100}
                          onChange={(e) =>
                            updateQuestion(idx, "poin", Number(e.target.value))
                          }
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-400"
                        />
                      </div>
                    </div>

                    {q.type === "multiple_choice" && (
                      <div>
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
                          Pilihan Jawaban (satu per baris)
                        </label>
                        <textarea
                          value={q.options.join("\n")}
                          onChange={(e) =>
                            updateQuestion(idx, "options", e.target.value.split("\n"))
                          }
                          placeholder={"Pilihan A\nPilihan B\nPilihan C"}
                          rows={4}
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 resize-y focus:outline-none focus:ring-2 focus:ring-sky-400"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-gray-50 border border-gray-100">
                      <div>
                        <div className="text-sm font-medium text-gray-700">AI Grading</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          Gunakan AI untuk menilai otomatis
                        </div>
                      </div>
                      <button
                        data-testid={`toggle-ai-q-${idx}`}
                        onClick={() => updateQuestion(idx, "ai_enabled", !q.ai_enabled)}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          q.ai_enabled ? "bg-sky-500" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                            q.ai_enabled ? "translate-x-6" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
                        Kunci Jawaban / Pembahasan
                      </label>
                      <textarea
                        data-testid={`textarea-answer-key-${idx}`}
                        value={q.correct_answer}
                        onChange={(e) => updateQuestion(idx, "correct_answer", e.target.value)}
                        placeholder={
                          q.type === "multiple_choice"
                            ? "Tuliskan jawaban benar dan pembahasannya..."
                            : "Tuliskan kunci jawaban atau pembahasan lengkap untuk soal ini..."
                        }
                        rows={4}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder-gray-400 resize-y focus:outline-none focus:ring-2 focus:ring-sky-400 transition"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
                        URL Media (opsional)
                      </label>
                      <input
                        type="text"
                        value={q.media_url}
                        onChange={(e) => updateQuestion(idx, "media_url", e.target.value)}
                        placeholder="https://..."
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              data-testid="btn-add-question"
              onClick={addQuestion}
              className="mt-5 w-full py-3.5 rounded-2xl border-2 border-dashed border-sky-200 text-sky-500 font-medium text-sm hover:bg-sky-50 transition flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Tambah Soal
            </button>
          </>
        )}
      </div>
    </div>
  );
}
