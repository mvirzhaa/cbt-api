const blacklistedUsers = new Map();

const addUserToBlacklist = (userId) => {
    blacklistedUsers.set(String(userId), Date.now());
    console.log(`[Blacklist] User ${userId} ditambahkan ke blacklist CBT`);
};

const isUserBlacklisted = (userId) => {
    return blacklistedUsers.has(String(userId));
};

const removeUserFromBlacklist = (userId) => {
    blacklistedUsers.delete(String(userId));
    console.log(`[Blacklist] User ${userId} dihapus dari blacklist CBT`);
};

module.exports = { addUserToBlacklist, isUserBlacklisted, removeUserFromBlacklist };