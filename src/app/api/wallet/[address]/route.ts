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
  const abort = new AbortController();
  req.signal?.addEventListener("abort", () => abort.abort());
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: WalletStreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
        } catch {
          closed = true;
        }
      };
      try {
        const report = await buildWalletReport(v.value.address, v.value.window, {
          stage: (stage) => send({ type: "stage", stage }),
          progress: (p) => send({ type: "progress", ...p }),
          signal: abort.signal,
        });
        send({ type: "result", data: report });
      } catch (err) {
        if (!abort.signal.aborted) send({ type: "error", error: errorBody(toErrorCode(err)).error });
      } finally {
        releaseSlot();
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            /* already closed by the runtime */
          }
        }
      }
    },
    cancel() {
      // The client went away: stop scanning so we don't spend RPC quota for nobody.
      closed = true;
      abort.abort();
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
