const publicNfcTokenPattern = /^[A-Za-z0-9_-]{16,256}$/u;

export function isValidPublicNfcToken(token: string): boolean {
  return publicNfcTokenPattern.test(token);
}
