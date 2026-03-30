const { createProxyMiddleware } = require("http-proxy-middleware");

console.log("🚀 Proxy setup cargado");

module.exports = function (app) {
  app.use(
    "/api",
    createProxyMiddleware({
      target: "http://127.0.0.1:4000",
      changeOrigin: true,
      logLevel: "debug",
      // IMPORTANTÍSIMO: NO pathRewrite
    })
  );
};
