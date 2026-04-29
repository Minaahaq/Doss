import express from "express";
import fs from "fs/promises";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

const FILE = "database.json";

// 📥 جلب البيانات
app.get("/data", async (req, res) => {
  const data = JSON.parse(await fs.readFile(FILE, "utf-8"));
  res.json(data);
});

// 🗑️ حذف باب
app.post("/delete-chapter", async (req, res) => {
  const { chapterId } = req.body;

  const data = JSON.parse(await fs.readFile(FILE, "utf-8"));

  data.years.forEach(year => {
    year.subjects.forEach(subject => {
      subject.teachers.forEach(teacher => {
        if (teacher.chapters) {
          teacher.chapters = teacher.chapters.filter(
            ch => ch.chapter_id !== chapterId
          );
        }
      });
    });
  });

  await fs.writeFile(FILE, JSON.stringify(data, null, 2));
  res.json({ success: true });
});

// 🗑️ حذف محاضرة
app.post("/delete-lecture", async (req, res) => {
  const { chapterId, lectureId } = req.body;

  const data = JSON.parse(await fs.readFile(FILE, "utf-8"));

  data.years.forEach(year => {
    year.subjects.forEach(subject => {
      subject.teachers.forEach(teacher => {

        teacher.chapters?.forEach(ch => {
          if (ch.chapter_id === chapterId) {
            ch.lectures = ch.lectures.filter(
              lec => lec.lecture_id !== lectureId
            );
          }
        });

      });
    });
  });

  await fs.writeFile(FILE, JSON.stringify(data, null, 2));
  res.json({ success: true });
});

app.listen(3000, () => {
  console.log("🚀 Server: https://doss-zeta.vercel.app/data");
});
