// Progress/diagnostic output goes to stderr, keeping stdout reserved for
// machine-readable results (tokens, ids) so commands can be piped. `console.log`
// is the stdout data channel; `info` is the stderr human channel.
export function info(...args: unknown[]): void {
  console.error(...args);
}
