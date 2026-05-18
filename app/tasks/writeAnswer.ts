import type { Task } from "@/app/agents/types";
import { synthesizer } from "@/app/agents";
import analyzeQuery from "./analyzeQuery";
import researchData from "./researchData";

const writeAnswer: Task = {
  description:
    "เรียบเรียงคำตอบสุดท้ายสำหรับคำถาม: {query}\n\n" +
    "🚨 กฎเหล็ก (ละเมิด = ตอบผิด):\n" +
    "❌ ห้ามใช้ตัวเลขที่ไม่ปรากฏใน Research Agent context\n" +
    "❌ ห้ามปรับ format (2 → 2%, 1234 → '1.2K')\n" +
    "❌ ห้าม interpolate ปีที่ไม่มี (ถ้ามีแค่ 2568, 2569 อย่าเดา 2565-2567)\n" +
    "❌ ห้ามตัดคอลัมน์ออกจากตารางที่ Research Agent ให้มา\n" +
    "❌ ห้ามเปลี่ยน table layout เป็น 'รายการข้อมูล | ค่า' (key-value)\n" +
    "✅ คัดลอกตารางจาก Research Agent ตรงๆ พร้อมทุกคอลัมน์\n" +
    "✅ ถ้า Research Agent มี table 10 column → Final Answer ต้องมี 10 column ครบ\n" +
    "✅ ปีที่ไม่มีข้อมูล → 'ไม่พบในไฟล์'\n" +
    "✅ ระบุแหล่งที่มา: คัดลอก MARKDOWN_LINK จาก Tool result\n\n" +
    "ก่อนเขียนคำตอบ:\n" +
    "1. ตรวจทุกตัวเลขว่าตรงกับ Research Agent\n" +
    "2. ตรวจจำนวนคอลัมน์ในตารางว่าครบเท่ากัน\n" +
    "ถ้าไม่ตรง = ถือว่าแต่ง → แก้ให้ตรง",
  expectedOutput:
    "คำตอบ Markdown ที่:\n" +
    "1. ทุกตัวเลขตรงกับ Research Agent (verbatim, ไม่ปัด, ไม่ปรับ format)\n" +
    "2. ตารางมีคอลัมน์ครบเหมือนใน Research Agent (ไม่ใช่ key-value 2 คอลัมน์)\n" +
    "3. ปีที่ Research Agent ไม่มี → ระบุชัด 'ไม่พบในไฟล์'\n" +
    "4. มี MARKDOWN_LINK ของไฟล์ที่ใช้",
  agent: synthesizer,
  context: [analyzeQuery, researchData],
};

export default writeAnswer;
