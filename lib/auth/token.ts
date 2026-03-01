import crypto from "crypto";
import type { TokenPayload } from "@/lib/types";

const SEP = ".";

function base64urlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4;
  const base64 = pad ? padded + "=".repeat(4 - pad) : padded;
  return Buffer.from(base64, "base64");
}

export function signToken(payload: TokenPayload): string {
  const secret = process.env.RUN_SHEET_SIGNING_SECRET;
  if (!secret) throw new Error("RUN_SHEET_SIGNING_SECRET is not set");

  const payloadJson = JSON.stringify(payload);
  const payloadB64 = base64urlEncode(Buffer.from(payloadJson, "utf8"));
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest();
  const sigB64 = base64urlEncode(signature);
  return `${payloadB64}${SEP}${sigB64}`;
}

export function verifyToken(token: string): TokenPayload | null {
  const secret = process.env.RUN_SHEET_SIGNING_SECRET;
  if (!secret) return null;

  const idx = token.lastIndexOf(SEP);
  if (idx === -1) return null;
  const payloadB64 = token.slice(0, idx);
  const sigB64 = token.slice(idx + 1);

  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest();
  const expectedB64 = base64urlEncode(expectedSig);

  try {
    if (!crypto.timingSafeEqual(Buffer.from(sigB64, "utf8"), Buffer.from(expectedB64, "utf8"))) {
      return null;
    }
  } catch {
    return null;
  }

  let payload: TokenPayload;
  try {
    const raw = base64urlDecode(payloadB64).toString("utf8");
    payload = JSON.parse(raw) as TokenPayload;
  } catch {
    return null;
  }

  if (!payload.project_id || !payload.role || !payload.expires_at) {
    return null;
  }
  const expires = new Date(payload.expires_at).getTime();
  if (Date.now() > expires) {
    return null;
  }
  return payload;
}
