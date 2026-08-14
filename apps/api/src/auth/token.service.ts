import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { USER_ROLES, type UserRole } from '@archai/shared';
import { type CookieOptions, type Response } from 'express';
import { z } from 'zod';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACCESS_COOKIE_PATH,
  AUTH_COOKIES,
  REFRESH_COOKIE_PATH,
  REFRESH_TOKEN_BYTES,
} from './auth.constants';

export interface SessionUser {
  id: string;
  role: UserRole;
}

export const accessTokenPayloadSchema = z.object({
  sub: z.string().min(1),
  role: z.enum(USER_ROLES),
});
export type AccessTokenPayload = z.infer<typeof accessTokenPayloadSchema>;

/** Issues, rotates and revokes access/refresh credentials. */
@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {}

  /** Signs an access JWT and stores a fresh refresh token, setting both cookies. */
  async issueSession(res: Response, user: SessionUser, userAgent?: string): Promise<void> {
    const accessToken = await this.signAccessToken(user);
    const refreshToken = await this.createRefreshToken(user.id, userAgent);
    this.setAuthCookies(res, accessToken, refreshToken);
  }

  async signAccessToken(user: SessionUser): Promise<string> {
    return this.jwt.signAsync(
      { sub: user.id, role: user.role },
      { secret: this.config.jwtAccessSecret, expiresIn: this.config.accessTtlSec },
    );
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    const payload = await this.jwt.verifyAsync<Record<string, unknown>>(token, {
      secret: this.config.jwtAccessSecret,
    });
    return accessTokenPayloadSchema.parse(payload);
  }

  hashRefreshToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  /** Mints an opaque refresh token together with the hash persisted in the DB. */
  generateRefreshToken(): { raw: string; hash: string } {
    const raw = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    return { raw, hash: this.hashRefreshToken(raw) };
  }

  /** Creates the DB row for a new opaque refresh token and returns the raw value. */
  async createRefreshToken(userId: string, userAgent?: string): Promise<string> {
    const { raw, hash } = this.generateRefreshToken();
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hash,
        expiresAt: this.refreshExpiryDate(),
        userAgent: userAgent ?? null,
      },
    });
    return raw;
  }

  async revokeToken(id: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Theft mitigation: a reused refresh token kills every session of that user. */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    res.cookie(
      AUTH_COOKIES.access,
      accessToken,
      this.cookieOptions(this.config.accessTtlSec, ACCESS_COOKIE_PATH),
    );
    res.cookie(
      AUTH_COOKIES.refresh,
      refreshToken,
      this.cookieOptions(this.config.refreshTtlSec, REFRESH_COOKIE_PATH),
    );
  }

  clearAuthCookies(res: Response): void {
    res.clearCookie(AUTH_COOKIES.access, this.clearOptions(ACCESS_COOKIE_PATH));
    res.clearCookie(AUTH_COOKIES.refresh, this.clearOptions(REFRESH_COOKIE_PATH));
  }

  refreshExpiryDate(from: Date = new Date()): Date {
    return new Date(from.getTime() + this.config.refreshTtlSec * 1000);
  }

  private cookieOptions(maxAgeSec: number, path: string): CookieOptions {
    return { ...this.clearOptions(path), maxAge: maxAgeSec * 1000 };
  }

  private clearOptions(path: string): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.cookieSecure,
      path,
    };
  }
}
