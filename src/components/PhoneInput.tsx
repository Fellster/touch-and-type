import { Input } from "@/components/ui/input";
import type { ComponentProps } from "react";

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!/^[\d\s().-]*$/.test(value) || digits.length > 10) return value;
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6)].filter(Boolean).join("-");
}

export function PhoneInput({ value, onValueChange, ...props }: Omit<ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
}) {
  return <Input {...props} type="tel" autoComplete="tel" value={value} onChange={(event) => {
    const input = event.currentTarget;
    let raw = input.value;
    let caret = input.selectionStart ?? raw.length;
    // Backspace over a separator should remove the preceding digit.
    if ((event.nativeEvent as InputEvent).inputType === "deleteContentBackward"
      && value.length === raw.length + 1 && value[caret] === "-"
      && value.slice(0, caret) + value.slice(caret + 1) === raw && caret > 0) {
      raw = raw.slice(0, caret - 1) + raw.slice(caret);
      caret--;
    }
    const formatted = formatPhone(raw);
    const digitsBeforeCaret = raw.slice(0, caret).replace(/\D/g, "").length;
    onValueChange(formatted);
    if (formatted !== input.value) {
      let next = 0;
      let count = 0;
      while (next < formatted.length && count < digitsBeforeCaret) {
        if (/\d/.test(formatted[next])) count++;
        next++;
      }
      requestAnimationFrame(() => {
        if (document.activeElement === input && input.value === formatted) input.setSelectionRange(next, next);
      });
    }
  }} />;
}
