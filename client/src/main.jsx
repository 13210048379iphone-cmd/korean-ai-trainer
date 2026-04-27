import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";
import "./styles.css";

const StudentDashboard = lazy(() => import("./pages/StudentDashboard.jsx"));
const DataPage = lazy(() => import("./pages/DataPage.jsx"));
const ExamPage = lazy(() => import("./pages/ExamPage.jsx"));

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <Suspense fallback={<div className="p-6">加载中...</div>}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/student" element={<StudentDashboard />} />
            <Route path="/student/data" element={<DataPage />} />
            <Route path="/student/exam" element={<ExamPage />} />
            <Route path="/" element={<Navigate to="/student" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/student" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  </React.StrictMode>
);
