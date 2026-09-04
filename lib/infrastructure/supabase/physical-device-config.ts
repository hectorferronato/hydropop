import { z } from "zod";

const physicalDeviceRpcConfigSchema = z.object({
  secret: z.string().regex(/^[0-9a-fA-F]{64}$/u),
});

export function getPhysicalDeviceRpcSecret(): string {
  const parsed = physicalDeviceRpcConfigSchema.safeParse({
    secret: process.env.PHYSICAL_DEVICE_RPC_SECRET,
  });

  if (!parsed.success) {
    throw new Error("Missing or invalid physical-device RPC configuration.");
  }

  return parsed.data.secret;
}
