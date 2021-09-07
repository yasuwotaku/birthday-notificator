const path = require("path");
const GasPlugin = require("gas-webpack-plugin");

const mode =
  process.env.NODE_ENV === "development" ? "development" : "production";
const devtool = "inline-source-map";
const entry = {
  registrator: path.resolve("src", "registrator.ts"),
  notificator: path.resolve("src", "notificator.ts"),
};
const outPath = path.resolve("build");
const outFileName = "[name].js";
const output = {
  path: outPath,
  filename: outFileName,
};
const rules = [
  {
    test: /\.[tj]s$/,
    use: {
      loader: "ts-loader",
      options: {
        allowTsInNodeModules: true,
        transpileOnly: true,
        configFile: path.resolve("tsconfig.json"),
      },
    },
  },
];
const resolve = {
  extensions: [".ts", ".js", ".json"],
  fallback: {
    path: false,
    os: false
  },
};
const plugins = [new GasPlugin()];

module.exports = [
  {
    mode: "development",
    entry,
    output,
    module: { rules },
    resolve,
    plugins,
  },
];
