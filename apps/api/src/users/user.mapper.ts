import { type UserDto } from '@archai/shared';
import { type User } from '@prisma/client';

/** Maps a Prisma user row to the public DTO — never exposes `passwordHash`. */
export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}
