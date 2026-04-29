import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "database.json");

export default function handler(req, res) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to load data" });
  }
}
