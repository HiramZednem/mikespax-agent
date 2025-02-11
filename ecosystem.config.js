module.exports = {
    apps: [
        {
            name: "mikespax-agent",
            script: "pnpm",
            args: "start",
            env_file: ".env",
            log_file: "/home/hiram/agents-logs/logs.log",
            max_size: "100M",
            time: true,
        },
    ],
};
