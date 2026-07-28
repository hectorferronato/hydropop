import { readFileSync, readdirSync } from "node:fs";
import { basename, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = resolve(process.cwd(), "supabase", "migrations");
const deployedMigrationName =
  "20260728120000_add_atomic_hydration_event_processor.sql";
const fixMigrationName =
  "20260728121000_fix_hydration_processor_conditional_expressions.sql";
const deployedMigration = readFileSync(
  resolve(migrationsDirectory, deployedMigrationName),
  "utf8",
);
const fixMigration = readFileSync(
  resolve(migrationsDirectory, fixMigrationName),
  "utf8",
);
const schemaQualifiedConditionalExpression =
  /\b[a-z_][a-z0-9_$]*\.(?:coalesce|nullif|greatest|least)\s*\(/giu;

function extractFunctionDefinition(migration: string): string {
  const start = migration.indexOf(
    "create or replace function public.process_hydration_event(",
  );
  const end = migration.indexOf("\n$$;", start);

  if (start === -1 || end === -1) {
    throw new Error("Hydration processor definition not found");
  }

  return migration.slice(start, end + "\n$$;".length);
}

function extractIdentityArguments(migration: string): string {
  const match =
    /create or replace function public\.process_hydration_event\(([\s\S]*?)\)\s*returns jsonb/iu.exec(
      migration,
    );

  if (!match?.[1]) {
    throw new Error("Hydration processor signature not found");
  }

  return match[1].replace(/\s+/gu, " ").trim();
}

describe("hydration processor conditional-expression fix migration", () => {
  it("replaces only the invalid COALESCE qualification in the function definition", () => {
    const expectedDefinition = extractFunctionDefinition(
      deployedMigration,
    ).replace("pg_catalog.coalesce(", "coalesce(");

    expect(extractFunctionDefinition(fixMigration)).toBe(expectedDefinition);
  });

  it("keeps the exact deployed argument and return signature", () => {
    expect(extractIdentityArguments(fixMigration)).toBe(
      extractIdentityArguments(deployedMigration),
    );
    expect(fixMigration).toMatch(
      /\)\s*returns jsonb\s*language plpgsql\s*security invoker\s*set search_path = ''/u,
    );
  });

  it("does not introduce an overloaded processor function", () => {
    expect(
      fixMigration.match(
        /create or replace function public\.process_hydration_event\(/gu,
      ),
    ).toHaveLength(1);
    expect(fixMigration).not.toMatch(
      /\bdrop function\s+(?:if exists\s+)?public\.process_hydration_event/iu,
    );
  });

  it("rejects schema-qualified conditional expressions in the replacement", () => {
    expect(fixMigration.match(schemaQualifiedConditionalExpression)).toBeNull();
    expect(fixMigration).toContain("v_is_active_cycle := coalesce(");
  });

  it("records only the immutable historical occurrence in repository SQL", () => {
    const findings = readdirSync(migrationsDirectory)
      .filter((name) => name.endsWith(".sql"))
      .flatMap((name) => {
        const sql = readFileSync(resolve(migrationsDirectory, name), "utf8");
        const matches = sql.match(schemaQualifiedConditionalExpression) ?? [];

        return matches.map((expression) => ({
          expression,
          migration: basename(name),
        }));
      });

    expect(findings).toEqual([
      {
        expression: "pg_catalog.coalesce(",
        migration: deployedMigrationName,
      },
    ]);
  });

  it("preserves qualified objects, ownership, locks, and event behavior", () => {
    expect(fixMigration).toContain("v_user_id uuid := auth.uid();");
    expect(fixMigration).not.toMatch(/\bp_user_id\b/u);
    expect(fixMigration).toContain("public.bottles%rowtype");
    expect(fixMigration).toContain("public.hydration_events%rowtype");
    expect(fixMigration).toContain("from public.hydration_events");
    expect(fixMigration).toContain("from public.devices");
    expect(fixMigration).toContain("from public.profiles");
    expect(fixMigration).toContain("from public.hydration_goals");
    expect(fixMigration).toContain("pg_catalog.pg_advisory_xact_lock");
    expect(fixMigration).toContain(
      "hydration_events.idempotency_key = p_idempotency_key",
    );
    expect(fixMigration).toContain(
      "'bottle_capacity_ml', v_bottle.capacity_ml",
    );
    expect(fixMigration).toContain("'EVENT_ALREADY_REVERSED'");
  });

  it("reasserts the exact execution privileges", () => {
    expect(fixMigration).toMatch(
      /revoke execute on function public\.process_hydration_event\([\s\S]*?\) from public, anon;/u,
    );
    expect(fixMigration).toMatch(
      /grant execute on function public\.process_hydration_event\([\s\S]*?\) to authenticated;/u,
    );
    expect(fixMigration).not.toMatch(
      /grant execute on function public\.process_hydration_event\([\s\S]*?\) to (?:public|anon);/u,
    );
  });
});
