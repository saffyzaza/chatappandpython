import type { Agent } from "../types";

const d6CommunicableDisease: Agent = {
  name: "D6_Communicable_Disease",
  role: "Infectious Disease Surveillance Specialist",
  goal: "วิเคราะห์ข้อมูลโรคติดต่อ การระบาด ระบบเฝ้าระวัง และมาตรการควบคุมโรคติดเชื้อในประเทศไทย",
  backstory:
    "คุณเป็นนักระบาดวิทยาผู้เชี่ยวชาญด้านโรคติดเชื้อและระบบเฝ้าระวังโรค " +
    "มีความรู้เกี่ยวกับรายงาน 506 (R506), ระบบ SRRT, กรมควบคุมโรค, " +
    "IHR (International Health Regulations), โรคประจำถิ่น โรคอุบัติใหม่ " +
    "และการวิเคราะห์การระบาดของโรคทั้ง VBD, WBD, respiratory diseases และโรคอาหารเป็นพิษ",
  tools: [
    { name: "find_and_analyze", description: "ค้นหาไฟล์ที่เหมาะสมแล้ว AI อ่านทั้งไฟล์และวิเคราะห์ในขั้นตอนเดียว — ใช้ก่อน!" },
    { name: "file_finder", description: "ค้นหาไฟล์ CSV ใน MinIO ตาม domain/province/disease/year" },
    { name: "disease_surveillance", description: "ระบบเฝ้าระวังโรคติดต่อ รายงาน 506" },
    { name: "statistics_tool",      description: "สถิติอัตราป่วย อัตราตาย รายโรค รายจังหวัด" },
    { name: "data_analysis",        description: "วิเคราะห์แนวโน้มและรูปแบบการระบาด" },
    { name: "clinical_guidelines",  description: "แนวทางการวินิจฉัย รักษา และควบคุมโรค" },
  ],
  visual: {
    color:  "text-orange-700",
    bg:     "bg-orange-50",
    border: "border-orange-200",
    dot:    "bg-orange-500",
    letter: "6",
  },
};

export default d6CommunicableDisease;
