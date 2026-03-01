"use client";

import { Button } from "@/components/ui/Button";
import { OPS_FLAG_LABELS } from "@/lib/ui/ops-flags-labels";

interface EscalationBannerProps {
  count: number;
  onOpenInbox: () => void;
}

export function EscalationBanner({ count, onOpenInbox }: EscalationBannerProps) {
  return (
    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-red-900">{OPS_FLAG_LABELS.bannerTitle}</h2>
          <p className="mt-1 text-sm text-red-800">
            {OPS_FLAG_LABELS.bannerBody(count)}
          </p>
        </div>
        <Button variant="primary" onClick={onOpenInbox} className="bg-red-600 hover:bg-red-700">
          {OPS_FLAG_LABELS.bannerCta}
        </Button>
      </div>
    </div>
  );
}
