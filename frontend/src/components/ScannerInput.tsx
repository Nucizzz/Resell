interface ScannerInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}

export function ScannerInput({ label, value, onChange, type = 'text' }: ScannerInputProps) {
  return (
    <label>
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={`Scanner input for ${label.toLowerCase()}`}
      />
    </label>
  );
}
