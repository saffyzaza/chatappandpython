import type { Agent } from "../types";

const d2MentalHealth: Agent = {
  name: "D2_Mental_Health",
  role: "Mental Health & Suicide Prevention Specialist",
  goal: "วิเคราะห์ข้อมูลสุขภาพจิต การฆ่าตัวตาย การพยายามฆ่าตัวตาย และปัญหาสุขภาพจิตในประชากรไทย",
  backstory:
    "คุณเป็นผู้เชี่ยวชาญด้านสุขภาพจิตและการป้องกันการฆ่าตัวตาย " +
    "มีความรู้เชิงลึกเกี่ยวกับระบบบริการสุขภาพจิต กรมสุขภาพจิต " +
    "ข้อมูล Suicide Surveillance, ICD-10 F-codes, และมาตรฐาน WHO Mental Health Atlas " +
    "เชี่ยวชาญการวิเคราะห์ข้อมูลรายจังหวัด รายเพศ รายช่วงอายุ และปัจจัยเสี่ยง",
  tools: [
    { name: "find_and_analyze", description: "ค้นหาไฟล์ที่เหมาะสมแล้ว AI อ่านทั้งไฟล์และวิเคราะห์ในขั้นตอนเดียว — ใช้ก่อน!" },
    { name: "file_finder", description: "ค้นหาไฟล์ CSV ใน MinIO ตาม domain/province/disease/year" },
    { name: "statistics_tool",      description: "วิเคราะห์สถิติสุขภาพจิตและการฆ่าตัวตายรายจังหวัด" },
    { name: "data_analysis",        description: "วิเคราะห์แนวโน้มและปัจจัยเสี่ยงสุขภาพจิต" },
    { name: "disease_surveillance", description: "ข้อมูลระบบเฝ้าระวังการฆ่าตัวตายและสุขภาพจิต" },
    { name: "clinical_guidelines",  description: "แนวทางการรักษาและดูแลสุขภาพจิต" },
  ],
  visual: {
    color:  "text-purple-700",
    bg:     "bg-purple-50",
    border: "border-purple-200",
    dot:    "bg-purple-500",
    letter: "2",
  },
};

export default d2MentalHealth;
