import { Injectable, UnauthorizedException } from '@nestjs/common';
import { type UserDto } from '@archai/shared';
import { ERROR_CODES } from '../common/error-codes';
import { PrismaService } from '../prisma/prisma.service';
import { toUserDto } from './user.mapper';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findMe(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Authentication required',
      });
    }
    return toUserDto(user);
  }
}
