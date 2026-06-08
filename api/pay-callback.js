import {
  getRequestBody,
  getRpcResult,
  handleApiError,
  methodNotAllowed,
  sendJson,
} from "../lib/http.js";
import { getSupabase } from "../lib/supabase.js";
import { verifyWechatPayCallback } from "../lib/wechat-pay.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return methodNotAllowed(response, ["POST"]);
  }

  if (!verifyWechatPayCallback(request)) {
    return sendJson(response, 401, {
      error: "invalid_signature",
      message: "支付回调签名验证失败",
    });
  }

  const body = getRequestBody(request);
  const orderNo = body?.order_no;

  if (typeof orderNo !== "string" || !orderNo.trim()) {
    return sendJson(response, 400, {
      error: "invalid_order_no",
      message: "order_no 必须是非空字符串",
    });
  }

  try {
    const { data, error } = await getSupabase().rpc(
      "complete_membership_order",
      {
        p_order_no: orderNo.trim(),
      },
    );

    if (error) {
      if (error.message?.includes("ORDER_NOT_FOUND")) {
        return sendJson(response, 404, {
          error: "order_not_found",
          message: "订单不存在",
        });
      }
      throw error;
    }

    const result = getRpcResult(data);
    return sendJson(response, 200, {
      success: true,
      order_no: result.order_no,
      status: result.status,
      membership_type: result.membership_type,
      membership_expiry: result.membership_expiry,
    });
  } catch (error) {
    return handleApiError(response, error);
  }
}
