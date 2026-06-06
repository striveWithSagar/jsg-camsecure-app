"use client";

import { useRef, forwardRef, useCallback, type ComponentProps } from "react";
import { Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MIN_DATE, MAX_DATE, MIN_DATETIME, MAX_DATETIME } from "@/lib/date-input";

type DateTimeInputProps = Omit<ComponentProps<"input">, "type"> & {
  type?:             "date" | "datetime-local" | "time";
  wrapperClassName?: string;
};

/**
 * DateTimeInput — a thin wrapper around Input that:
 *   1. Renders the real native <input type="date|datetime-local|time"> so all
 *      form behaviour (name, value, defaultValue, onChange, required…) is
 *      preserved without changes.
 *   2. Overlays a visible Lucide Calendar icon button. Clicking it calls
 *      inputRef.current.showPicker() (with a focus/click fallback), which
 *      reliably opens the browser's native date/time picker regardless of
 *      whether the native ::webkit-calendar-picker-indicator is visible.
 *   3. Uses pointer-events:none on the hidden native indicator (set via CSS)
 *      so the icon button is the sole click target on the right side.
 */
export const DateTimeInput = forwardRef<HTMLInputElement, DateTimeInputProps>(
  function DateTimeInput(
    { className, wrapperClassName, type = "datetime-local", disabled, ...props },
    forwardedRef,
  ) {
    const localRef = useRef<HTMLInputElement>(null);

    // Default min/max keeps user-entered years in a realistic range.
    // Props override these defaults if the caller needs a different range.
    const defaultMin = type === "datetime-local" ? MIN_DATETIME :
                       type === "date"           ? MIN_DATE      : undefined;
    const defaultMax = type === "datetime-local" ? MAX_DATETIME :
                       type === "date"           ? MAX_DATE      : undefined;

    // Merge forwarded ref with our local ref
    const setRef = useCallback(
      (el: HTMLInputElement | null) => {
        (localRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
        if (typeof forwardedRef === "function") forwardedRef(el);
        else if (forwardedRef)
          (forwardedRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
      },
      [forwardedRef],
    );

    function openPicker() {
      const el = localRef.current;
      if (!el || disabled) return;
      try {
        el.showPicker?.();
      } catch {
        // Fallback: focus then click to trigger native picker
        el.focus();
        el.click();
      }
    }

    const ariaLabel =
      type === "datetime-local" ? "Open date and time picker" :
      type === "time"           ? "Open time picker"          :
                                  "Open date picker";

    return (
      <div className={cn("relative", wrapperClassName)}>
        <Input
          ref={setRef}
          type={type}
          disabled={disabled}
          min={defaultMin}
          max={defaultMax}
          className={cn("pr-9", className)}
          {...props}
        />
        <button
          type="button"
          aria-label={ariaLabel}
          disabled={disabled}
          onClick={openPicker}
          tabIndex={-1}
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2",
            "flex h-5 w-5 items-center justify-center rounded",
            "text-muted-foreground transition-colors",
            "hover:text-foreground",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    );
  },
);
