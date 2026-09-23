import type { ReactNode, FormHTMLAttributes } from "react";
import { useAsyncAction } from "./useAsyncAction";

interface Props extends Omit<FormHTMLAttributes<HTMLFormElement>, "onSubmit" | "children"> {
  onSave: (form: HTMLFormElement) => Promise<void>;
  children: (pending: boolean) => ReactNode;
}
export function AsyncForm({ onSave, children, ...props }: Props) {
  const { pending, run } = useAsyncAction();
  return <form {...props} aria-busy={pending || undefined} onSubmit={event => {
    event.preventDefault(); event.stopPropagation();
    const form = event.currentTarget;
    void run(() => onSave(form));
  }}>{children(pending)}</form>;
}
