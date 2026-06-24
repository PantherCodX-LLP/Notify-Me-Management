import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { cached } from "@/lib/cache";
import { getEmailRecommendations } from "@/lib/stats";
import type { Campaign } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const args = {
    missing: sp.get("missing") || "",
    campaign: (sp.get("campaign") as Campaign) || "feature",
    page: Number(sp.get("page") || 1),
    pageSize: Number(sp.get("pageSize") || 20),
  };
  return handle(() => cached(`email-recs:${JSON.stringify(args)}`, 60_000, () => getEmailRecommendations(args)));
}
