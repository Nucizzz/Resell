import React, { useEffect, useRef } from "react";
import { Barcode } from "lucide-react";

export type ScanInputProps = {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onScan?: (code: string) => void;
  autoFocusOnMount?: boolean;
  onRequestScan?: () => void;
  inputRef?: React.RefObject<HTMLInputElement>;
};

const ScanInput = React.forwardRef<HTMLInputElement, ScanInputProps>(
  (
    {
      label,
      placeholder,
      value,
      onChange,
      onScan,
      autoFocusOnMount = true,
      onRequestScan,
      inputRef,
    },
    forwardedRef
  ) => {
    const innerRef = useRef<HTMLInputElement | null>(null);
    const ref = (forwardedRef as React.MutableRefObject<HTMLInputElement | null>) || inputRef || innerRef;

    useEffect(() => {
      if (!autoFocusOnMount || value || typeof window === "undefined") return;
      const timer = window.setTimeout(() => {
        const active = document.activeElement as HTMLElement | null;
        if (!active) {
          ref.current?.focus();
          return;
        }
        const tag = active.tagName.toLowerCase();
        const editable = active.getAttribute?.("contenteditable");
        const isField = tag === "input" || tag === "textarea" || editable === "true";
        if (!isField) {
          ref.current?.focus();
        }
      }, 250);
      return () => window.clearTimeout(timer);
    }, [autoFocusOnMount, value, ref]);

    return (
      <div className="space-y-2">
        {label && <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
        <div className="relative">
          <input
            ref={ref}
            className="input w-full pr-12"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            enterKeyHint="done"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (value) onScan?.(value);
              }
            }}
          />
          <button
            type="button"
            aria-label="Apri scanner barcode"
            className="absolute right-2 top-1/2 -translate-y-1/2 btn px-3 py-2"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onRequestScan?.();
            }}
          >
            <Barcode className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }
);

ScanInput.displayName = "ScanInput";

export default ScanInput;
