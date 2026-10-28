export { auth as middleware } from "@/auth";

export const config = {
  matcher: ["/projects/:path*", "/creative/:path*", "/profile/:path*"],
};
