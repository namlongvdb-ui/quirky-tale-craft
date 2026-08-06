import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMyProfile from "./tools/get-my-profile";
import listPendingVouchers from "./tools/list-pending-vouchers";
import listNotifications from "./tools/list-notifications";
import markNotificationRead from "./tools/mark-notification-read";
import listVoucherSignatures from "./tools/list-voucher-signatures";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "quality-life-tools",
  title: "Quality Life Tools",
  version: "0.1.0",
  instructions:
    "Tools for the Quality Life Tools financial management app (Vietnamese union finance system). Read the signed-in user's profile and roles, list vouchers awaiting signature or already approved, inspect signature history, and read or mark notifications. All data is scoped to the signed-in user by row-level security.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getMyProfile, listPendingVouchers, listNotifications, markNotificationRead, listVoucherSignatures],
});
