import { handle } from "@/lib/api";
import { cached } from "@/lib/cache";
import { getConversion } from "@/lib/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(() => cached("conversion", 60_000, () => getConversion()));
}
