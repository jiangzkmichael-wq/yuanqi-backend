import { randomBytes } from "node:crypto";

export function createOrderNo() {
  const timestamp = new Date()
    .toISOString()
    .replace(/\D/g, "")
    .slice(0, 17);
  const randomPart = randomBytes(6).toString("hex").toUpperCase();

  return `YQ${timestamp}${randomPart}`;
}
