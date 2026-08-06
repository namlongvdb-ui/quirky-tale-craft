import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_my_profile",
  title: "Lấy thông tin người dùng",
  description: "Get the signed-in user's profile (full name, username, assigned area) and their roles.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();
    const [profile, roles] = await Promise.all([
      supabase.from("profiles").select("full_name, username, email, assigned_area").eq("user_id", userId!).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId!),
    ]);
    if (profile.error) return { content: [{ type: "text", text: profile.error.message }], isError: true };
    const result = { profile: profile.data, roles: (roles.data ?? []).map((r) => r.role) };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
});
