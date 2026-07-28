export type SettingsActionState = {
  fieldErrors?: Partial<Record<string, string[]>>;
  message?: string;
};

export const initialSettingsActionState: SettingsActionState = {};
