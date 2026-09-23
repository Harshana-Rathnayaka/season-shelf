import type { ComponentProps } from "react";
import { AsyncActionButton } from "../../../shared/ui/AsyncActionButton";
import type { SettingsCommand, SettingsActionHandler } from "../types";

type Props = Omit<ComponentProps<typeof AsyncActionButton>, "onAction"> & { command: SettingsCommand; onAction: SettingsActionHandler };
export function SettingsButton({ command, onAction, ...props }: Props) {
  return <AsyncActionButton {...props} data-action={command.action} data-mode={"mode" in command ? command.mode : undefined} onAction={() => onAction(command)} />;
}
