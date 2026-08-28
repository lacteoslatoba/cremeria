import { NextResponse } from "next/server";
import { reconcileClipOrderByPaymentRequestId } from "@/lib/clip";

// Clip doesn't document a webhook signature, so we never trust this body's
// status directly — we only use it as a trigger to re-check the real status
// with Clip's own API (reconcileClipOrderByPaymentRequestId does that).
export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const paymentRequestId: string | undefined = body?.payment_request_id;

        if (!paymentRequestId) {
            // Nothing we can act on — acknowledge so Clip doesn't keep retrying.
            return NextResponse.json({ received: true });
        }

        await reconcileClipOrderByPaymentRequestId(paymentRequestId);
        return NextResponse.json({ received: true });
    } catch (error) {
        console.error("[CLIP_WEBHOOK_ERROR]", error);
        // Still 200 — Clip will retry on failure codes, but the real
        // reconciliation already happens (idempotently) via the return page too.
        return NextResponse.json({ received: true });
    }
}
