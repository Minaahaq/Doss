import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "database.json");

export default function handler(req, res) {
  const { chapterId } = req.body;

  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  data.years.forEach(year => {
    year.subjects?.forEach(subject => {
      subject.teachers?.forEach(teacher => {
        teacher.chapters = (teacher.chapters || []).filter(
          ch => ch.chapter_id !== chapterId
        );
      });
    });
  });

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

  res.status(200).json({ success: true });
}
