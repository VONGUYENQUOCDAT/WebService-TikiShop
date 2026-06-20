import type { Request, Response, NextFunction } from "express";
import type { UserRole } from "@prisma/client";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

export interface AuthPayload {
  userId: string;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function authRequired(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  const token = h?.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Unauthorized", message: "Thiếu token Bearer" });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as Partial<AuthPayload> & {
      userId: string;
      email: string;
    };
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role ?? "USER",
    };
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized", message: "Token không hợp lệ" });
  }
}

/** Chỉ ADMIN (kiểm tra theo DB, không tin mỗi JWT). */
export async function adminRequired(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized", message: "Cần đăng nhập" });
    return;
  }
  const row = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { role: true },
  });
  if (!row || row.role !== "ADMIN") {
    res.status(403).json({ error: "Forbidden", message: "Bạn không có quyền quản trị" });
    return;
  }
  next();
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  const token = h?.startsWith("Bearer ") ? h.slice(7) : null;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as Partial<AuthPayload> & {
        userId: string;
        email: string;
      };
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role ?? "USER",
      };
    } catch {
      /* ignore */
    }
  }
  next();
}

/** Chỉ SELLER hoặc ADMIN (kiểm tra theo DB). */
export async function sellerRequired(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized", message: "Cần đăng nhập" });
    return;
  }
  const row = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { role: true },
  });
  if (!row || (row.role !== "SELLER" && row.role !== "ADMIN")) {
    res.status(403).json({ error: "Forbidden", message: "Bạn cần là Nhà bán hàng được duyệt" });
    return;
  }
  next();
}
