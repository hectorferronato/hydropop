import { formatDisplayVolume, type VolumeUnit } from "@/lib/units/volume";

export function getCommunityInitials(displayName: string): string {
  const initials = displayName
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials || "HP";
}

export function formatCommunityVolume(
  volumeMl: number,
  unit: VolumeUnit,
): string {
  return `${formatDisplayVolume(volumeMl, unit)} ${unit}`;
}

export function getCommunityGoalPercentage(
  intakeMl: number,
  goalMl: number | null,
): number | null {
  return goalMl === null ? null : Math.round((intakeMl / goalMl) * 100);
}

export function filterCommunityMembers<
  Member extends { displayName: string; username: string },
>(members: readonly Member[], query: string): Member[] {
  const search = query.trim().toLowerCase();

  return members.filter(
    (member) =>
      member.displayName.toLowerCase().includes(search) ||
      member.username.toLowerCase().includes(search),
  );
}
