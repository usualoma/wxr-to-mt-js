const path = require("path");
const CleanWebpackPlugin = require("clean-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");

module.exports = async function(_, env) {
  const isProd = env.mode === "production";

  return {
    mode: isProd ? "production" : "development",
    devtool: isProd ? "source-map" : "inline-source-map",
    context: path.join(__dirname, "src"),
    entry: {
      app: "./app.ts",
      libs: "./libs.ts",
    },
    output: {
      path: path.join(__dirname, "docs", "dist"),
      publicPath: "dist",
    },
    resolve: {
      extensions: [".ts", ".js", ".tsx", ".json"],
    },
    module: {
      rules: [
        {
          test: /\.[jt]sx?$/,
          exclude: /node_modules/,
          use: "babel-loader",
        },
        {
          test: /\.scss$/,
          use: [
            { loader: "style-loader", options: { sourceMap: isProd } },
            { loader: "css-loader", options: { sourceMap: isProd } },
            { loader: "postcss-loader", options: { sourceMap: isProd } },
          ],
        },
      ],
    },
    plugins: [new CleanWebpackPlugin()],
    optimization: {
      minimizer: [
        new TerserPlugin({
          cache: true,
          parallel: true,
          sourceMap: true,
          terserOptions: {
            compress: {
              drop_console: true,
            },
          },
        }),
      ],
    },
    devServer: {
      contentBase: "docs",
      watchContentBase: true,
      overlay: true,
    },
  };
};
