import type { ButtonHTMLAttributes } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Icon } from "./Icon";

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  glyph?: string;
  iconOnly?: boolean;
}

export function ActionButton({ label, glyph, iconOnly = false, className, title = label, ...props }: ActionButtonProps) {
  const button = <button type="button" className={className || (iconOnly ? "icon-button" : "button secondary")} title={iconOnly ? undefined : title} aria-label={label} {...props}>
    {glyph && <Icon name={glyph} />}{!iconOnly && label}
  </button>;
  if (!iconOnly) return button;
  return <Tooltip.Root><Tooltip.Trigger asChild>{button}</Tooltip.Trigger><Tooltip.Portal>
      <Tooltip.Content className="control-tooltip" sideOffset={7}>{title}<Tooltip.Arrow className="control-tooltip-arrow" /></Tooltip.Content>
    </Tooltip.Portal></Tooltip.Root>;
}
