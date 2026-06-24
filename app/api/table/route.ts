import { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { getTableData } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const table = sp.get("table") || "";
  return handle(() =>
    getTableData({
      table,
      page: Number(sp.get("page") || 1),
      pageSize: Number(sp.get("pageSize") || 50),
      search: sp.get("search") || "",
      sortCol: sp.get("sortCol") || undefined,
      sortDir: (sp.get("sortDir") as "asc" | "desc") || undefined,
    })
  );
}
