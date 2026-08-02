import { SetMetadata } from '@nestjs/common';

export const ATTRIBUTION_KEY = 'edt:attribution';

/** Upstream credit surfaced in `meta.attribution` (licence compliance). */
export const Attribution = (text: string): MethodDecorator & ClassDecorator =>
  SetMetadata(ATTRIBUTION_KEY, text);
