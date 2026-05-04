import prisma from '../utils/database';
import { hashPassword } from '../utils/auth';
import { NotFoundError, ConflictError } from '../utils/errors';

export const userService = {
  async getAll(filters: { search?: string; department?: string; role?: string; page?: number; limit?: number }) {
    const where: any = {};

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.department) {
      where.department = filters.department;
    }

    if (filters.role) {
      where.role = filters.role;
    }

    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          department: true,
          avatar: true,
          createdAt: true,
          lastActiveAt: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total, page, limit };
  },

  async getById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        avatar: true,
        organizationId: true,
        createdAt: true,
        lastActiveAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  },

  async create(data: { name: string; email: string; department?: string; role?: string; organizationId?: string }) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictError('Email already exists');
    }

  const user = await prisma.user.create({
  data: {
    name: data.name,
    email: data.email,
    password: '',
        department: data.department,
        role: (data.role as any) || 'USER',
        organizationId: data.organizationId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        createdAt: true,
      },
    });

    return user;
  },

  async update(id: string, data: { name?: string; department?: string; avatar?: string }) {
    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        avatar: true,
      },
    });

    return user;
  },

  async delete(id: string) {
    await prisma.user.delete({
      where: { id },
    });
  },

  async bulkCreate(users: Array<{ name: string; email: string; department?: string }>, organizationId?: string) {
    const createdUsers = await prisma.$transaction(
  users.map((user) =>
    prisma.user.create({
      data: {
        name: user.name,
        email: user.email,
        password: '',
            department: user.department,
            organizationId,
          },
        })
      )
    );

    return createdUsers;
  },

  async getPerformance(id: string) {
    const campaigns = await prisma.campaignParticipant.findMany({
      where: { userId: id },
      include: {
        campaign: {
          select: {
            name: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalCampaigns = campaigns.length;
    const clickedCount = campaigns.filter((c: { isLinkClicked: boolean }) => c.isLinkClicked).length;
    const clickRate = totalCampaigns > 0 ? (clickedCount / totalCampaigns) * 100 : 0;

    const quizAttempts = await prisma.quizAttempt.findMany({
      where: { userId: id },
      orderBy: { completedAt: 'desc' },
    });

    const averageQuizScore =
      quizAttempts.length > 0
        ? quizAttempts.reduce((sum: number, attempt: { score: number }) => sum + attempt.score, 0) /
          quizAttempts.length
        : 0;

    return {
      totalCampaigns,
      clickRate,
      averageQuizScore,
      campaigns: campaigns.map((c: typeof campaigns[number]) => ({
        id: c.id,
        campaignName: c.campaign.name,
        dateSent: c.emailSentAt,
        emailOpened: c.isEmailOpened,
        linkClicked: c.isLinkClicked,
        quizScore: c.quizScore,
      })),
    };
  },
};
