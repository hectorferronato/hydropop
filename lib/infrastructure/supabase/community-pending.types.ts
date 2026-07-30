/**
 * Temporary type overlay for the local-only Community migration.
 *
 * Delete this file and use the regenerated Database types after the migration
 * is deployed to the linked project and `pnpm db:types` has been run.
 */
export type CommunityPendingDatabase = {
  public: {
    Functions: {
      check_community_username_availability: {
        Args: {
          p_username: string;
        };
        Returns: unknown;
      };
      get_community_member_summary: {
        Args: {
          p_username: string;
        };
        Returns: unknown;
      };
      get_my_community_profile: {
        Args: Record<never, never>;
        Returns: unknown;
      };
      list_community_member_summaries: {
        Args: {
          p_limit?: number;
          p_search?: string | null;
        };
        Returns: unknown;
      };
      save_community_profile: {
        Args: {
          p_is_visible: boolean;
          p_username: string;
        };
        Returns: unknown;
      };
    };
    Tables: Record<never, never>;
    Views: Record<never, never>;
  };
};
