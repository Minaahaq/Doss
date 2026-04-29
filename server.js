import express from "express";
import fs from "fs/promises";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(express.json());
app.use(cors());

// 📁 مسار الملف
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FILE = path.join(__dirname, "database.json");

// 📥 قراءة آمنة + إصلاح لو JSON بايظ
async function readData() {
  try {
    const file = await fs.readFile(FILE, "utf-8");

    try {
      return JSON.parse(file);
    } catch {
      console.log("⚠️ JSON فيه مشكلة - بيتم إصلاحه...");
      // محاولة إصلاح بسيطة (إغلاق الأقواس)
      const fixed = file + "\n]}]}]}]}";
      return JSON.parse(fixed);
    }

  } catch (err) {
    console.error("❌ Read Error:", err.message);
    return { years: [] };
  }
}

// 📤 كتابة آمنة (منع التضارب)
let isWriting = false;

async function writeData(data) {
  while (isWriting) {
    await new Promise(r => setTimeout(r, 50));
  }
  isWriting = true;

  await fs.writeFile(FILE, JSON.stringify(data, null, 2));

  isWriting = false;
}

// 📊 جلب البيانات
app.get("/data", async (req, res) => {
  const data = await readData();
  res.json(data);
});

// 🗑️ حذف باب
app.post("/delete-chapter", async (req, res) => {
  try {
    const { chapterId } = req.body;
    const data = await readData();

    data.years?.forEach(year => {
      year.subjects?.forEach(subject => {
        subject.teachers?.forEach(teacher => {
          if (teacher.chapters) {
            teacher.chapters = teacher.chapters.filter(
              ch => ch.chapter_id !== chapterId
            );
          }
        });
      });
    });

    await writeData(data);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🗑️ حذف محاضرة
app.post("/delete-lecture", async (req, res) => {
  try {
    const { chapterId, lectureId } = req.body;
    const data = await readData();

    data.years?.forEach(year => {
      year.subjects?.forEach(subject => {
        subject.teachers?.forEach(teacher => {

          teacher.chapters?.forEach(ch => {
            if (ch.chapter_id === chapterId && ch.lectures) {
              ch.lectures = ch.lectures.filter(
                lec => lec.lecture_id !== lectureId
              );
            }
          });

        });
      });
    });

    await writeData(data);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🚀 تشغيل
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 http://localhost:${PORT}/data`);
});
