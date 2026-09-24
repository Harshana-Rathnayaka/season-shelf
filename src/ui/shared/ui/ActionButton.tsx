import type { ButtonHTMLAttributes } from "react";
import { Icon } from "./Icon";

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  glyph?: string;
  iconOnly?: boolean;
}

export function ActionButton({ label, glyph, iconOnly = false, className, title = label, ...props }: ActionButtonProps) {
  return <button type="button" className={className || (iconOnly ? "icon-button" : "button secondary")} title={title} aria-label={label} {...props}>
    {glyph && <Icon name={glyph} />}{!iconOnly && label}
  </button>;
}
