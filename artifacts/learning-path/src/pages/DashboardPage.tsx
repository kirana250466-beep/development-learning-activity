import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { getMainData } from "@/lib/api";
import type { ProgramStructure } from "@/lib/api";
import { BookOpen, LogOut, ChevronRight } from "lucide-react";
import TopBar from "@/components/TopBar";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [programs, setPrograms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLocation("/"); return; }

    getMainData().then((data) => {
      const matchingUsers = (data.users || []).filter(
        (u) =>
          u.username.trim().toLowerCase() === user.username.trim().toLowerCase()
      );
      const userPrograms = [
        ...new Set(
          matchingUsers.flatMap((u) =>
            String(u.program)
              .split(",")
              .map((p) => p.trim())
              .filter(Boolean)
          )
        ),
      ];

      setPrograms(userPrograms);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user, setLocation]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl p-6 mb-8 shadow-sm border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900">
            Welcome back,{" "}
            <span className="text-sky-500">{user.username}</span>!
          </h2>
          <p className="text-gray-500 mt-1">
            {user.role === "developer"
              ? "Manage your learning programs and track participant progress."
              : "Continue your learning journey."}
          </p>
        </div>

        <h3 className="text-lg font-semibold text-gray-700 mb-4">
          Your Programs
        </h3>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : programs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            Tidak ada program yang tersedia.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {programs.map((program) => (
              <button
                key={program}
                data-testid={`card-program-${program}`}
                onClick={() => setLocation(`/program/${encodeURIComponent(program)}`)}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-left hover:shadow-md hover:border-sky-200 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center mb-4">
                  <BookOpen className="w-5 h-5 text-sky-500" />
                </div>
                <h4 className="font-semibold text-gray-900 text-lg">{program}</h4>
                <p className="text-sm text-gray-400 mt-1">Learning Path</p>
                <span className="mt-4 flex items-center gap-1 text-sky-500 text-sm font-medium group-hover:gap-2 transition-all">
                  Enter Program <ChevronRight className="w-4 h-4" />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
