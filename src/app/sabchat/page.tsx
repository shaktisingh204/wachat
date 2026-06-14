import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// The layout gate has already ensured a project is selected and setup is
// complete by the time this renders — send the user to the inbox.
export default function SabchatIndexPage() {
  redirect("/sabchat/inbox");
}
