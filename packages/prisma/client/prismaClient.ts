import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaClient } from "../output/edge";

export const getPrisma = (d1: any) => {
  const adapter = new PrismaD1(d1);
  const prisma = new PrismaClient({ adapter });
  return prisma;
};
