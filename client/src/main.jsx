import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { AuthProvider } from "./components/AuthContext.jsx";
import "./styles.css";

const Login = lazy(() => import("./pages/Login.jsx"));
const StudentDashboard = lazy(() => import("./pages/StudentDashboard.jsx"));
const DataPage = lazy(() => import("./pages/DataPage.jsx"));
const ExamPage = lazy(() => import("./pages/ExamPage.jsx"));
const TeacherDashboard = lazy(() => import("./pages/TeacherDashboard.jsx"));

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<div className="p-6">加载中...</div>}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route path="/student" element={<StudentDashboard />} />
                <Route path="/student/data" element={<DataPage />} />
                <Route path="/student/exam" element={<ExamPage />} />
                <Route path="/teacher" element={<TeacherDashboard />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
