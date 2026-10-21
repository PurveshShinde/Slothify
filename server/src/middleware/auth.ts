import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'slothify-jwt-secure-super-secret-key-2026';

export interface AuthUser {
    userId: string;
    username: string;
}

// Extend Express Request type
declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}

/**
 * Generate a JWT token for a user
 */
export function signToken(user: AuthUser): string {
    return jwt.sign(
        { userId: user.userId, username: user.username },
        JWT_SECRET,
        { expiresIn: '30d' }
    );
}

/**
 * Optional / Soft Auth: extracts user if token is present, continues even if not
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
            const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
            req.user = { userId: decoded.userId, username: decoded.username };
        } catch (err) {
            // Invalid token, ignore and treat as guest
        }
    }
    next();
}

/**
 * Strict Auth: returns 401 if not authenticated
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }

    const token = authHeader.substring(7);
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
        req.user = { userId: decoded.userId, username: decoded.username };
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
    }
}
