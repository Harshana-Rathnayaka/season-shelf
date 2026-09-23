import type { DownloadActionHandler, DownloadCommand } from "../../types/downloads";
import { AsyncActionButton } from "../AsyncActionButton";

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
  return <AsyncActionButton {...props} disabled={disabled}
    data-action={command.action}
    data-job={"job" in command ? command.job : undefined}
    data-control={"control" in command ? command.control : undefined}
    onAction={() => onAction(command)} />;
}
