import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { getMainData } from "@/lib/api";
import { BookOpen, Loader2, LogIn } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await getMainData();
      const users = data.users || [];

      const matchingRows = users.filter(
        (u) =>
          u.username.trim().toLowerCase() === username.trim().toLowerCase() &&
          String(u.access_code).trim() === accessCode.trim()
      );

      if (matchingRows.length === 0) {
        setError("Username atau Access Code salah. Silakan coba lagi.");
        setLoading(false);
        return;
      }

      const uniquePrograms = [
        ...new Set(
          matchingRows.flatMap((u) =>
            String(u.program)
              .split(",")
              .map((p) => p.trim())
              .filter(Boolean)
          )
        ),
      ];
      const primaryRole = matchingRows[0].role;
      const match = {
        username: matchingRows[0].username,
        access_code: matchingRows[0].access_code,
        program: uniquePrograms.join(", "),
        role: primaryRole,
      };

      login(match);
      setLocation("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "APPS_SCRIPT_ERROR") {
        setError(
          "Apps Script belum ter-deploy atau deployment bermasalah. Buka Google Apps Script → Deploy → Manage deployments → Edit → New version → Deploy ulang."
        );
      } else {
        setError("Gagal terhubung ke server. Periksa koneksi internet Anda.");
      }
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center mb-4 shadow-md">
              <LogIn className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Welcome Back</h1>
            <p className="text-gray-500 text-sm mt-1 text-center">
              Enter your credentials to access your learning path.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Username
              </label>
              <input
                data-testid="input-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition text-gray-900 placeholder-gray-400"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Access Code
              </label>
              <input
                data-testid="input-access-code"
                type="text"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="Enter your access code"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition text-gray-900 placeholder-gray-400"
                required
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
                {error}
              </div>
            )}

            <button
              data-testid="button-login"
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-semibold text-sm tracking-wide hover:from-sky-600 hover:to-blue-700 transition disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memverifikasi...
                </>
              ) : (
                <>
                  <BookOpen className="w-4 h-4" />
                  START LEARNING
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
