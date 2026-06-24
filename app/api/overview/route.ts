import { handle } from "@/lib/api";
import { cached } from "@/lib/cache";
import { getOverview } from "@/lib/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(() => cached("overview", 60_000, () => getOverview()));
}
