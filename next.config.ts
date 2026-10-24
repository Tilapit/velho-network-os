import type { NextConfig } from "next";

const config: NextConfig = {
  // The data files are read at request time from ./data.
  serverExternalPackages: ["@anthropic-ai/sdk"],
  devIndicators: false,
};

export default config;
