import { timingSafeEqual } from "node:crypto";

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function verifyWechatPayCallback(request) {
  const expectedSecret = process.env.WECHAT_PAY_CALLBACK_SECRET;
  const receivedSecret = request.headers["x-wechat-mock-signature"];

  if (
    !expectedSecret ||
    typeof receivedSecret !== "string" ||
    !safeEqual(receivedSecret, expectedSecret)
  ) {
    return false;
  }

  // TODO: Replace this mock with WeChat Pay API v3 certificate and signature
  // verification before accepting real payments.
  return true;
}
