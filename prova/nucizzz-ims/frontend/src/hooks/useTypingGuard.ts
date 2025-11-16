import { useEffect } from "react";

function isEditingElement(el: HTMLElement | null) {
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  const editable = el.getAttribute?.("contenteditable");
  return tag === "input" || tag === "textarea" || editable === "true";
}

export function useTypingGuard(onKey?: (event: KeyboardEvent) => void) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (isEditingElement(document.activeElement as HTMLElement | null)) {
        return;
      }
      onKey?.(event);
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => {
      window.removeEventListener("keydown", handler, { capture: true } as any);
    };
  }, [onKey]);
}

