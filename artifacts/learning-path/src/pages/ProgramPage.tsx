import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { getMainData, getScores } from "@/lib/api";
import type { ProgramStructure, ScoreEntry } from "@/lib/api";
import { Folder, ChevronDown, ChevronUp, Users } from "lucide-react";
import TopBar from "@/components/TopBar";

interface ParticipantProgress {
  username: string;
  percent: number;
}

export default function ProgramPage() {
  const { user } = useAuth();
  const { program } = useParams<{ program: string }>();
  const [, setLocation] = useLocation();
  const programName = decodeURIComponent(program || "");

  const [progresses, setProgresses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [participantData, setParticipantData] = useState<ParticipantProgress[]>([]);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [allStructure, setAllStructure] = useState<ProgramStructure[]>([]);
  const [allScores, setAllScores] = useState<ScoreEntry[]>([]);

  useEffect(() => {
    if (!user) { setLocation("/"); return; }

    Promise.all([getMainData(), getScores()]).then(([data, scores]) => {
      const structure: ProgramStructure[] = data.program_structure || [];
      const filtered = structure.filter((s) => s.program === programName);
      const uniqueProgresses = [...new Set(filtered.map((s) => s.progress))];
      setProgresses(uniqueProgresses);
      setAllStructure(filtered);
      setAllScores(scores);

      if (user.role === "developer") {
        const allUsers = (data.users || []).filter(
          (u) =>
            u.role === "participant" &&
            u.program.split(",").map((p) => p.trim()).includes(programName)
        );
        const totalTests = [...new Set(filtered.map((s) => s.test_name))].length;

        const participants: ParticipantProgress[] = allUsers.map((u) => {
          const userScores = scores.filter((s) => s.username === u.username);
          const completedTests = new Set(userScores.map((s) => s.test_name));
          const count = [...completedTests].filter((t) =>
            filtered.some((f) => f.test_name === t)
          ).length;
          const percent = totalTests > 0 ? Math.round((count / totalTests) * 100) : 0;
          return { username: u.username, percent };
        });

        setParticipantData(participants);
      }

      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user, programName, setLocation]);

  if (!user) return null;

  function getProgressPercentForUser(username: string, progress: string) {
    const tests = allStructure.filter((s) => s.progress === progress);
    const totalTests = tests.length;
    if (totalTests === 0) return 0;
    const completedCount = tests.filter((t) =>
      allScores.some((sc) => sc.username === username && sc.test_name === t.test_name)
    ).length;
    return Math.round((completedCount / totalTests) * 100);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar title={programName} showBack />
      <div className="max-w-5xl mx-auto px-4 py-8">
        {user.role === "developer" && (
          <div className="mb-8">
            <h3 className="text-base font-semibold text-gray-600 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" /> Progres Peserta
            </h3>
            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {participantData.map((p) => (
                  <div key={p.username} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <button
                      data-testid={`btn-participant-${p.username}`}
                      className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition"
                      onClick={() =>
                        setExpandedUser(expandedUser === p.username ? null : p.username)
                      }
                    >
                      <div className="w-9 h-9 rounded-full bg-sky-100 text-sky-700 font-bold text-sm flex items-center justify-center flex-shrink-0">
                        {p.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-gray-900">{p.username}</div>
                        <div className="mt-1 flex items-center gap-3">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-sky-400 rounded-full transition-all"
                              style={{ width: `${p.percent}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-500 w-10 text-right">
                            {p.percent}%
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-sky-500 font-medium">
                        Lihat Detail
                        {expandedUser === p.username ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </button>

                    {expandedUser === p.username && (
                      <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {progresses.map((prog) => {
                            const pct = getProgressPercentForUser(p.username, prog);
                            return (
                              <div key={prog} className="bg-white rounded-xl border border-gray-100 p-4">
                                <div className="font-medium text-gray-800 text-sm mb-2">
                                  {prog}
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-teal-400 rounded-full transition-all"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-gray-500 w-8 text-right">
                                    {pct}%
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 mb-4">
          <Folder className="w-5 h-5 text-sky-500" />
          <h3 className="text-lg font-semibold text-gray-800">Menu Progress</h3>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-36 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {progresses.map((progress) => (
              <button
                key={progress}
                data-testid={`card-progress-${progress}`}
                onClick={() =>
                  setLocation(
                    `/program/${encodeURIComponent(programName)}/${encodeURIComponent(progress)}`
                  )
                }
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-left hover:shadow-md hover:border-sky-200 transition-all"
              >
                <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center mb-3">
                  <Folder className="w-4 h-4 text-sky-500" />
                </div>
                <div className="font-semibold text-gray-900">{progress}</div>
                <button className="mt-4 w-full py-2 rounded-lg border border-sky-200 text-sky-600 text-sm font-medium hover:bg-sky-50 transition">
                  OPEN
                </button>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
