import { errorResponse, toErrorCode } from "@/lib/api";
import { buildTransactionReport } from "@/lib/arc/report";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { validateTxRequest } from "@/lib/request";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: RouteContext<"/api/tx/[hash]">) {
  const { hash } = await ctx.params;
  const v = validateTxRequest(hash);
  if (!v.ok) return errorResponse(v.code);

  const rl = rateLimit(`tx:${clientIp(req)}`, 40);
  if (!rl.ok) return errorResponse("RATE_LIMITED", rl.retryAfter);

  try {
    const data = await buildTransactionReport(v.value);
    if (!data) return errorResponse("NOT_FOUND");
    // Finalized transactions are immutable on Arc: safe to cache.
    return Response.json(
      { ok: true, data },
      { headers: { "cache-control": "public, max-age=60, s-maxage=86400" } },
    );
  } catch (err) {
    return errorResponse(toErrorCode(err));
  }
}
