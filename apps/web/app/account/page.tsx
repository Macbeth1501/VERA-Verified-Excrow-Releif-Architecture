import { redirect } from "next/navigation";

/** The account page now lives at /dashboard/donor; this keeps old links and bookmarks working. */
export default function AccountRedirect() {
  redirect("/dashboard/donor");
}
