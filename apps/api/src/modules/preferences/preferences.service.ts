import { Injectable } from '@nestjs/common';
import { isLayerId, type PreferencesInput, type UserPreferences } from '@edt/shared';
import { AppException } from 'src/common/errors/app-exception';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { toUserPreferences } from '../users/user.mapper';

/** Per-user UI and notification preferences, always returned fully populated. */
@Injectable()
export class PreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<UserPreferences> {
    const preference = await this.prisma.userPreference.findUnique({ where: { userId } });
    return toUserPreferences(preference);
  }

  async update(userId: string, input: PreferencesInput): Promise<UserPreferences> {
    const unknownLayers = (input.defaultLayers ?? []).filter((layer) => !isLayerId(layer));
    if (unknownLayers.length > 0) {
      throw AppException.validation('Unknown layer ids', { unknownLayers });
    }

    const preference = await this.prisma.userPreference.upsert({
      where: { userId },
      create: { userId, ...input },
      update: { ...input },
    });
    return toUserPreferences(preference);
  }

  async reset(userId: string): Promise<UserPreferences> {
    await this.prisma.userPreference.deleteMany({ where: { userId } });
    const preference = await this.prisma.userPreference.create({ data: { userId } });
    return toUserPreferences(preference);
  }
}
