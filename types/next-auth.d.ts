import "next-auth";
import type { DefaultSession } from "next-auth";
// biome-ignore lint/correctness/noUnusedImports: <needed>
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
  }
}
