import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AuthProvider from "./components/AuthProvider";
import ProtectedRoute from "./components/ProtectedRoute";
import AppShell from "./components/AppShell";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Today from "./pages/Today";
import Workout from "./pages/Workout";
import History from "./pages/History";
import Planned from "./pages/Planned";
import Library from "./pages/Library";
import WorkoutDetail from "./pages/WorkoutDetail";
import Exercises from "./pages/Exercises";
import ExerciseDetail from "./pages/ExerciseDetail";
import NewWorkout from "./pages/NewWorkout";
import Onboarding from "./pages/Onboarding";
import Settings from "./pages/Settings";
import Plan from "./pages/Plan";
import Generate from "./pages/Generate";
import LogClass from "./pages/LogClass";
import Recommend from "./pages/Recommend";
import Body from "./pages/Body";
import Vitamins from "./pages/Vitamins";
import ReviewTargets from "./pages/ReviewTargets";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          <Route element={<ProtectedRoute />}>
            {/* Onboarding is protected but sits outside AppShell so it doesn't loop */}
            <Route path="/welcome" element={<Onboarding />} />

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
            <Route path="/workout/:workoutId" element={<Workout />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
