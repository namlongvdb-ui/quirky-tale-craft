import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "mark_notification_read",
  title: "Đánh dấu đã đọc thông báo",
  description: "Mark one of the signed-in user's notifications as read.",
  inputSchema: {
    notification_id: z.string().describe("The notification id to mark as read."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ notification_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const { data, error } = await supabaseForUser(ctx)
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notification_id)
      .eq("user_id", ctx.getUserId()!)
      .select("id, is_read");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data || data.length === 0) {
      return { content: [{ type: "text", text: "Notification not found" }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data[0]) }],
      structuredContent: { notification: data[0] },
    };
  },
});
