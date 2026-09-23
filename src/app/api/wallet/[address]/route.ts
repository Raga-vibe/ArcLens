import { errorBody, errorResponse, toErrorCode } from "@/lib/api";
import { allowedWindows, serverConfig } from "@/lib/arc/config";
import { buildWalletReport } from "@/lib/arc/report";
import { clientIp, rateLimit, releaseSlot, tryAcquireSlot } from "@/lib/rate-limit";
import { validateWalletRequest } from "@/lib/request";
import type { WalletStreamEvent } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Streams analysis progress as NDJSON, ending with a `result` or `error`
 * event. Validation and rate limiting happen before any upstream call.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/wallet/[address]">) {
  const { address: rawAddress } = await ctx.params;
  const url = new URL(req.url);
  const v = validateWalletRequest(rawAddress, url.searchParams.get("window"), allowedWindows());
  if (!v.ok) return errorResponse(v.code);

  const rl = rateLimit(`wallet:${clientIp(req)}`, serverConfig.rateLimitPerMinute);
  if (!rl.ok) return errorResponse("RATE_LIMITED", rl.retryAfter);
  if (!tryAcquireSlot()) return errorResponse("RATE_LIMITED", 10);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (e: WalletStreamEvent) => {
        if (!closed) controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
      };
      try {
        const report = await buildWalletReport(v.value.address, v.value.window, {
          stage: (stage) => send({ type: "stage", stage }),
          progress: (p) => send({ type: "progress", ...p }),
        });
        send({ type: "result", data: report });
      } catch (err) {
        send({ type: "error", error: errorBody(toErrorCode(err)).error });
      } finally {
        releaseSlot();
        closed = true;
        controller.close();
      }
    },
    cancel() {
      // Client navigated away; the slot is released when the work settles.
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
