import { LineApi } from "@freee-line-notifier/external-api/line";
import { getPrisma } from "@freee-line-notifier/prisma";
import { createMiddlewareWithEnv } from "../lib/hono/createMiddlewareWithEnv";

export const currentUserMiddleware = createMiddlewareWithEnv(
  async (c, next) => {
    const { DB } = c.env;
    const accessToken = c.get("accessToken");
    const prisma = getPrisma(DB);

    const lineApi = new LineApi({ accessToken });

    const { userId: lineUserId } = await lineApi.getProfile();

    const user = await prisma.user.findUniqueOrThrow({
      where: {
        lineUserId,
      },
      include: {
        companies: {
          select: {
            id: true,
            companyId: true,
            refreshToken: true,
          },
        },
      },
    });

    c.set("currentUser", user);

    await next();
  },
);
