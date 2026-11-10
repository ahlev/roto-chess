import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// The engine's sources import siblings as "./x.js" (NodeNext style); teach webpack to find the .ts.
Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    extensionAlias: { ...config.resolve?.extensionAlias, ".js": [".ts", ".tsx", ".js"] },
  },
}));
