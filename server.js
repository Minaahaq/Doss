import express from "express";
import fs from "fs/promises";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(express.json());
app.use(cors());

// 👇 يخلي HTML يشتغل من السيرفر
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(__dirname));

const FILE = path.join(__dirname, "database.json");

// 📥 قراءة
async function readData() {
  try {
    const file = await fs.readFile(FILE, "utf-8");
    return JSON.parse(file);
  } catch {
    return { years: [] };
  }
}

// 📤 كتابة
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
  const { chapterId } = req.body;
  const data = await readData();

  data.years?.forEach(year => {
    year.subjects?.forEach(subject => {
      subject.teachers?.forEach(teacher => {
        teacher.chapters = (teacher.chapters || []).filter(
          ch => ch.chapter_id != chapterId
        );
      });
    });
  });

  await writeData(data);
  res.json({ success: true });
});

// 🗑️ حذف محاضرة
app.post("/delete-lecture", async (req, res) => {
  const { chapterId, lectureId } = req.body;
  const data = await readData();

  data.years?.forEach(year => {
    year.subjects?.forEach(subject => {
      subject.teachers?.forEach(teacher => {

        teacher.chapters?.forEach(ch => {
          if (ch.chapter_id == chapterId) {
            ch.lectures = (ch.lectures || []).filter(
              lec => lec.lecture_id != lectureId
            );
          }
        });

      });
    });
  });

  await writeData(data);
  res.json({ success: true });
});

// 🚀 تشغيل
app.listen(3000, () => {
  console.log("🚀 http://localhost:3000");
});
