module.exports = {
  apps: [{
    name: "masternein",
    script: "./build/index.js",
    env: {
      NODE_ENV: "production",
      VITE_SOCKET_PORT: "39373",
    },
  }, {
    name: "masternein-socket",
    script: "./socket/socket.js",
    env: {
      NODE_ENV: "production",
      VITE_SOCKET_PORT: "39373",
    },
  }]
}