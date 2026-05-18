import { IoChevronForwardOutline, IoCloseOutline } from "react-icons/io5";

interface RightPaneProps {
  onClose?: () => void;
  onShowLeftPane?: () => void;
  showLeftPaneButton?: boolean;
}

export const RightPane = ({ onClose, onShowLeftPane, showLeftPaneButton = false }: RightPaneProps) => {
    return (
        <div className="flex-1 h-full p-4 bg-[#fcfbf9] overflow-y-auto rounded-lg">
            {/* header */}
            <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    {showLeftPaneButton ? (
                        <button
                          type="button"
                          onClick={onShowLeftPane}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#f0dfd8] bg-white px-2.5 py-1.5 text-xs font-medium text-[#a04222] shadow-sm transition hover:bg-[#fff1eb]"
                        >
                          <IoChevronForwardOutline size={14} />
                          <span>แสดง LeftPane</span>
                        </button>
                    ) : null}
                    <h2 className="text-lg font-bold text-gray-800">Right Content</h2>
                </div>
                <button 
                  onClick={onClose} 
                  className="p-1 hover:bg-gray-200 rounded-md transition-colors"
                >
                  <IoCloseOutline size={20} />
                </button>
            </div>
            <div className="text-sm text-gray-600">
                main content ฝั่งขวาของหน้าจอ...
            </div>
        </div>
    );
};