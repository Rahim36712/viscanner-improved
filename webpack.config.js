const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require("webpack");

module.exports = {
  output: {
    path: path.join(__dirname, "/dist"), // the bundle output path
    filename: "bundle.[contenthash].js", // the name of the bundle
    clean: true,
  },
  // PDFKit is designed for Node as well as browsers. These fallbacks keep its
  // browser bundle focused on PDF generation and avoid pulling in Node-only
  // filesystem APIs.
  resolve: {
    alias: {
      // A legacy `stream` package is present transitively; PDFKit needs the
      // full browser-compatible Readable implementation instead.
      stream: require.resolve("stream-browserify"),
    },
    fallback: {
      fs: false,
      stream: require.resolve("stream-browserify"),
      zlib: require.resolve("browserify-zlib"),
    },
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ["buffer", "Buffer"],
      process: "process/browser",
    }),
    new HtmlWebpackPlugin({
      template: "src/index.html", // to import index.html file inside index.js
      favicon: "src/favicon.ico"
    })
  ],
  devServer: {
    port: 3030, // you can change the port
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/, // .js and .jsx files
        exclude: /node_modules/, // excluding the node_modules folder
        use: {
          loader: "babel-loader",
        },
      },
      {
        test: /\.(sa|sc|c)ss$/, // styles files
        use: ["style-loader", "css-loader", "sass-loader"],
      },
      {
        test: /\.(png|woff|woff2|eot|ttf|svg)$/, // to import images and fonts
        loader: "url-loader",
        options: { limit: false },
      },
    ],
  },
};
