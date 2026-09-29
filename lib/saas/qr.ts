import QRCode from "qrcode";

/**
 * QR tags. A printed tag lives on the iron for years, so its link is fixed
 * to the real domain (not an env var that could point at a preview) and to
 * the asset's tag token, which never changes.
 */
export const TAG_BASE = "https://www.synnr.io/t/";

export const tagUrl = (token: string) => `${TAG_BASE}${token}`;

/** An inline SVG of the code, crisp at any print size. */
export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0f172a", light: "#ffffff" } });
}
