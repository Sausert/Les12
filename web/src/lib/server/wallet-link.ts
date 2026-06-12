/** Challenge an external wallet signs (personal_sign) to prove ownership. */
export function linkMessage(username: string, address: string): string {
  return `SonicOmerta:link:${username}:${address.toLowerCase()}`;
}
