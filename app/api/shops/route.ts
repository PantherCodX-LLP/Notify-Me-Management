import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { cached } from "@/lib/cache";
import { getShops } from "@/lib/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const featuresRaw = sp.get("features") || "";
  const features = featuresRaw ? featuresRaw.split(",").map((x) => x.trim()).filter(Boolean) : [];
  const args = {
    search: sp.get("search") || "",
    planId: sp.get("planId") || "",
    status: (sp.get("status") as any) || "all",
    blocked: (sp.get("blocked") as any) || "all",
    features,
    from: sp.get("from") || "",
    to: sp.get("to") || "",
    sort: sp.get("sort") || "created_at",
    dir: (sp.get("dir") as any) || "desc",
    page: Number(sp.get("page") || 1),
    pageSize: Number(sp.get("pageSize") || 25),
  };
  return handle(() => cached(`shops:${JSON.stringify(args)}`, 30_000, () => getShops(args)));
}
