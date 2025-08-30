export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/((?!signin|api/auth|_next|favicon.ico).*)"
  ]
};