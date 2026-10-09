/** The commit this build was made from, stamped in by next.config.ts. "dev" outside a build. */
export const BUILD_ID = process.env.BUILD_ID ?? "dev";
