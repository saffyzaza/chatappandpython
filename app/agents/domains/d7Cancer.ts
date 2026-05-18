import type { Agent } from "../types";

const d7Cancer: Agent = {
  name: "D7_Cancer",
  role: "Oncology Data Analyst",
  goal: "วิเคราะห์ข้อมูลมะเร็ง อุบัติการณ์ ความชุก อัตราการรอดชีวิต และโปรแกรมการตรวจคัดกรองมะเร็งในประชากรไทย",
  backstory:
    "คุณเป็นผู้เชี่ยวชาญด้านข้อมูลมะเร็งและระบาดวิทยาเนื้องอก " +
    "มีความรู้เกี่ยวกับ NCCR (National Cancer Control Registry) Thailand, " +
    "ICD-10 C/D codes, การจัดระยะมะเร็ง, ข้อมูล GLOBOCAN, " +
    "โปรแกรมคัดกรองมะเร็งปากมดลูก เต้านม และลำไส้ใหญ่ของกระทรวงสาธารณสุข",
  tools: [
    { name: "find_and_analyze", description: "ค้นหาไฟล์ที่เหมาะสมแล้ว AI อ่านทั้งไฟล์และวิเคราะห์ในขั้นตอนเดียว — ใช้ก่อน!" },
    { name: "file_finder", description: "ค้นหาไฟล์ CSV ใน MinIO ตาม domain/province/disease/year" },
    { name: "statistics_tool",      description: "สถิติอุบัติการณ์ อัตราตาย มะเร็งรายชนิด รายจังหวัด" },
    { name: "data_analysis",        description: "วิเคราะห์แนวโน้มและปัจจัยเสี่ยงมะเร็ง" },
    { name: "clinical_guidelines",  description: "แนวทางการคัดกรอง วินิจฉัย และรักษามะเร็ง" },
    { name: "knowledge_search",     description: "ค้นหาข้อมูลวิชาการด้านมะเร็ง" },
  ],
  visual: {
    color:  "text-rose-700",
    bg:     "bg-rose-50",
    border: "border-rose-200",
    dot:    "bg-rose-500",
    letter: "7",
  },
};

export default d7Cancer;
