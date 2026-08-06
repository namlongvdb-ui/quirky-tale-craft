import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_voucher_signatures",
  title: "Lịch sử ký duyệt",
  description: "List digital signature records for vouchers visible to the signed-in user, newest first.",
  inputSchema: {
    voucher_id: z.string().optional().describe("Only signatures for this voucher id."),
    limit: z.number().int().optional().describe("Max rows to return (default 20, max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ voucher_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const take = Math.min(Math.max(limit ?? 20, 1), 100);
    let query = supabaseForUser(ctx)
      .from("voucher_signatures")
      .select("*")
      .order("signed_at", { ascending: false })
      .limit(take);
    if (voucher_id) query = query.eq("voucher_id", voucher_id);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { signatures: data ?? [] },
    };
  },
});
