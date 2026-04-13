import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/session/get-server-session";

export async function POST() {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Cache has been removed; this endpoint is kept for client compatibility
  // but is now a no-op.
  return NextResponse.json({ success: true });
}
