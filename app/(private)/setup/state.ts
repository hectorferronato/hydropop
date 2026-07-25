import type { SetupField } from "@/lib/contracts/setup";

export type SetupState = {
  fieldErrors?: Partial<Record<SetupField, string[]>>;
  message: string | null;
};

export const initialSetupState: SetupState = {
  message: null,
};
