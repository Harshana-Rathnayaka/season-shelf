import type { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description: ReactNode; actions?: ReactNode }) {
  return <header className="simple-heading page-header">
    <div><h1>{title}</h1><p>{description}</p></div>
    {actions && <div className="page-header-actions">{actions}</div>}
  </header>;
}
