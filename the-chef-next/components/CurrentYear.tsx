/**
 * Footer copyright year. The static page is built once, so the client may be
 * viewing it in a later year than the build — suppressHydrationWarning lets the
 * browser's current year win without a React warning.
 */
export default function CurrentYear() {
  return <span suppressHydrationWarning>{new Date().getFullYear()}</span>;
}
