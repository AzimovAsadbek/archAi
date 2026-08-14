import { SetMetadata, type CustomDecorator } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'archai:isPublic';

/** Marks a route (or controller) as reachable without authentication. */
export const Public = (): CustomDecorator<string> => SetMetadata(IS_PUBLIC_KEY, true);
