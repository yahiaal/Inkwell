module.exports = {
    apps: [
        {
            name: "inkwell-server",
            script: "npm",
            args: "run start",
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
            script: "npm",
            args: "run dev",
            cwd: "./client",
            watch: false,
            env: {
                NODE_ENV: "production",
            },
        },
    ],
};
