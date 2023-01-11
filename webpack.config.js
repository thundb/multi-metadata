const path = require("path");

const baseUrl = (url) => path.resolve(__dirname, url);

module.exports = {
  mode: "production",
  entry: `${baseUrl("./src")}/index.js`,
  output: {
    path: baseUrl("./dist"),
    filename: "index.js",
    libraryTarget: "umd",
    globalObject: "this",
    library: "multiMetadata",
  },
  externals: {
    ethers: "ethers",
    web3: "web3",
    axios: "axios",
  },
};
