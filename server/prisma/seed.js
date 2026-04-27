import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function upsertUser({ email, password, role, student }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role },
    create: { email, passwordHash, role }
  });

  if (student) {
    await prisma.student.upsert({
      where: { userId: user.id },
      update: student,
      create: { ...student, userId: user.id }
    });
  }
}

async function main() {
  await upsertUser({
    email: "teacher@demo.com",
    password: "pass123456",
    role: "TEACHER"
  });

  await upsertUser({
    email: "student@demo.com",
    password: "pass123456",
    role: "STUDENT",
    student: { name: "Demo Student", level: "A1", streakDays: 3 }
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
