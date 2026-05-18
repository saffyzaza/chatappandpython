interface RightPaneProps {
  onClose?: () => void;
  onShowLeftPane?: () => void;
  showLeftPaneButton?: boolean;
}

export const RightPane = ({ onClose, onShowLeftPane, showLeftPaneButton = false }: RightPaneProps) => {
  return <div className="flex-1 h-full" />;
};
