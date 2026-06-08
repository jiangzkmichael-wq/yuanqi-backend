import {
  getRequestBody,
  getRpcResult,
  handleApiError,
  methodNotAllowed,
  requireOpenId,
  sendJson,
} from "../lib/http.js";
import { getSupabase } from "../lib/supabase.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return methodNotAllowed(response, ["POST"]);
  }

  const body = getRequestBody(request);
  const openId = requireOpenId(body?.open_id);
  if (!openId) {
    return sendJson(response, 400, {
      error: "invalid_open_id",
      message: "open_id 必须是非空字符串",
    });
  }

  try {
    const { data, error } = await getSupabase().rpc("deduct_user_quota", {
      p_open_id: openId,
    });

    if (error) {
      throw error;
    }

    const result = getRpcResult(data);
    return sendJson(response, result.success ? 200 : 409, {
      success: result.success,
      remaining: result.remaining,
    });
  } catch (error) {
    return handleApiError(response, error);
  }
}
