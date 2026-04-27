import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireRole("TEACHER"));

router.get("/students", async (_req, res) => {
  const students = await prisma.student.findMany({
    include: {
      studyRecords: { orderBy: { date: "desc" }, take: 10 },
      errorRecords: { orderBy: { count: "desc" }, take: 5 },
      _count: { select: { audioRecords: true, studyRecords: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  res.json(students);
});

router.get("/students/:id", async (req, res) => {
  const student = await prisma.student.findUnique({
    where: { id: req.params.id },
    include: {
      vocabularyStatuses: true,
      studyRecords: { orderBy: { date: "desc" }, take: 100 },
      errorRecords: { orderBy: { count: "desc" }, take: 50 },
      audioRecords: { orderBy: { createdAt: "desc" }, take: 50 },
      examResults: { orderBy: { createdAt: "desc" }, take: 20 }
    }
  });
  if (!student) return res.status(404).json({ message: "Student not found" });
  res.json(student);
});

router.get("/audio", async (_req, res) => {
  const audio = await prisma.audioRecord.findMany({
    include: { student: true },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  res.json(audio);
});

router.get("/analytics", async (_req, res) => {
  const [students, records, errors, audio] = await Promise.all([
    prisma.student.count(),
    prisma.studyRecord.findMany({ orderBy: { date: "asc" }, take: 500 }),
    prisma.errorRecord.findMany({ orderBy: { count: "desc" }, take: 20, include: { student: true } }),
    prisma.audioRecord.aggregate({ _avg: { score: true }, _count: true })
  ]);

  const avgScore = records.length ? records.reduce((sum, item) => sum + item.score, 0) / records.length : 0;
  res.json({
    students,
    avgScore: Math.round(avgScore),
    audioAvgScore: Math.round(audio._avg.score || 0),
    audioCount: audio._count,
    topErrors: errors
  });
});

export default router;
