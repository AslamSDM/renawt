import { handlers } from "@/auth"
import { NextRequest } from "next/server";

// Wrap handlers with error handling
const wrappedHandlers = {
    GET: async (req: NextRequest) => {
        try {
            return await handlers.GET(req);
        } catch (error) {
            console.error("[Auth] GET error:", error);
            return new Response(JSON.stringify({ error: "Authentication error" }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }
    },
    POST: async (req: NextRequest) => {
        try {
            return await handlers.POST(req);
        } catch (error) {
            console.error("[Auth] POST error:", error);
            return new Response(JSON.stringify({ error: "Authentication error" }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }
    },
};

export const { GET, POST } = wrappedHandlers