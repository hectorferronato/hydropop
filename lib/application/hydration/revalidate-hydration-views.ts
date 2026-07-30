import { revalidatePath } from "next/cache";

export const hydrationViewPaths = [
  "/today",
  "/calendar",
  "/trends",
  "/profile",
] as const;

export function revalidateHydrationViews(): void {
  hydrationViewPaths.forEach((path) => revalidatePath(path));
}
