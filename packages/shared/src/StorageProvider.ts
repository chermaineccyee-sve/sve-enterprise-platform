/**
 * Object storage provider contract. Contract only — no implementation.
 *
 * apps/svegip's document registry (`_document-storage.mts`) currently
 * stores only a caller-supplied reference string with no real upload/storage
 * behind it (recorded as a HIGH finding in SVEGIP_ENTERPRISE_ASSESSMENT.md) —
 * unchanged by this PR. This is the contract a real implementation should
 * satisfy, so a private local store and AWS S3 are interchangeable behind it.
 */
export interface StoredObjectRef {
  provider: string;
  reference: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

export interface StorageProvider {
  /** Stores a binary object and returns a durable, provider-neutral reference. */
  put(data: Uint8Array, fileName: string, mimeType: string): Promise<StoredObjectRef>;

  /** Retrieves a previously stored object. Implementations must enforce their own access control. */
  get(reference: string): Promise<Uint8Array>;

  delete(reference: string): Promise<void>;
}
