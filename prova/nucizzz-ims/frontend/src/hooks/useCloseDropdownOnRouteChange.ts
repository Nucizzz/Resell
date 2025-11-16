import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function useCloseDropdownOnRouteChange(
  isOpen: boolean,
  close: () => void,
  containerRef?: React.RefObject<HTMLElement>
) {
  const location = useLocation();

  useEffect(() => {
    if (isOpen) {
      close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointer = (event: MouseEvent | TouchEvent) => {
      if (!containerRef?.current) return;
      const target = event.target as Node | null;
      if (target && !containerRef.current.contains(target)) {
        close();
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, close, containerRef]);
}

