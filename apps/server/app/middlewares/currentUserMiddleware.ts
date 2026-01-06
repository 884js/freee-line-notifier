import { LineApi } from "@freee-line-notifier/external-api/line";
import { getPrisma } from "@freee-line-notifier/prisma";
import { createMiddlewareWithEnv } from "../lib/hono/createMiddlewareWithEnv";

export const currentUserMiddleware = createMiddlewareWithEnv(
  async (c, next) => {
    console.log("currentUserMiddleware: started, path:", c.req.path);
    const { DATABASE_URL } = c.env;
    const accessToken = c.get("accessToken");
    console.log("currentUserMiddleware: accessToken exists:", !!accessToken);
    const prisma = getPrisma(DATABASE_URL);

    const lineApi = new LineApi({ accessToken });

    const { userId: lineUserId } = await lineApi.getProfile();
    console.log("currentUserMiddleware: lineUserId:", lineUserId);

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

    console.log("currentUserMiddleware: user found, setting currentUser");
    c.set("currentUser", user);

    await next();
  },
);
