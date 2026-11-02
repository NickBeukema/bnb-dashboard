/** The commit this build was made from, stamped in by vite.config.ts. "dev" outside a build. */
export const BUILD_ID: string = import.meta.env.BUILD_ID ?? "dev";
