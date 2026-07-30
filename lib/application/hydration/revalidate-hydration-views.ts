import { revalidatePath } from "next/cache";

export const hydrationViewPaths = [
  "/today",
  "/calendar",
  "/trends",
  "/profile",
  "/community",
] as const;

export function revalidateHydrationViews(): void {
  hydrationViewPaths.forEach((path) => revalidatePath(path));
  revalidatePath("/u/[username]", "page");
}
