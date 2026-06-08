import {
  getRequestBody,
  getRpcResult,
  handleApiError,
  methodNotAllowed,
  requireOpenId,
  sendJson,
} from "../lib/http.js";
import { createOrderNo } from "../lib/orders.js";
import { isPlanType, PLANS } from "../lib/plans.js";
import { getSupabase } from "../lib/supabase.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return methodNotAllowed(response, ["POST"]);
  }

  const body = getRequestBody(request);
  const openId = requireOpenId(body?.open_id);
  const planType = body?.plan_type;

  if (!openId) {
    return sendJson(response, 400, {
      error: "invalid_open_id",
      message: "open_id 必须是非空字符串",
    });
  }

  if (!isPlanType(planType)) {
    return sendJson(response, 400, {
      error: "invalid_plan_type",
      message: "plan_type 必须是 month、quarter 或 year",
    });
  }

  const orderNo = createOrderNo();
  const amount = PLANS[planType].amount;

  try {
    const { data, error } = await getSupabase().rpc("create_membership_order", {
      p_order_no: orderNo,
      p_open_id: openId,
      p_plan_type: planType,
      p_amount: amount,
    });

    if (error) {
      throw error;
    }

    const order = getRpcResult(data);
    return sendJson(response, 201, {
      order_no: order.order_no,
      amount: order.amount,
    });
  } catch (error) {
    return handleApiError(response, error);
  }
}
