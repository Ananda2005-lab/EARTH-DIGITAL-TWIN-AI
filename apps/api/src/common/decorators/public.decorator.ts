import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'edt:is-public';

/** Opt a route out of the global JWT guard. */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
