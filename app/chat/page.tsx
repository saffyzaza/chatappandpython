"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import clsx from "clsx";
import { LeftPane } from "./LeftPane";
import { RightPane } from "./RightPane";
import { IoCode, IoChevronBackOutline } from "react-icons/io5";

const LEFT_PANE_RAIL_WIDTH = 52;

export default function ChatPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(60); // เริ่มต้นที่ 50%
  const [isDragging, setIsDragging] = useState(false);
  const [showLeftPane, setShowLeftPane] = useState(true);
  const [showRightPane, setShowRightPane] = useState(true);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      // คำนวณเป็นเปอร์เซ็นต์
      const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;

      // จำกัดระยะการดึงไม่ให้น้อยกว่า 20% หรือมากกว่า 80%
      if (newLeftWidth > 20 && newLeftWidth < 80) {
        setLeftWidth(newLeftWidth);
      }
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    } else {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={containerRef}
      className={clsx(
        "relative flex w-full h-full overflow-hidden",
        isDragging && "cursor-col-resize select-none"
      )}
    >
      {/* ฝั่งซ้าย */}
      <div 
        style={{ width: showLeftPane ? (showRightPane ? `${leftWidth}%` : "100%") : `${LEFT_PANE_RAIL_WIDTH}px` }} 
        className={clsx(
          "flex flex-col flex-shrink-0 h-full overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] transition-all duration-300 ease-in-out",
          showLeftPane ? "px-4 pt-4" : "items-center px-0 pt-6"
        )}
      >
        {showLeftPane ? (
          <div className="relative h-full">
            <button
              type="button"
              onClick={() => setShowLeftPane(false)}
              className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-lg bg-white/95 px-2.5 py-1.5 text-xs font-medium text-[#a04222] shadow-sm ring-1 ring-[#f0dfd8] transition hover:bg-[#fff1eb]"
            >
              <span>ซ่อน</span>
              <IoChevronBackOutline size={14} />
            </button>
            <LeftPane />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowLeftPane(true)}
            className="inline-flex items-center gap-1 rounded-full border border-[#f0dfd8] bg-white px-2 py-3 text-xs font-medium text-[#a04222] shadow-sm transition hover:bg-[#fff1eb]"
            title="แสดง LeftPane"
          >
            <IoChevronBackOutline size={14} className="rotate-180" />
          </button>
        )}
      </div>

      {/* เส้นกั้นและใช้สำหรับลากขยับ (Resizer) */}
      <div
        className={clsx(
          "relative flex items-center justify-center w-1 h-full cursor-col-resize transition-colors duration-200 z-10 flex-shrink-0 group",
          (!showRightPane || !showLeftPane) && "hidden",
          isDragging ? "bg-[#a04222]" : "bg-gray-200 hover:bg-[#a04222]"
        )}
        onMouseDown={handleMouseDown}
      >
        <div
          className={clsx(
            "absolute flex items-center justify-center w-6 h-6 bg-white border rounded shadow-sm transition-colors duration-200",
            isDragging 
              ? "border-[#a04222] text-[#a04222]" 
              : "border-gray-200 text-gray-400 group-hover:border-[#a04222] group-hover:text-[#a04222]"
          )}
        >
          <IoCode size={14} />
        </div>
      </div>

      {/* ฝั่งขวา */}
      <div 
        style={{ width: showRightPane ? (showLeftPane ? `${100 - leftWidth}%` : `calc(100% - ${LEFT_PANE_RAIL_WIDTH}px)`) : "0%" }} 
        className={clsx(
          "flex flex-col flex-grow h-full overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pt-4 transition-all duration-300 ease-in-out",
          !showRightPane ? "hidden px-0" : "px-4"
        )}
      >
        <RightPane onClose={() => setShowRightPane(false)} />
      </div>
    </div>
  );
}