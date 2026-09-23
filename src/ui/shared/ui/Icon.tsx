import { paths } from "./icons.mjs";

/** Only the application's static SVG definitions enter this boundary. */
export function Icon({ name }: { name: string }) {
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: paths[name as keyof typeof paths] || paths.film }} />;
}
