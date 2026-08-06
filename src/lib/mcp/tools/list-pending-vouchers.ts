import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_pending_vouchers",
  title: "Danh sách chứng từ",
  description:
    "List vouchers visible to the signed-in user, optionally filtered by status (pending, signed, approved) or voucher type.",
  inputSchema: {
    status: z.string().optional().describe("Filter by status, e.g. pending or signed."),
    voucher_type: z.string().optional().describe("Filter by voucher type, e.g. phieu-thu, phieu-chi."),
    limit: z.number().int().optional().describe("Max rows to return (default 20, max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, voucher_type, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const take = Math.min(Math.max(limit ?? 20, 1), 100);
    let query = supabaseForUser(ctx)
      .from("pending_vouchers")
      .select("id, voucher_id, voucher_type, status, created_at, signed_at, printed_at, voucher_data")
      .order("created_at", { ascending: false })
      .limit(take);
    if (status) query = query.eq("status", status);
    if (voucher_type) query = query.eq("voucher_type", voucher_type);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { vouchers: data ?? [] },
    };
  },
});
