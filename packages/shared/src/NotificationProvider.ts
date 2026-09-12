/**
 * Notification dispatch provider contract. Contract only — no implementation.
 * See platform-services/notifications.
 */
export type NotificationChannel = "in-app" | "email" | "push";

export interface NotificationRequest {
  recipientUserId: string;
  channel: NotificationChannel;
  template: string; // a named template key, never raw sensitive payload text
  data: Record<string, unknown>;
}

export interface NotificationProvider {
  send(request: NotificationRequest): Promise<void>;
}
