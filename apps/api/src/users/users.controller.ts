import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type UserDto } from '@archai/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { type AuthenticatedUser } from '../common/types/request.types';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiCookieAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Current authenticated user' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<UserDto> {
    return this.users.findMe(user.id);
  }
}
