module.exports = {
    apps: [
        {
            name: "inkwell-server",
            script: "node",
            args: "index.js",
            cwd: "./server",
            watch: false,
            env: {
                NODE_ENV: "production",
                PORT: 3001,
                DB_PATH: "../data/lms.db",
            },
        },
        {
            name: "inkwell-client",
            script: "npx",
            args: "serve -s dist -l 4173",
            cwd: "./client",
            watch: false,
            env: {
                NODE_ENV: "production",
            },
        },
    ],
};
