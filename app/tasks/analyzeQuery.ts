import type { Task } from "@/app/agents/types";
import { orchestrator } from "@/app/agents";
import { DOMAIN_LIST } from "@/app/agents/domains";

const analyzeQuery: Task = {
  description:
    "วิเคราะห์คำถามของผู้ใช้: {query}\n\n" +
    "ระบุสิ่งต่อไปนี้:\n" +
    "1. หัวข้อหลักที่ถามถึง\n" +
    "2. ประเภทข้อมูลที่ต้องการ (ตัวเลข/วิชาการ/แนวทาง/เปรียบเทียบ)\n" +
    `3. Domain agent ที่เหมาะสมที่สุด ระบุในรูปแบบ [DOMAIN: ชื่อ] โดยต้องเป็นหนึ่งใน: ${DOMAIN_LIST}\n` +
    "4. คำค้นหาหรือ keyword ที่ควรใช้\n" +
    "5. ขอบเขตเวลา จังหวัด หรือกลุ่มประชากรที่เกี่ยวข้อง (ถ้ามี)",
  expectedOutput:
    "การวิเคราะห์ 3-5 ประโยค ต้องมี [DOMAIN: ชื่อ] กำกับ เช่น [DOMAIN: D2_Mental_Health] " +
    "พร้อม keyword สำหรับ domain agent",
  agent: orchestrator,
};

export default analyzeQuery;
