import React from "react";
import { Barcode } from "lucide-react";

export type ScanInputProps = {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onScan?: (code: string) => void;
  autoFocus?: boolean;
  onRequestScan?: () => void;
};

const ScanInput = React.forwardRef<HTMLInputElement, ScanInputProps>(
  ({ label, placeholder, value, onChange, onScan, autoFocus, onRequestScan }, ref) => {
    return (
      <div className="space-y-2">
        {label && <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
        <div className="relative">
          <input
            ref={ref}
            className="input w-full pr-12"
            placeholder={placeholder}
            value={value}
            autoFocus={autoFocus}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && value) {
                onScan?.(value);
              }
            }}
          />
          <button
            type="button"
            aria-label="Apri scanner barcode"
            className="absolute right-2 top-1/2 -translate-y-1/2 btn px-3 py-2"
            onClick={onRequestScan}
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

