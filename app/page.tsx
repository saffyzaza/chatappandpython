

import { ChatInput } from "./component/chat/ChatInput";

export default function Home() {
  const cards = [
    {
      title: "วิธีลดความเครียด",
      description: "ค้นหาเทคนิคและกิจกรรมผ่อนคลาย",
    },
    {
      title: "อาหารสุขภาพ",
      description: "ไอเดียเมนูสำหรับคนทำงาน",
    },
    {
      title: "ออกกำลังกายที่บ้าน",
      description: "แนะนำท่าง่ายๆ ไม่ต้องใช้อุปกรณ์",
    },
    {
      title: "ปรึกษาการเลิกบุหรี่",
      description: "ขั้นตอนและเคล็ดลับในการเลิก",
    },
  ];

  return (
    <div className="h-full overflow-hidden bg-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-3xl mx-auto flex flex-col items-center justify-center">
        {/* Header Section */}
        <div className="flex flex-col items-center mb-8">
          <img 
            src="Thai_Health.png" 
            alt="สสส สำนักงานกองทุนสนับสนุนการสร้างเสริมสุขภาพ" 
            className="h-16 mb-4 object-contain"
          />
          <h1 className="text-xl md:text-2xl font-bold text-[#475569]">
            สำนักงานกองทุนสนับสนุนการสร้างเสริมสุขภาพ
          </h1>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mb-8">
          {cards.map((card, index) => (
            <div 
              key={index}
              className="flex flex-col px-5 py-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            >
              <h2 className="text-base font-bold text-[#475569] mb-1">{card.title}</h2>
              <p className="text-gray-500 text-xs sm:text-sm">{card.description}</p>
            </div>
          ))}
        </div>
        
        {/* Chat Input Section */}
        
      </div>
    </div>
  );
}
