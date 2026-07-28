const publicNfcTokenPattern = /^[A-Za-z0-9_-]{43}$/u;

export function isValidPublicNfcToken(token: string): boolean {
  return publicNfcTokenPattern.test(token);
}
