export function sendJson(response, statusCode, body) {
  response.status(statusCode).json(body);
}

export function methodNotAllowed(response, allowedMethods) {
  response.setHeader("Allow", allowedMethods.join(", "));
  sendJson(response, 405, {
    error: "method_not_allowed",
    message: `Allowed methods: ${allowedMethods.join(", ")}`,
  });
}

export function getRequestBody(request) {
  if (
    request.body &&
    typeof request.body === "object" &&
    !Buffer.isBuffer(request.body)
  ) {
    return request.body;
  }

  if (typeof request.body === "string" && request.body.trim()) {
    try {
      return JSON.parse(request.body);
    } catch {
      return null;
    }
  }

  return {};
}

export function requireOpenId(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const openId = value.trim();
  return openId.length <= 128 ? openId : null;
}

export function getRpcResult(data) {
  return Array.isArray(data) ? data[0] : data;
}

export function handleApiError(response, error) {
  console.error(error);

  sendJson(response, 500, {
    error: "internal_server_error",
    message: "服务器内部错误",
  });
}
