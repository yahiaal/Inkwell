module.exports = {
  apps: [
    {
      name: "inkwell-ui",
      script: "npx",
      args: "serve -s dist -l 4173",
      cwd: "C:/Users/Thinkpad/Desktop/Course Player/client",
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
