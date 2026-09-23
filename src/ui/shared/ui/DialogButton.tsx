import type { ComponentProps } from "react";
import { AsyncActionButton } from "./AsyncActionButton";
import type { DialogAction, DialogActionData, DialogActionHandler } from "./dialog-actions";

type Props = Omit<ComponentProps<typeof AsyncActionButton>, "onAction"> & { action: DialogAction; data?: DialogActionData; onAction: DialogActionHandler };
export function DialogButton({ action, data = {}, onAction, ...props }: Props) {
  return <AsyncActionButton {...props} data-action={action} data-id={data.id} data-job={data.job} data-choice={data.choice} data-channel={data.channel} data-response={data.response} onAction={() => onAction(action, data)} />;
}
