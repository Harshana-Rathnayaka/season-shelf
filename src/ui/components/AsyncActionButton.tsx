import { useRef, useState, type ComponentProps } from "react";
import { ActionButton } from "./ActionButton";

type Props = Omit<ComponentProps<typeof ActionButton>, "onClick"> & { onAction: () => Promise<void> };

/** Callers handle errors; the control prevents repeated requests until settled. */
export function AsyncActionButton({ onAction, disabled, ...props }: Props) {
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  return <ActionButton {...props} disabled={disabled || pending} aria-busy={pending || undefined}
    onClick={async event => {
      event.stopPropagation();
      if (inFlight.current) return;
      inFlight.current = true;
      setPending(true);
      try { await onAction(); }
      finally { inFlight.current = false; setPending(false); }
    }} />;
}
