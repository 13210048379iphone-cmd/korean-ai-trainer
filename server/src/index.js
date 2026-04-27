import "dotenv/config";
import fs from "node:fs";
import cors from "cors";
import express from "express";
import authRoutes from "./routes/auth.js";
import studentRoutes from "./routes/student.js";
import teacherRoutes from "./routes/teacher.js";

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "dev-only-secret";
}

fs.mkdirSync("uploads", { recursive: true });

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static("uploads"));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/teacher", teacherRoutes);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: "Server error", detail: process.env.NODE_ENV === "production" ? undefined : error.message });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`Korean AI trainer API running on http://localhost:${port}`);
});
