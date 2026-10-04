import type { CollectionConfig } from "payload";
import { adminsOnly, editors, signedIn } from "../access/roles";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";

/**
 * MEDIA — editorial images and documents. Stored on local disk in
 * development (./media, git-ignored) and in S3 (ap-southeast-1) when
 * S3_BUCKET is configured (see payload.config.ts).
 *
 * The master Nusantara brand assets (logo, emblem, favicons, social image)
 * are code-controlled in /public and brand-source/ and are NOT managed here.
 *
 * B0: signed-in staff only. Public delivery of approved media is a B1 decision.
 */
export const Media: CollectionConfig = {
  slug: "media",
  admin: { group: "Media", useAsTitle: "alt" },
  access: { read: signedIn, create: editors, update: editors, delete: adminsOnly },
  hooks: { afterChange: [auditAfterChange], afterDelete: [auditAfterDelete] },
  upload: {
    staticDir: "media",
    mimeTypes: ["image/png", "image/jpeg", "image/webp", "image/avif", "application/pdf"],
    imageSizes: [
      { name: "card", width: 800 },
      { name: "wide", width: 1600 },
    ],
    adminThumbnail: "card",
  },
  fields: [
    { name: "alt", label: "Alternative text", type: "text", required: true },
    { name: "credit", label: "Credit / licence", type: "text", admin: { description: "Source and licence. Required before public use." } },
  ],
};
