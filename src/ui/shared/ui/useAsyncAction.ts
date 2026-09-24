import { useRef, useState } from "react";

/** Callers present errors; this prevents concurrent submissions from one control. */
export function useAsyncAction() {
  const active = useRef(false);
  const [pending, setPending] = useState(false);
  async function run(action: () => Promise<void>) {
    if (active.current) return;
    active.current = true;
    setPending(true);
    try { await action(); }
    finally { active.current = false; setPending(false); }
  }
  return { pending, run };
}
