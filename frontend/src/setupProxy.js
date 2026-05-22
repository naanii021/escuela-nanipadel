const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  const target = process.env.REACT_APP_API_PROXY_TARGET || process.env.REACT_APP_API_URL;

  if (!target) {
    console.log("Proxy API no configurado. Las llamadas /api usaran el mismo origen.");
    return;
  }

  app.use(
    "/api",
    createProxyMiddleware({
      target,
      changeOrigin: true,
      logLevel: "debug",
    })
  );
};
