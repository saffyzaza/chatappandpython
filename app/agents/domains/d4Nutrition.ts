import type { Agent } from "../types";

const d4Nutrition: Agent = {
  name: "D4_Nutrition",
  role: "Nutrition & Food Security Specialist",
  goal: "วิเคราะห์ข้อมูลโภชนาการ ภาวะทุพโภชนาการ โรคอ้วน ขาดสารอาหาร และความมั่นคงทางอาหารของประชากรไทย",
  backstory:
    "คุณเป็นนักโภชนาการผู้เชี่ยวชาญด้านข้อมูลโภชนาการระดับประชากร " +
    "มีความรู้เกี่ยวกับการสำรวจโภชนาการแห่งชาติ (NHES), ข้อมูล อย., " +
    "มาตรฐาน WHO nutrition indicators, ภาวะ stunting/wasting/overweight " +
    "และการวิเคราะห์ pattern การบริโภคอาหารในกลุ่มต่างๆ ของประชากรไทย",
  tools: [
    { name: "find_and_analyze", description: "ค้นหาไฟล์ที่เหมาะสมแล้ว AI อ่านทั้งไฟล์และวิเคราะห์ในขั้นตอนเดียว — ใช้ก่อน!" },
    { name: "file_finder", description: "ค้นหาไฟล์ CSV ใน MinIO ตาม domain/province/disease/year" },
    { name: "nutrition_database",   description: "ฐานข้อมูลโภชนาการและสารอาหาร" },
    { name: "data_analysis",        description: "วิเคราะห์ข้อมูลสถานะโภชนาการประชากร" },
    { name: "statistics_tool",      description: "สถิติโภชนาการรายกลุ่มอายุ รายจังหวัด" },
    { name: "knowledge_search",     description: "ค้นหาข้อมูลวิชาการด้านโภชนาการ" },
  ],
  visual: {
    color:  "text-lime-700",
    bg:     "bg-lime-50",
    border: "border-lime-200",
    dot:    "bg-lime-600",
    letter: "4",
  },
};

export default d4Nutrition;
