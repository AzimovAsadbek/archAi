import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { type AuthResponse, type LoginInput, type RegisterInput } from '@archai/shared';
import { Prisma, type User } from '@prisma/client';
import * as argon2 from 'argon2';
import { type Request, type Response } from 'express';
import { ERROR_CODES } from '../common/error-codes';
import { readCookie } from '../common/types/request.types';
import { PrismaService } from '../prisma/prisma.service';
import { toUserDto } from '../users/user.mapper';
import { AUTH_COOKIES } from './auth.constants';
import { TokenService } from './token.service';

const ARGON2_OPTIONS: argon2.Options = { type: argon2.argon2id };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  /** Verified against when the email is unknown, so login timing stays uniform. */
  private dummyHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async register(input: RegisterInput, res: Response, userAgent?: string): Promise<AuthResponse> {
    const email = normalizeEmail(input.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException({
        code: ERROR_CODES.EMAIL_TAKEN,
        message: 'This email is already registered',
      });
    }

    const passwordHash = await argon2.hash(input.password, ARGON2_OPTIONS);
    const user = await this.createUser(email, passwordHash, input.fullName);
    await this.tokens.issueSession(res, user, userAgent);
    return { user: toUserDto(user) };
  }

  async login(input: LoginInput, res: Response, userAgent?: string): Promise<AuthResponse> {
    const email = normalizeEmail(input.email);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Equalize timing with the "user exists" path — no user enumeration.
      await this.verifyPassword(await this.getDummyHash(), input.password);
      throw this.invalidCredentials();
    }

    const passwordOk = await this.verifyPassword(user.passwordHash, input.password);
    if (!passwordOk || !user.isActive) {
      throw this.invalidCredentials();
    }

    await this.tokens.issueSession(res, user, userAgent);
    return { user: toUserDto(user) };
  }

  /** Rotates the refresh token; reuse of a revoked token kills the whole family. */
  async refresh(req: Request, res: Response, userAgent?: string): Promise<AuthResponse> {
    const rawToken = readCookie(req, AUTH_COOKIES.refresh);
    if (!rawToken) {
      throw this.unauthorized();
    }

    const tokenHash = this.tokens.hashRefreshToken(rawToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored) {
      this.tokens.clearAuthCookies(res);
      throw this.unauthorized();
    }

    if (stored.revokedAt) {
      this.logger.warn(`Refresh token reuse detected for user ${stored.userId} — revoking family`);
      await this.tokens.revokeAllForUser(stored.userId);
      this.tokens.clearAuthCookies(res);
      throw this.unauthorized();
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      await this.tokens.revokeToken(stored.id);
      this.tokens.clearAuthCookies(res);
      throw this.unauthorized();
    }

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || !user.isActive) {
      await this.tokens.revokeAllForUser(stored.userId);
      this.tokens.clearAuthCookies(res);
      throw this.unauthorized();
    }

    const accessToken = await this.tokens.signAccessToken(user);
    const nextRefreshToken = await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
      const { raw, hash } = this.tokens.generateRefreshToken();
      await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: hash,
          expiresAt: this.tokens.refreshExpiryDate(),
          userAgent: userAgent ?? stored.userAgent,
        },
      });
      return raw;
    });

    this.tokens.setAuthCookies(res, accessToken, nextRefreshToken);
    return { user: toUserDto(user) };
  }

  /** Always succeeds: clears cookies and revokes the presented token when known. */
  async logout(req: Request, res: Response): Promise<void> {
    const rawToken = readCookie(req, AUTH_COOKIES.refresh);
    if (rawToken) {
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash: this.tokens.hashRefreshToken(rawToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    this.tokens.clearAuthCookies(res);
  }

  private async createUser(email: string, passwordHash: string, fullName: string): Promise<User> {
    try {
      return await this.prisma.user.create({ data: { email, passwordHash, fullName } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          code: ERROR_CODES.EMAIL_TAKEN,
          message: 'This email is already registered',
        });
      }
      throw error;
    }
  }

  private async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  private async getDummyHash(): Promise<string> {
    this.dummyHash ??= argon2.hash(
      'archai-dummy-password-for-uniform-login-timing',
      ARGON2_OPTIONS,
    );
    return this.dummyHash;
  }

  private invalidCredentials(): UnauthorizedException {
    return new UnauthorizedException({
      code: ERROR_CODES.INVALID_CREDENTIALS,
      message: 'Invalid email or password',
    });
  }

  private unauthorized(): UnauthorizedException {
    return new UnauthorizedException({
      code: ERROR_CODES.UNAUTHORIZED,
      message: 'Authentication required',
    });
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
