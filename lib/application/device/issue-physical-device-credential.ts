import {
  generatePhysicalDeviceToken,
  hashPhysicalDeviceToken,
} from "./token-security";

type MutationResult<Data> = {
  data: Data | null;
  error: { code: string } | null;
};

export class PhysicalDeviceCredentialIssueError extends Error {
  readonly code: string;

  constructor(code: string) {
    super("Unable to issue the physical-device credential.");
    this.code = code;
    this.name = "PhysicalDeviceCredentialIssueError";
  }
}

export async function issuePhysicalDeviceCredential<Data>({
  mutate,
}: {
  mutate: (credentialHash: string) => Promise<MutationResult<Data>>;
}): Promise<{ data: Data; rawToken: string }> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const rawToken = generatePhysicalDeviceToken();
    const result = await mutate(hashPhysicalDeviceToken(rawToken));

    if (result.data && !result.error) {
      return { data: result.data, rawToken };
    }

    if (result.error?.code !== "23505") {
      throw new PhysicalDeviceCredentialIssueError(
        result.error?.code ?? "EMPTY_RESULT",
      );
    }
  }

  throw new PhysicalDeviceCredentialIssueError(
    "TOKEN_COLLISION_RETRY_EXHAUSTED",
  );
}
