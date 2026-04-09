import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "";

// FIX БАГ #21: не допускаем запуск с пустым секретом в production
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("FATAL: JWT_SECRET env variable is not set. Set it in your environment.");
  }
  console.warn("[AUTH] WARNING: JWT_SECRET is not set. Using insecure fallback — never do this in production!")
}

const _JWT_SECRET = JWT_SECRET || "minions-market-dev-only-secret-do-not-use-in-prod";

export interface JwtPayload {
  userId: string;
  username: string;
  isAdmin: boolean;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, _JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, _JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const token = header.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ message: "Invalid token" });
    return;
  }
  (req as any).userId = payload.userId;
  (req as any).username = payload.username;
  (req as any).isAdmin = payload.isAdmin;
  next();
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    const payload = verifyToken(header.slice(7));
    if (payload) {
      (req as any).userId = payload.userId;
      (req as any).username = payload.username;
      (req as any).isAdmin = payload.isAdmin;
    }
  }
  next();
}

export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!(req as any).isAdmin) {
    res.status(403).json({ message: "Admin only" });
    return;
  }
  next();
}
