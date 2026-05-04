import prisma from '../utils/database';
import { hashPassword, comparePassword, generateTokenPair } from '../utils/auth';
import { UnauthorizedError, ConflictError, NotFoundError } from '../utils/errors';
import logger from '../utils/logger';

export const authService = {
  async register(data: { name: string; email: string; password: string; organizationName?: string }) {
   const existingUser = await prisma.user.findUnique({
  where: { email: data.email },
});

if (existingUser && existingUser.password && existingUser.password !== '') {
  throw new ConflictError('Email already registered');
}

const hashedPassword = await hashPassword(data.password);

if (existingUser && (!existingUser.password || existingUser.password === '')) {
  const user = await prisma.user.update({
    where: { email: data.email },
    data: {
      name: data.name,
      password: hashedPassword,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      organizationId: true,
    },
  });
      const tokens = generateTokenPair({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      await prisma.session.create({
        data: {
          userId: user.id,
          token: tokens.refreshToken,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      logger.info(`User activated account: ${user.email}`);
      return { user, tokens };
    }

    let organization;
    if (data.organizationName) {
      organization = await prisma.organization.create({
        data: { name: data.organizationName },
      });
    }

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: organization ? 'ADMIN' : 'USER',
        organizationId: organization?.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organizationId: true,
      },
    });

    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    await prisma.session.create({
      data: {
        userId: user.id,
        token: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    logger.info(`User registered: ${user.email}`);
    return { user, tokens };
  },

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const isValidPassword = await comparePassword(password, user.password);

    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    await prisma.session.create({
      data: {
        userId: user.id,
        token: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    });

    logger.info(`User logged in: ${user.email}`);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      },
      tokens,
    };
  },

  async logout(userId: string, token: string) {
    await prisma.session.deleteMany({
      where: {
        userId,
        token,
      },
    });

    logger.info(`User logged out: ${userId}`);
  },

  async refreshToken(oldRefreshToken: string) {
    const session = await prisma.session.findUnique({
      where: { token: oldRefreshToken },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true, role: true },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const tokens = generateTokenPair({
      userId: session.userId,
      email: user.email,
      role: user.role,
    });

    await prisma.session.update({
      where: { id: session.id },
      data: {
        token: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return tokens;
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    const isValidPassword = await comparePassword(currentPassword, user.password);
    if (!isValidPassword) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    const hashedPassword = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    logger.info(`Password changed for user: ${user.email}`);
  },
};
