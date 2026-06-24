import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { cached } from "@/lib/cache";
import { getEmailContext } from "@/lib/stats";
import type { Campaign } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const id = sp.get("id") || "";
  const lang = sp.get("lang") || "";
  const campaign = (sp.get("campaign") as Campaign) || "feature";
  return handle(() => cached(`email-context:${id}:${lang}:${campaign}`, 60_000, () => getEmailContext(id, lang, campaign)));
}
