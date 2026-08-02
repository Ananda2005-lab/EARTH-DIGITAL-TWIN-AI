import { SetMetadata } from '@nestjs/common';

export const RAW_RESPONSE_KEY = 'edt:raw-response';

/** Skip the `ApiResponse<T>` envelope (redirects, SSE streams, file downloads). */
export const RawResponse = (): MethodDecorator & ClassDecorator =>
  SetMetadata(RAW_RESPONSE_KEY, true);
