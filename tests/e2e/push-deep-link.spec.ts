import { expect, test } from "@playwright/test";
import { build } from "esbuild";

test.use({ serviceWorkers: "block" });
test("push chooser stays visible while the URL is cleaned without navigation or hydration writes", async ({
  page,
}) => {
  const bundle = await build({
    stdin: {
      contents: `import {createRoot} from 'react-dom/client';
      import {RecordWater} from './app/(private)/today/record-water';
      createRoot(document.getElementById('root')).render(<RecordWater bottleName="Test bottle" initiallyOpen normalFillMl={700} unit="ml"/>);`,
      loader: "tsx",
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [
      {
        name: "assert-no-navigation",
        setup(builder) {
          builder.onResolve({ filter: /^next\/navigation$/ }, () => ({
            path: "router",
            namespace: "test",
          }));
          builder.onLoad({ filter: /.*/, namespace: "test" }, () => ({
            contents:
              "export const useRouter = () => ({replace() { throw new Error('Unexpected server navigation'); }, refresh() {}});",
            loader: "js",
          }));
        },
      },
    ],
  });
  const errors: string[] = [];
  const writes: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.method() !== "GET") writes.push(request.url());
  });
  await page.route("**/__push-fixture?record=1&source=push", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><body><main id="root"></main><script>${bundle.outputFiles[0]!.text}</script></body></html>`,
    }),
  );
  await page.goto("/__push-fixture?record=1&source=push");
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(errors).toEqual([]);
  expect(writes).toEqual([]);
});
