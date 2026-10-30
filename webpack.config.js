const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");

module.exports = {
  entry: "./src/index.jsx",
  output: {
    path: path.resolve(__dirname, "wwwroot/js"),
    filename: "[name].js",
    chunkFilename: "[name].chunk.js",
    publicPath: "/js",
    clean: true,
    sourceMapFilename: "[file].map",
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
      // NOTE: This template/output pair is a legacy CRA-style artifact used only by the
      // webpack build to produce a standalone HTML file. The ASP.NET application does NOT
      // serve this file at runtime - the actual page is rendered from Views/Shared/_Layout.cshtml
      // via the MVC pipeline. Keep the template and output in src/ (NOT wwwroot/) to avoid
      // the HtmlWebpackPlugin reading its own previous output as the next input (which
      // caused the recursive script-tag pollution seen in wwwroot/index.html).
      template: path.resolve(__dirname, "src/index.html"),
      filename: "index.html",
      inject: "body",
    }),
  ],
  mode: process.env.NODE_ENV || "development",
  devtool:
    process.env.NODE_ENV === "production" ? "hidden-source-map" : "source-map",
  optimization: {
    minimize: process.env.NODE_ENV === "production",
    runtimeChunk: "single",
    splitChunks: {
      chunks: "all",
      maxInitialRequests: 10,
      cacheGroups: {
        // Isolate the heaviest, least-frequently-needed libs into their own
        // chunks so a normal user never downloads them unless a route
        // that actually uses them is visited.
        tensorflow: {
          test: /[\\/]node_modules[\\/](@tensorflow|face-api\.js)[\\/]/,
          name: "vendor-tensorflow",
          chunks: "async",
          priority: 30,
        },
        pdf: {
          test: /[\\/]node_modules[\\/](@react-pdf|react-pdf|pdfjs-dist|jspdf|jspdf-autotable)[\\/]/,
          name: "vendor-pdf",
          chunks: "all",
          priority: 25,
        },
        charts: {
          test: /[\\/]node_modules[\\/](apexcharts|react-apexcharts|chart\.js|react-chartjs-2|chartjs-plugin-datalabels|recharts)[\\/]/,
          name: "vendor-charts",
          chunks: "all",
          priority: 25,
        },
        mui: {
          test: /[\\/]node_modules[\\/]@mui[\\/]/,
          name: "vendor-mui",
          chunks: "all",
          priority: 20,
        },
        survey: {
          test: /[\\/]node_modules[\\/]survey-/,
          name: "vendor-survey",
          chunks: "all",
          priority: 20,
        },
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          chunks: "all",
          priority: 10,
        },
      },
    },
  },
  devServer: {
    static: {
      directory: path.resolve(__dirname, "wwwroot"),
    },
    compress: true,
    port: 5004,
    hot: true,
    allowedHosts: "all",
    client: {
      overlay: true,
    },
    historyApiFallback: false,
  },
};
