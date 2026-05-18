import type { Task } from "@/app/agents/types";
import { researchAgent } from "@/app/agents";
import analyzeQuery from "./analyzeQuery";

const researchData: Task = {
  description:
    "ค้นหาและวิเคราะห์ข้อมูลสำหรับคำถาม: {query}\n\n" +
    "① ใช้ file_finder หาไฟล์ก่อน → ② ใช้ csv_reader อ่านข้อมูลจริงจากไฟล์\n\n" +
    "กฎสำคัญ:\n" +
    "- ใช้ตัวเลขจาก Tool result เท่านั้น ห้ามแต่งหรือคาดเดา\n" +
    "- ระบุชื่อไฟล์จริงที่อ่าน (SOURCE FILE) ในผลลัพธ์ด้วยเสมอ\n" +
    "- ถ้าชื่อไฟล์ไม่ตรงกับจังหวัดที่ถาม ให้บอกชัดๆ ว่าพบข้อมูลของจังหวัดไหน\n" +
    "- ถ้าหาไฟล์ไม่พบหรือข้อมูลไม่ตรง ให้รายงานตรงๆ",
  expectedOutput:
    "ผลการวิเคราะห์ที่มีโครงสร้าง:\n" +
    "1. ชื่อไฟล์และ path ที่อ่านจริง\n" +
    "2. ตัวเลขและข้อมูลจากไฟล์ (ห้ามแต่ง)\n" +
    "3. หมายเหตุ: ถ้าข้อมูลในไฟล์ไม่ตรงกับที่ถาม",
  agent: researchAgent,
  context: [analyzeQuery],
};

export default researchData;
