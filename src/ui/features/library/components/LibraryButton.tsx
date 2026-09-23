import type { ComponentProps } from "react";
import type { LibraryCommand, LibraryActionHandler } from "../types";
import { AsyncActionButton } from "../../../shared/ui/AsyncActionButton";

type Props = Omit<ComponentProps<typeof AsyncActionButton>, "onAction"> & { command: LibraryCommand; onAction: LibraryActionHandler };
export function LibraryButton({ command, onAction, ...props }: Props) {
  return <AsyncActionButton {...props} data-action={command.action}
    data-mode={"mode" in command ? command.mode : undefined}
    onAction={() => onAction(command)} />;
}
