import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const repoName = process.env.VITE_REPO_NAME || "korean-ai-trainer";
const isGitHubActions = process.env.GITHUB_ACTIONS === "true";

export default defineConfig({
  base: isGitHubActions ? `/${repoName}/` : "/",
  plugins: [react()],
  server: {
    port: 5173
  }
});
