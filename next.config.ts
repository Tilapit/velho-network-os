import type { NextConfig } from "next";

const config: NextConfig = {
  // The data files are read at request time from ./data.
  serverExternalPackages: ["@anthropic-ai/sdk"],
};

export default config;
