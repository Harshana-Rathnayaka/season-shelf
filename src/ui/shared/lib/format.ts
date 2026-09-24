export const bytes = (number: number) =>
  number >= 1024 ** 3
    ? `${(number / 1024 ** 3).toFixed(2)} GB`
    : `${(number / 1024 ** 2).toFixed(1)} MB`;
export function friendlyError(message: unknown): string {
  return /ENOENT|no such file or directory/i.test(String(message)) ? "This file is no longer available. Check its drive or remove its history from Finished downloads." : /EACCES|EPERM/i.test(String(message)) ? "Windows could not access this file. Check its permissions and whether another app is using it." : String(message);
}
