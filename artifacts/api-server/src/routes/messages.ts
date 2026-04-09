import { Router } from "express";
import { db } from "@workspace/db";
import { messages, users } from "@workspace/db/schema";
import { eq, desc, and, or, sql } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { normalizeRouteParam } from "../lib/params";
import { logger } from "../lib/logger";

const router = Router();

// FIX: максимальная длина одного сообщения
const MAX_MESSAGE_LENGTH = 4000;

router.get("/chats", authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).userId;

    const chatPartners = await db.execute(sql`
      SELECT DISTINCT
        CASE WHEN sender_id = ${userId} THEN receiver_id ELSE sender_id END as partner_id
      FROM messages
      WHERE sender_id = ${userId} OR receiver_id = ${userId}
    `);

    const partnerIds = (chatPartners.rows as any[]).map((r) => r.partner_id);
    if (partnerIds.length === 0) {
      res.json([]);
      return;
    }

    const chats = await Promise.all(
      partnerIds.map(async (partnerId: string) => {
        const [partner] = await db
          .select({ id: users.id, username: users.username, avatar: users.avatar })
          .from(users)
          .where(eq(users.id, partnerId))
          .limit(1);

        const [lastMsg] = await db
          .select()
          .from(messages)
          .where(
            or(
              and(eq(messages.senderId, userId), eq(messages.receiverId, partnerId)),
              and(eq(messages.senderId, partnerId), eq(messages.receiverId, userId))
            )
          )
          .orderBy(desc(messages.createdAt))
          .limit(1);

        const [{ count }] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(messages)
          .where(
            and(
              eq(messages.senderId, partnerId),
              eq(messages.receiverId, userId),
              eq(messages.isRead, false)
            )
          );

        return { userId: partnerId, user: partner, lastMessage: lastMsg, unreadCount: count };
      })
    );

    chats.sort((a, b) => (b.lastMessage?.createdAt || 0) - (a.lastMessage?.createdAt || 0));
    res.json(chats);
  } catch (err) {
    logger.error(err, "Get chats error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/:userId", authMiddleware, async (req, res) => {
  try {
    const myId = (req as any).userId;
    const partnerId = normalizeRouteParam(req.params.userId);
    if (!partnerId) { res.status(400).json({ message: "Invalid user id" }); return; }

    const msgs = await db
      .select({
        id: messages.id,
        senderId: messages.senderId,
        receiverId: messages.receiverId,
        text: messages.text,
        isRead: messages.isRead,
        createdAt: messages.createdAt,
        senderUsername: users.username,
        senderAvatar: users.avatar,
      })
      .from(messages)
      .leftJoin(users, eq(messages.senderId, users.id))
      .where(
        or(
          and(eq(messages.senderId, myId), eq(messages.receiverId, partnerId)),
          and(eq(messages.senderId, partnerId), eq(messages.receiverId, myId))
        )
      )
      .orderBy(messages.createdAt)
      .limit(100);

    await db
      .update(messages)
      .set({ isRead: true })
      .where(and(eq(messages.senderId, partnerId), eq(messages.receiverId, myId), eq(messages.isRead, false)));

    const enriched = msgs.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      receiverId: m.receiverId,
      text: m.text,
      isRead: m.isRead,
      createdAt: m.createdAt,
      sender: { id: m.senderId, username: m.senderUsername, avatar: m.senderAvatar },
    }));

    res.json(enriched);
  } catch (err) {
    logger.error(err, "Get messages error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/:userId", authMiddleware, async (req, res) => {
  try {
    const senderId = (req as any).userId;
    const receiverId = normalizeRouteParam(req.params.userId);
    const { text } = req.body;
    if (!receiverId) { res.status(400).json({ message: "Invalid user id" }); return; }
    if (!text?.trim()) { res.status(400).json({ message: "Empty message" }); return; }

    // FIX: ограничение длины сообщения
    if (text.trim().length > MAX_MESSAGE_LENGTH) {
      res.status(400).json({ message: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)` });
      return;
    }

    if (senderId === receiverId) { res.status(400).json({ message: "Cannot message yourself" }); return; }

    const [receiver] = await db.select({ id: users.id }).from(users).where(eq(users.id, receiverId)).limit(1);
    if (!receiver) { res.status(404).json({ message: "User not found" }); return; }

    const [msg] = await db.insert(messages).values({ senderId, receiverId, text: text.trim() }).returning();
    res.json(msg);
  } catch (err) {
    logger.error(err, "Send message error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
