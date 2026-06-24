import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { cached } from "@/lib/cache";
import { getStoreNotifications } from "@/lib/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const args = {
    channel: sp.get("channel") || "",
    from: sp.get("from") || "",
    to: sp.get("to") || "",
    sort: (sp.get("sort") as "collected" | "sent") || "collected",
    page: Number(sp.get("page") || 1),
    pageSize: Number(sp.get("pageSize") || 20),
  };
  return handle(() => cached(`notif-stores:${JSON.stringify(args)}`, 30_000, () => getStoreNotifications(args)));
}
