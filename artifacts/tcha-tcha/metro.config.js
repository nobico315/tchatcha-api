const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Allow all hosts to fix 403 errors when using Expo tunnel (exp.direct / ngrok)
config.server = {
  ...config.server,
  allowedHosts: "all",
};

module.exports = config;
