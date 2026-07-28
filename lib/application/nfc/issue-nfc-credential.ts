import { buildNfcUrl, generateNfcToken, hashNfcToken } from "./token-security";

type MutationFailure = {
  code: string;
};

type MutationResult<Data> = {
  data: Data | null;
  error: MutationFailure | null;
};

export type TokenHashMutation<Data> = (
  tokenHash: string,
) => Promise<MutationResult<Data>>;

export class NfcCredentialIssueError extends Error {
  readonly code: string;

  constructor(code: string) {
    super("Unable to issue NFC credentials.");
    this.code = code;
    this.name = "NfcCredentialIssueError";
  }
}

export async function issueNfcCredential<Data>({
  mutate,
  siteUrl,
}: {
  mutate: TokenHashMutation<Data>;
  siteUrl: string;
}): Promise<{ data: Data; nfcUrl: string; rawToken: string }> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const rawToken = generateNfcToken();
    const tokenHash = hashNfcToken(rawToken);
    const result = await mutate(tokenHash);

    if (result.data && !result.error) {
      return {
        data: result.data,
        nfcUrl: buildNfcUrl(siteUrl, rawToken),
        rawToken,
      };
    }

    if (result.error?.code !== "23505") {
      throw new NfcCredentialIssueError(result.error?.code ?? "EMPTY_RESULT");
    }
  }

  throw new NfcCredentialIssueError("TOKEN_COLLISION_RETRY_EXHAUSTED");
}
