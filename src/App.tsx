import { Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AuthProvider from "./components/AuthProvider";
import ProtectedRoute from "./components/ProtectedRoute";
import AppShell from "./components/AppShell";
import { PageSkeleton } from "./components/ui";
import Today from "./pages/Today";
import {
  Body,
  ExerciseDetail,
  Exercises,
  Generate,
  History,
  Library,
  LogClass,
  Login,
  NewWorkout,
  Onboarding,
  Plan,
  Planned,
  Recommend,
  ReviewTargets,
  Settings,
  Signup,
  Vitamins,
  Workout,
  WorkoutDetail,
  warmMainScreens,
} from "./screens";

/** Full-screen routes outside the tab shell get the same loading state as the shell. */
const Screen = ({ children }: { children: React.ReactNode }) => (
  <Suspense
    fallback={
      <div className="mx-auto max-w-xl px-4 pt-16">
        <PageSkeleton />
      </div>
    }
  >
    {children}
  </Suspense>
);

export default function App() {
  useEffect(() => warmMainScreens(), []);
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Screen><Login /></Screen>} />
          <Route path="/signup" element={<Screen><Signup /></Screen>} />

          <Route element={<ProtectedRoute />}>
            {/* Onboarding is protected but sits outside AppShell so it doesn't loop */}
            <Route path="/welcome" element={<Screen><Onboarding /></Screen>} />

            <Route element={<AppShell />}>
              <Route index element={<Today />} />
              <Route path="/plan" element={<Plan />} />
              <Route path="/generate" element={<Generate />} />
              <Route path="/recommend" element={<Recommend />} />
              <Route path="/body" element={<Body />} />
              <Route path="/vitamins" element={<Vitamins />} />
              <Route path="/workout/:workoutId/review" element={<ReviewTargets />} />
              <Route path="/body/:part" element={<Body />} />
              <Route path="/log-class" element={<LogClass />} />
              <Route path="/library" element={<Library />} />
              <Route path="/planned" element={<Planned />} />
              {/* Planned detail reuses WorkoutDetail but keeps the URL under /planned
                  so the back link and breadcrumb feel right to the user. */}
              <Route path="/planned/:workoutId" element={<WorkoutDetail />} />
              <Route path="/history" element={<History />} />
              <Route path="/history/:workoutId" element={<WorkoutDetail />} />
              <Route path="/exercises" element={<Exercises />} />
              <Route path="/exercises/:exerciseId" element={<ExerciseDetail />} />
              <Route path="/new" element={<NewWorkout />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            {/* Full-screen workout execution (no bottom nav) */}
            <Route path="/workout/:workoutId" element={<Screen><Workout /></Screen>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
