import { NextRequest, NextResponse } from "next/server";

export function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete("auth_token");
  response.cookies.delete("username");
  response.cookies.delete("allowed_tenant_slug");
  return response;
}
