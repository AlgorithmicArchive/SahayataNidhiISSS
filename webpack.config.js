const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");

module.exports = {
  entry: "./src/index.jsx",
  output: {
    path: path.resolve(__dirname, "wwwroot/js"),
    filename: "bundle.js",
    publicPath: "/swdjk/js",
    clean: true,
    sourceMapFilename: "[file].map", // Named source maps
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx|mjs)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env", "@babel/preset-react"],
            plugins: ["@babel/plugin-transform-runtime"],
          },
        },
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  resolve: {
    extensions: [".js", ".jsx", ".mjs"],
    fallback: {
      fs: false,
      url: require.resolve("url"),
      http: require.resolve("stream-http"),
      https: require.resolve("https-browserify"),
      assert: require.resolve("assert"),
      util: require.resolve("util"),
      path: require.resolve("path-browserify"),
    },
    alias: {
      "@mui/material": path.resolve(__dirname, "node_modules/@mui/material"),
      "react-router": path.resolve(__dirname, "node_modules/react-router"),
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
    },
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "wwwroot/index.html"),
      filename: "../index.html", // Output to wwwroot, not wwwroot/js
    }),
  ],
  mode: process.env.NODE_ENV || "development",
  devtool:
    process.env.NODE_ENV === "production"
      ? false
      : "eval-cheap-module-source-map",
  devServer: {
    static: {
      directory: path.resolve(__dirname, "wwwroot"),
    },
    compress: false,
    port: 5004,
    hot: true,
    allowedHosts: "all",
    client: {
      overlay: true,
    },
    historyApiFallback: false,
  },
};
