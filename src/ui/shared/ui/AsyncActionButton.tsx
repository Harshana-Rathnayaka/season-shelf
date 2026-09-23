import type { ComponentProps } from "react";
import { useAsyncAction } from "./useAsyncAction";
import { ActionButton } from "./ActionButton";

type Props = Omit<ComponentProps<typeof ActionButton>, "onClick"> & { onAction: () => Promise<void> };

/** Callers handle errors; the control prevents repeated requests until settled. */
export function AsyncActionButton({ onAction, disabled, ...props }: Props) {
  const { pending, run } = useAsyncAction();
  return <ActionButton {...props} disabled={disabled || pending} aria-busy={pending || undefined}
    onClick={async event => {
      event.stopPropagation();
      await run(onAction);
    }} />;
}
