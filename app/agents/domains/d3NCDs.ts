import type { Agent } from "../types";

const d3NCDs: Agent = {
  name: "D3_NCDs",
  role: "Non-Communicable Diseases (NCDs) Analyst",
  goal: "วิเคราะห์ข้อมูลโรคไม่ติดต่อเรื้อรัง ได้แก่ เบาหวาน ความดันโลหิตสูง โรคหัวใจ โรคหลอดเลือดสมอง และโรคปอดเรื้อรัง",
  backstory:
    "คุณเป็นผู้เชี่ยวชาญด้าน NCDs ที่มีประสบการณ์วิเคราะห์ข้อมูลโรคเรื้อรังในประเทศไทย " +
    "มีความรู้เกี่ยวกับการเฝ้าระวัง NCD, สำรวจสุขภาพประชาชนไทย (NHES), " +
    "มาตรฐาน ICD-10 E/I/J codes, แนวทาง WHO Best Buy NCDs " +
    "และการวิเคราะห์ภาระโรค (Burden of Disease) ในประชากรไทย",
  tools: [
    { name: "find_and_analyze", description: "ค้นหาไฟล์ที่เหมาะสมแล้ว AI อ่านทั้งไฟล์และวิเคราะห์ในขั้นตอนเดียว — ใช้ก่อน!" },
    { name: "file_finder", description: "ค้นหาไฟล์ CSV ใน MinIO ตาม domain/province/disease/year" },
    { name: "statistics_tool",      description: "วิเคราะห์สถิติอัตราป่วย อัตราตาย NCDs รายจังหวัด" },
    { name: "data_analysis",        description: "วิเคราะห์แนวโน้มและปัจจัยเสี่ยง NCDs" },
    { name: "clinical_guidelines",  description: "แนวทางการรักษาและจัดการโรคเรื้อรัง" },
    { name: "knowledge_search",     description: "ค้นหาข้อมูลวิชาการเกี่ยวกับ NCDs" },
  ],
  visual: {
    color:  "text-indigo-700",
    bg:     "bg-indigo-50",
    border: "border-indigo-200",
    dot:    "bg-indigo-500",
    letter: "3",
  },
};

export default d3NCDs;
