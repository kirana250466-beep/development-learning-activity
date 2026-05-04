import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth-context";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import ProgramPage from "@/pages/ProgramPage";
import ProgressPage from "@/pages/ProgressPage";
import QuizPage from "@/pages/QuizPage";
import DevQuestionsPage from "@/pages/DevQuestionsPage";
import ScoreParticipantPage from "@/pages/ScoreParticipantPage";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={LoginPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/program/:program" component={ProgramPage} />
      <Route path="/program/:program/:progress" component={ProgressPage} />
      <Route path="/quiz/:testName" component={QuizPage} />
      <Route path="/dev/questions/:testName" component={DevQuestionsPage} />
      <Route path="/score-participant/:testName" component={ScoreParticipantPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
