import { NextResponse } from "next/server";

export type ApiError = { code: string; message: string };

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function created<T>(data: T) {
  return ok(data, 201);
}

export function error(messageOrError: string | ApiError, status = 400) {
  const err: ApiError =
    typeof messageOrError === "string"
      ? { code: "ERROR", message: messageOrError }
      : messageOrError;
  return NextResponse.json({ success: false, error: err }, { status });
}

export function unauthorized(message = "Unauthorized") {
  return error({ code: "UNAUTHORIZED", message }, 401);
}

export function forbidden(message = "Forbidden") {
  return error({ code: "FORBIDDEN", message }, 403);
}

export function notFound(message = "Not found") {
  return error({ code: "NOT_FOUND", message }, 404);
}

export function serverError(message = "Internal server error") {
  return error({ code: "SERVER_ERROR", message }, 500);
}
