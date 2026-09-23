import { useLayoutEffect, useRef } from "react";

/** Temporary ownership boundary for pages awaiting conversion to React. */
export function LegacyPage({ html, revision }: { html: string; revision: number }) {
  const container = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    // HTML comes exclusively from existing escaping-aware page renderers.
    if (container.current) container.current.innerHTML = html;
  }, [html, revision]);
  return <main ref={container} />;
}
