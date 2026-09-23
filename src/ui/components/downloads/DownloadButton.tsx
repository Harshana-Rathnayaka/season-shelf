import { useRef, useState } from "react";
import type { DownloadActionHandler, DownloadCommand } from "../../types/downloads";
import { ActionButton } from "../ActionButton";

interface Props {
  command: DownloadCommand;
  onAction: DownloadActionHandler;
  label: string;
  glyph?: string;
  title?: string;
  disabled?: boolean;
  iconOnly?: boolean;
  className?: string;
}

export function DownloadButton({ command, onAction, disabled, ...props }: Props) {
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  return <ActionButton {...props} disabled={disabled || pending} aria-busy={pending || undefined}
    data-action={command.action}
    data-job={"job" in command ? command.job : undefined}
    data-control={"control" in command ? command.control : undefined}
    onClick={async event => {
      event.stopPropagation();
      if (inFlight.current) return;
      inFlight.current = true;
      setPending(true);
      try { await onAction(command); }
      finally { inFlight.current = false; setPending(false); }
    }} />;
}
