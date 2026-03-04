const logLevels = { DEBUG: 0, INFO: 1, ERROR: 2 };
const currentLevel = logLevels[process.env.LOG_LEVEL || 'INFO'];

function timestamp() {
    return new Date().toISOString();
}

module.exports = {
    debug: (msg, data = null) => {
        if (currentLevel <= logLevels.DEBUG) {
            console.log(`[${timestamp()}] [DEBUG] ${msg}`, data ? JSON.stringify(data, null, 2) : '');
        }
    },
    info: (msg, data = null) => {
        if (currentLevel <= logLevels.INFO) {
            console.log(`[${timestamp()}] [INFO] ${msg}`, data ? JSON.stringify(data, null, 2) : '');
        }
    },
    error: (msg, data = null) => {
        console.error(`[${timestamp()}] [ERROR] ${msg}`, data ? JSON.stringify(data, null, 2) : '');
    },
    section: (title) => {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`  ${title}`);
        console.log(`${'='.repeat(60)}\n`);
    }
};
