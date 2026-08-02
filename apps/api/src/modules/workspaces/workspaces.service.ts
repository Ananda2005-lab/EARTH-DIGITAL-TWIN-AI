import { Injectable } from '@nestjs/common';
import type { Annotation as AnnotationRow, Prisma, WorkspaceRole } from '@prisma/client';
import type {
  Annotation,
  CreateWorkspaceInput,
  LngLat,
  PaginatedResult,
  ViewState,
  Workspace,
  WorkspaceMember,
} from '@edt/shared';
import { AppException } from 'src/common/errors/app-exception';
import { Paginated } from 'src/common/pagination';
import { PrismaService } from 'src/infra/prisma/prisma.service';
import { randomToken } from 'src/common/crypto/crypto.util';

export interface WorkspaceListQuery {
  page: number;
  pageSize: number;
  q?: string;
}

export interface AnnotationInput {
  kind: Annotation['kind'];
  label: string;
  color: string;
  coordinates: LngLat[];
  radiusM?: number;
  notes?: string;
}

const WORKSPACE_INCLUDE = {
  annotations: { orderBy: { createdAt: 'asc' } },
  members: {
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  },
  owner: { select: { id: true, name: true, avatarUrl: true } },
} satisfies Prisma.WorkspaceInclude;

type WorkspaceWithRelations = Prisma.WorkspaceGetPayload<{ include: typeof WORKSPACE_INCLUDE }>;

/**
 * Collaborative scenes: camera state, active layers, annotations and members.
 * Access is resolved per request — owner, member role, or public visibility.
 */
@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: WorkspaceListQuery): Promise<PaginatedResult<Workspace>> {
    const where: Prisma.WorkspaceWhereInput = {
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      ...(query.q ? { name: { contains: query.q, mode: 'insensitive' } } : {}),
    };

    const { skip, take } = Paginated.skipTake(query);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.workspace.findMany({
        where,
        include: WORKSPACE_INCLUDE,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.workspace.count({ where }),
    ]);

    return Paginated.of(rows.map(toWorkspace), total, query);
  }

  async get(userId: string | null, id: string): Promise<Workspace> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id },
      include: WORKSPACE_INCLUDE,
    });
    if (!workspace) throw AppException.notFound('Workspace not found');
    this.assertCanRead(workspace, userId);
    return toWorkspace(workspace);
  }

  async getByShareSlug(slug: string): Promise<Workspace> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { shareSlug: slug },
      include: WORKSPACE_INCLUDE,
    });
    if (!workspace || workspace.visibility === 'private')
      throw AppException.notFound('Workspace not found');
    return toWorkspace(workspace);
  }

  async create(userId: string, input: CreateWorkspaceInput): Promise<Workspace> {
    const workspace = await this.prisma.workspace.create({
      data: {
        ownerId: userId,
        name: input.name,
        description: input.description ?? null,
        view: input.view,
        layers: input.layers,
        visibility: input.visibility,
        members: { create: { userId, role: 'owner' } },
        annotations: {
          create: input.annotations.map((annotation) => ({
            createdById: userId,
            kind: annotation.kind,
            label: annotation.label,
            color: annotation.color,
            coordinates: annotation.coordinates,
            radiusM: annotation.radiusM ?? null,
            notes: annotation.notes ?? null,
          })),
        },
      },
      include: WORKSPACE_INCLUDE,
    });
    return toWorkspace(workspace);
  }

  async update(
    userId: string,
    id: string,
    input: Partial<CreateWorkspaceInput>,
  ): Promise<Workspace> {
    await this.assertCanWrite(userId, id);
    const workspace = await this.prisma.workspace.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description === undefined ? undefined : (input.description ?? null),
        view:
          input.view === undefined ? undefined : (input.view as unknown as Prisma.InputJsonValue),
        layers: input.layers,
        visibility: input.visibility,
      },
      include: WORKSPACE_INCLUDE,
    });
    return toWorkspace(workspace);
  }

  async remove(userId: string, id: string): Promise<void> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id },
      select: { ownerId: true },
    });
    if (!workspace) throw AppException.notFound('Workspace not found');
    if (workspace.ownerId !== userId)
      throw AppException.forbidden('Only the owner can delete a workspace');
    await this.prisma.workspace.delete({ where: { id } });
  }

  async addAnnotation(
    userId: string,
    workspaceId: string,
    input: AnnotationInput,
  ): Promise<Annotation> {
    await this.assertCanWrite(userId, workspaceId);
    const annotation = await this.prisma.annotation.create({
      data: {
        workspaceId,
        createdById: userId,
        kind: input.kind,
        label: input.label,
        color: input.color,
        coordinates: input.coordinates as unknown as Prisma.InputJsonValue,
        radiusM: input.radiusM ?? null,
        notes: input.notes ?? null,
      },
    });
    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { updatedAt: new Date() },
    });
    return toAnnotation(annotation);
  }

  async removeAnnotation(userId: string, workspaceId: string, annotationId: string): Promise<void> {
    await this.assertCanWrite(userId, workspaceId);
    const annotation = await this.prisma.annotation.findFirst({
      where: { id: annotationId, workspaceId },
    });
    if (!annotation) throw AppException.notFound('Annotation not found');
    await this.prisma.annotation.delete({ where: { id: annotationId } });
  }

  async addMember(
    userId: string,
    workspaceId: string,
    email: string,
    role: WorkspaceRole,
  ): Promise<WorkspaceMember[]> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    });
    if (!workspace) throw AppException.notFound('Workspace not found');
    if (workspace.ownerId !== userId)
      throw AppException.forbidden('Only the owner can manage members');

    const invitee = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!invitee) throw AppException.notFound('No user with that email address');

    await this.prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId, userId: invitee.id } },
      create: { workspaceId, userId: invitee.id, role, invitedById: userId },
      update: { role },
    });

    const updated = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      include: WORKSPACE_INCLUDE,
    });
    return toWorkspace(updated).members;
  }

  async removeMember(userId: string, workspaceId: string, memberUserId: string): Promise<void> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    });
    if (!workspace) throw AppException.notFound('Workspace not found');
    if (workspace.ownerId !== userId)
      throw AppException.forbidden('Only the owner can manage members');
    if (memberUserId === workspace.ownerId)
      throw AppException.conflict('The owner cannot be removed');
    await this.prisma.workspaceMember.deleteMany({ where: { workspaceId, userId: memberUserId } });
  }

  /** Issue (or rotate) the share slug used for team/public links. */
  async share(
    userId: string,
    workspaceId: string,
    visibility: 'team' | 'public',
  ): Promise<{ shareSlug: string }> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    });
    if (!workspace) throw AppException.notFound('Workspace not found');
    if (workspace.ownerId !== userId)
      throw AppException.forbidden('Only the owner can share a workspace');

    const shareSlug = randomToken(12);
    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { shareSlug, visibility },
    });
    return { shareSlug };
  }

  private assertCanRead(workspace: WorkspaceWithRelations, userId: string | null): void {
    if (workspace.visibility === 'public') return;
    if (!userId) throw AppException.unauthorised();
    if (workspace.ownerId === userId) return;
    if (workspace.members.some((member) => member.userId === userId)) return;
    throw AppException.forbidden('You do not have access to this workspace');
  }

  private async assertCanWrite(userId: string, workspaceId: string): Promise<void> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true, members: { where: { userId }, select: { role: true } } },
    });
    if (!workspace) throw AppException.notFound('Workspace not found');
    if (workspace.ownerId === userId) return;
    const role = workspace.members[0]?.role;
    if (role === 'editor' || role === 'owner') return;
    throw AppException.forbidden('You need editor access to change this workspace');
  }
}

function toWorkspace(workspace: WorkspaceWithRelations): Workspace {
  return {
    id: workspace.id,
    ownerId: workspace.ownerId,
    name: workspace.name,
    description: workspace.description,
    view: workspace.view as unknown as ViewState,
    layers: workspace.layers,
    annotations: workspace.annotations.map(toAnnotation),
    members: workspace.members.map((member) => ({
      userId: member.userId,
      name: member.user.name,
      avatarUrl: member.user.avatarUrl,
      role: member.role,
    })),
    visibility: workspace.visibility,
    updatedAt: workspace.updatedAt.toISOString(),
    createdAt: workspace.createdAt.toISOString(),
  };
}

function toAnnotation(annotation: AnnotationRow): Annotation {
  return {
    id: annotation.id,
    kind: annotation.kind,
    label: annotation.label,
    color: annotation.color,
    coordinates: (annotation.coordinates ?? []) as unknown as LngLat[],
    radiusM: annotation.radiusM ?? undefined,
    notes: annotation.notes ?? undefined,
    createdBy: annotation.createdById,
    createdAt: annotation.createdAt.toISOString(),
  };
}
