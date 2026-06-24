import { handle } from "@/lib/api";
import { cached } from "@/lib/cache";
import { getFeatures } from "@/lib/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(() => cached("features", 60_000, () => getFeatures()));
}
