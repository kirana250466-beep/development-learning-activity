import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { getMainData, getScores, getAICriteria, saveAICriteria, saveQuestions, getQuestions } from "@/lib/api";
import type { ProgramStructure, ScoreEntry, AICriteria } from "@/lib/api";
import { Folder, Eye, Users, PenLine, CheckCircle2, ToggleLeft, ToggleRight, Loader2 } from "lucide-react";
import TopBar from "@/components/TopBar";

interface TestNameEntry {
  test_name: string;
  order: number;
}

export default function ProgressPage() {
  const { user } = useAuth();
  const { program, progress } = useParams<{ program: string; progress: string }>();
  const [, setLocation] = useLocation();

  const programName = decodeURIComponent(program || "");
  const progressName = decodeURIComponent(progress || "");

  const [testNames, setTestNames] = useState<TestNameEntry[]>([]);
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiCriteriaMap, setAiCriteriaMap] = useState<Record<string, AICriteria>>({});
  const [savingCriteria, setSavingCriteria] = useState<Record<string, boolean>>({});
  const [criteriaText, setCriteriaText] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) { setLocation("/"); return; }

    getMainData().then(async (data) => {
      const structure: ProgramStructure[] = data.program_structure || [];
      const filtered = structure.filter(
        (s) => s.program === programName && s.progress === progressName
      );
      const tests = filtered.map((f) => ({ test_name: f.test_name, order: f.order }));
      setTestNames(tests);

      const allScores = await getScores();
      setScores(allScores);

      if (user.role === "developer") {
        const criteriaData: Record<string, AICriteria> = {};
        const textData: Record<string, string> = {};
        for (const test of tests) {
          const c = await getAICriteria(test.test_name);
          criteriaData[test.test_name] = c;
          textData[test.test_name] = c.criteria;
        }
        setAiCriteriaMap(criteriaData);
        setCriteriaText(textData);
      }

      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user, programName, progressName, setLocation]);

  if (!user) return null;

  function getScoreForUser(testName: string) {
    const entry = scores.find(
      (s) => s.username === user!.username && s.test_name === testName
    );
    return entry || null;
  }

  async function toggleAI(testName: string, current: boolean) {
    const newState = !current;
    setAiCriteriaMap((prev) => ({
      ...prev,
      [testName]: { ...prev[testName], ai_enabled: newState },
    }));
    await saveAICriteria({
      test_name: testName,
      ai_enabled: newState,
      criteria: criteriaText[testName] || "",
    });
  }

  async function handleSaveCriteria(testName: string) {
    setSavingCriteria((prev) => ({ ...prev, [testName]: true }));
    await saveAICriteria({
      test_name: testName,
      ai_enabled: aiCriteriaMap[testName]?.ai_enabled ?? false,
      criteria: criteriaText[testName] || "",
    });
    setAiCriteriaMap((prev) => ({
      ...prev,
      [testName]: { ...prev[testName], criteria: criteriaText[testName] || "" },
    }));
    setSavingCriteria((prev) => ({ ...prev, [testName]: false }));
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar title={programName} showBack />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6 rounded-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-teal-400 to-blue-500 px-6 py-5">
            <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">
              {progressName}
            </div>
            <div className="text-2xl font-extrabold text-white tracking-wide uppercase">
              {progressName}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : user.role === "participant" ? (
          <div className="space-y-3">
            {testNames.map((test, idx) => {
              const score = getScoreForUser(test.test_name);
              return (
                <div
                  key={test.test_name}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4"
                >
                  <div className="flex-shrink-0">
                    {score ? (
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500">
                        {idx + 1}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{test.test_name}</div>
                    <div className="text-sm text-gray-400">
                      {score ? `Best Score: ${score.score}` : "Not attempted"}
                    </div>
                  </div>
                  <button
                    data-testid={`btn-open-${test.test_name}`}
                    onClick={() =>
                      setLocation(`/quiz/${encodeURIComponent(test.test_name)}`)
                    }
                    className="px-5 py-2 rounded-lg bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 transition"
                  >
                    OPEN
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {testNames.map((test) => {
              const criteria = aiCriteriaMap[test.test_name];
              const testScores = scores.filter((s) => s.test_name === test.test_name);
              const participantCount = new Set(testScores.map((s) => s.username)).size;
              const questionCountKey = `qcount_${test.test_name}`;

              return (
                <div
                  key={test.test_name}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
                >
                  <div className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Eye className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="font-semibold text-gray-900">{test.test_name}</div>
                          <div className="text-sm text-gray-400 mt-0.5 flex items-center gap-2">
                            <span><Users className="w-3 h-3 inline mr-0.5" />{participantCount} peserta mengerjakan</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm text-gray-500">AI Grading</span>
                        <button
                          data-testid={`toggle-ai-${test.test_name}`}
                          onClick={() => toggleAI(test.test_name, criteria?.ai_enabled ?? false)}
                          className="flex items-center"
                        >
                          {criteria?.ai_enabled ? (
                            <span className="flex items-center gap-1 text-green-600">
                              <ToggleRight className="w-8 h-8" />
                              <span className="text-xs font-bold">ON</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-gray-400">
                              <ToggleLeft className="w-8 h-8" />
                              <span className="text-xs font-bold">OFF</span>
                            </span>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-4 flex-wrap">
                      <button
                        data-testid={`btn-buat-soal-${test.test_name}`}
                        onClick={() =>
                          setLocation(`/dev/questions/${encodeURIComponent(test.test_name)}`)
                        }
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-500 text-white text-sm font-medium hover:bg-sky-600 transition"
                      >
                        <PenLine className="w-3.5 h-3.5" />
                        Buat Soal
                      </button>
                      <button
                        data-testid={`btn-lihat-peserta-${test.test_name}`}
                        onClick={() =>
                          setLocation(`/score-participant/${encodeURIComponent(test.test_name)}`)
                        }
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
                      >
                        <Users className="w-3.5 h-3.5" />
                        Lihat Peserta
                      </button>
                      <button
                        data-testid={`btn-preview-${test.test_name}`}
                        onClick={() =>
                          setLocation(`/quiz/${encodeURIComponent(test.test_name)}?preview=1`)
                        }
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Preview
                      </button>
                    </div>
                  </div>

                  {criteria?.ai_enabled && (
                    <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-purple-600 mb-2">
                        <span>✨</span> Kriteria Penilaian AI
                      </div>
                      <textarea
                        data-testid={`textarea-criteria-${test.test_name}`}
                        value={criteriaText[test.test_name] || ""}
                        onChange={(e) =>
                          setCriteriaText((prev) => ({
                            ...prev,
                            [test.test_name]: e.target.value,
                          }))
                        }
                        placeholder="Masukkan rubrik atau instruksi penilaian untuk AI..."
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-sky-400"
                        rows={3}
                      />
                      <button
                        data-testid={`btn-save-criteria-${test.test_name}`}
                        onClick={() => handleSaveCriteria(test.test_name)}
                        disabled={savingCriteria[test.test_name]}
                        className="mt-2 text-sm text-sky-600 font-medium hover:text-sky-700 transition flex items-center gap-1"
                      >
                        {savingCriteria[test.test_name] ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Menyimpan...</>
                        ) : "Simpan kriteria"}
                      </button>
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
