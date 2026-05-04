import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { BookOpen, LogOut, ChevronLeft } from "lucide-react";

interface TopBarProps {
  title?: string;
  showBack?: boolean;
}

export default function TopBar({ title, showBack }: TopBarProps) {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <div className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-xs">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showBack ? (
            <button
              data-testid="button-back"
              onClick={() => window.history.back()}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-7 h-7 rounded-lg bg-sky-500 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
          )}
          <span className="font-semibold text-gray-800">
            {title || "Dashboard"}
          </span>
        </div>

        {user && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden sm:block">
              Logged in as{" "}
              <span className="font-medium text-gray-800">{user.username}</span>
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                user.role === "developer"
                  ? "bg-sky-100 text-sky-700"
                  : "bg-teal-100 text-teal-700"
              }`}
            >
              {user.role}
            </span>
            <button
              data-testid="button-logout"
              onClick={() => { logout(); setLocation("/"); }}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 transition"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:block">Log out</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
