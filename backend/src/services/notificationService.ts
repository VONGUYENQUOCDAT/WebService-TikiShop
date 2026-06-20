import { prisma } from "../lib/prisma.js";

export class NotificationService {
  static async createNotification(userId: string, title: string, content: string) {
    try {
      return await prisma.notification.create({
        data: {
          userId,
          title,
          content,
        },
      });
    } catch (e) {
      console.error("Failed to create notification:", e);
    }
  }
}
