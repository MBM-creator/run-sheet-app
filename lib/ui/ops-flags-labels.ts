/**
 * Dual label sets for ops flag / escalation UI.
 * Toggle USE_SOFT_OPS_FLAG_LANGUAGE to switch between testing (soft) and enforcement (hard) language.
 */

const SOFT_LABELS = {
  bannerTitle: "Operational Flag Active",
  bannerBody: (count: number) =>
    `There are ${count} items requiring review.`,
  bannerCta: "Review Items",
  acknowledgeLabel: "Confirm Review & Continue",
  commentLabel: "Review note (min 20 characters)",
  commentPlaceholder:
    "Briefly note the issue and next step (e.g. supplier delay, rebooked pump).",
  blockedCrewNote:
    "A supervisor or owner must review these items before EOD can be submitted.",
  modalTitle: "Operational Review",
  modalResolveTitle: "Close Item",
  modalAssignTitle: "Assign Follow-up",
  level1Label: "Review",
  level2Label: "Attention Required",
  level3Label: "Immediate Review",
  overdueText: "OVERDUE — Needs Review",
  dueText: "Due",
  confirmedText: "Confirmed",
  viewItemsText: "View Items",
  openInboxText: "Open Operational Review",
};

const HARD_LABELS = {
  bannerTitle: "Delivery Risk Active",
  bannerBody: (count: number) =>
    `There are ${count} escalations requiring action.`,
  bannerCta: "Open Escalation Inbox",
  acknowledgeLabel: "Acknowledge & Continue",
  commentLabel: "Acknowledgement note (min 20 characters)",
  commentPlaceholder:
    "Document the issue and recovery plan.",
  blockedCrewNote:
    "A supervisor or owner must acknowledge these escalations before EOD can be submitted.",
  modalTitle: "Escalation Inbox",
  modalResolveTitle: "Resolve Escalation",
  modalAssignTitle: "Assign Escalation",
  level1Label: "Warning",
  level2Label: "Action Required",
  level3Label: "Intervention Required",
  overdueText: "OVERDUE — Action Required",
  dueText: "Due",
  confirmedText: "Confirmed",
  viewItemsText: "View Escalations",
  openInboxText: "Open Escalation Inbox",
};

export const USE_SOFT_OPS_FLAG_LANGUAGE = true;

export const OPS_FLAG_LABELS = USE_SOFT_OPS_FLAG_LANGUAGE
  ? SOFT_LABELS
  : HARD_LABELS;
