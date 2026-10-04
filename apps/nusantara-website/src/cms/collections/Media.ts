import { APIError, type CollectionBeforeChangeHook, type CollectionConfig } from "payload";
import { adminsOnly, approverField, editors, isStaff } from "../access/roles";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";
import { logEvent } from "../log";

/**
 * MEDIA — editorial images and documents. Stored on local disk in
 * development (./media, git-ignored) and in a PRIVATE S3 bucket
 * (ap-southeast-1) when S3_BUCKET is configured (see payload.config.ts).
 *
 * The master Nusantara brand assets (logo, emblem, favicons, social image)
 * are code-controlled in /public and brand-source/ and are NOT managed here.
 *
 * Delivery: files are never served from the bucket directly (Block Public
 * Access stays on; nothing is listable). They are served through
 * /api/cms/media/file/…, which applies the read rule below on every request:
 *  - signed-in staff can read all media;
 *  - anonymous visitors can read only files a Reviewer or Admin has marked
 *    "Approved for public use" (licence/credit recorded). An uploaded file is
 *    therefore not discoverable merely because it exists in S3.
 * Responses are `Cache-Control: private, no-store` (next.config.ts), so no
 * shared cache can keep serving a file after its approval is withdrawn.
 *
 * Uploads: images (PNG, JPEG, WebP, AVIF) and PDF only — no SVG or HTML, which
 * could carry script — up to 10 MB. Browser → S3 uploads are signed for the
 * declared type and size (Payload's S3 adapter); this collection re-checks
 * both on the server before the record is saved.
 */
export const MEDIA_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/avif", "application/pdf"];
export const MEDIA_MAX_BYTES = 10_000_000;

const checkFile: CollectionBeforeChangeHook = ({ data, req }) => {
  const mime = data?.mimeType as string | undefined;
  const size = data?.filesize as number | undefined;
  const reject = (reason: string) => {
    logEvent("warn", "media.rejected", { reason, mimeType: mime, filesize: size, userId: req.user?.id });
    throw new APIError(reason, 400, null, true);
  };
  if (mime !== undefined && !MEDIA_MIME_TYPES.includes(mime)) reject("This file type is not allowed. Upload PNG, JPEG, WebP, AVIF or PDF.");
  if (size !== undefined && size > MEDIA_MAX_BYTES) reject("This file is larger than 10 MB.");
  if (data?.publicDelivery && !String(data?.credit ?? "").trim()) reject("Record the source and licence before approving a file for public use.");
  return data;
};

export const Media: CollectionConfig = {
  slug: "media",
  admin: { group: "Media", useAsTitle: "alt", defaultColumns: ["alt", "filename", "publicDelivery", "updatedAt"] },
  access: {
    read: ({ req }) => isStaff(req) || { publicDelivery: { equals: true } },
    create: editors,
    update: editors,
    delete: adminsOnly,
  },
  hooks: { beforeChange: [checkFile], afterChange: [auditAfterChange], afterDelete: [auditAfterDelete] },
  upload: {
    staticDir: "media",
    mimeTypes: MEDIA_MIME_TYPES,
    imageSizes: [
      { name: "card", width: 800 },
      { name: "wide", width: 1600 },
    ],
    adminThumbnail: "card",
  },
  fields: [
    { name: "alt", label: "Alternative text", type: "text", required: true, admin: { description: "Describes the image for people who cannot see it. Required." } },
    { name: "credit", label: "Source / licence", type: "text", admin: { description: "Who made it and under what licence. Required before public use." } },
    {
      name: "publicDelivery",
      label: "Approved for public use",
      type: "checkbox",
      defaultValue: false,
      access: { create: approverField, update: approverField },
      admin: { position: "sidebar", description: "Only a Reviewer or Admin can set this. Until it is set, the file can be opened only by signed-in staff." },
    },
  ],
};
