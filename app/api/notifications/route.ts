import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { cached } from "@/lib/cache";
import { getNotifications } from "@/lib/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const args = {
    feature: sp.get("feature") || "",
    channel: sp.get("channel") || "",
    from: sp.get("from") || "",
    to: sp.get("to") || "",
  };
  return handle(() => cached(`notifications:${JSON.stringify(args)}`, 60_000, () => getNotifications(args)));
}
