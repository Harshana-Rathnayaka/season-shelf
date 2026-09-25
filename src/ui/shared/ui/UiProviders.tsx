import type { PropsWithChildren } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";

export function UiProviders({ children }: PropsWithChildren) {
  return <Tooltip.Provider delayDuration={450} skipDelayDuration={150}>{children}</Tooltip.Provider>;
}
