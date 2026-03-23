const { ObjectId } = require('mongodb');
const { getDatabase } = require('./database');

function nowIso() {
    return new Date().toISOString();
}

function normalizeLower(value) {
    if (!value) {
        return null;
    }

    return String(value).trim().toLowerCase();
}

function mapUserDoc(doc) {
    if (!doc) {
        return null;
    }

    return {
        id: String(doc._id),
        username: doc.username,
        email: doc.email || null,
        displayName: doc.displayName,
        avatarUrl: doc.avatarUrl || null,
        authSource: doc.authSource,
        status: doc.status,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        lastLogin: doc.lastLoginAt || null,
        lastLoginIp: doc.lastLoginIp || null
    };
}

function sanitizeUsernameCandidate(value) {
    const candidate = String(value || 'user')
        .trim()
        .replace(/[^\w-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    return candidate || 'user';
}

async function buildUniqueUsername(baseUsername) {
    const db = getDatabase();
    const users = db.collection('users');
    const base = sanitizeUsernameCandidate(baseUsername);

    let candidate = base;
    let suffix = 1;

    while (await users.findOne(
        { usernameLower: normalizeLower(candidate) },
        { projection: { _id: 1 } }
    )) {
        candidate = `${base}-${suffix}`;
        suffix += 1;
    }

    return candidate;
}

async function normalizeEmailForUser(email, excludeUserId = null) {
    if (!email) {
        return null;
    }

    const db = getDatabase();
    const users = db.collection('users');
    const query = { emailLower: normalizeLower(email) };

    if (excludeUserId) {
        query._id = { $ne: excludeUserId };
    }

    const existing = await users.findOne(query, { projection: { _id: 1 } });
    if (existing) {
        return null;
    }

    return email;
}

async function getUserById(userId) {
    const db = getDatabase();
    const users = db.collection('users');

    if (!ObjectId.isValid(String(userId))) {
        return null;
    }

    const doc = await users.findOne(
        { _id: new ObjectId(String(userId)) },
        {
            projection: {
                username: 1,
                email: 1,
                displayName: 1,
                avatarUrl: 1,
                authSource: 1,
                status: 1,
                createdAt: 1,
                updatedAt: 1,
                lastLoginAt: 1,
                lastLoginIp: 1
            }
        }
    );

    return mapUserDoc(doc);
}

async function upsertOAuthUser({
    provider,
    externalUserId,
    providerUsername,
    email,
    displayName,
    avatarUrl,
    accessToken,
    refreshToken,
    tokenInfo,
    profile,
    lastLoginIp
}) {
    const db = getDatabase();
    const users = db.collection('users');
    const identities = db.collection('user_identities');
    const now = nowIso();
    const safeDisplayName = displayName || providerUsername || 'User';
    const safeEmail = email || null;
    const safeEmailLower = normalizeLower(safeEmail);
    const safeAvatarUrl = avatarUrl || null;
    const safeProviderUsername = providerUsername || null;
    const safeProviderUsernameLower = normalizeLower(safeProviderUsername);
    const safeProfile = profile || {};
    const safeTokenInfo = tokenInfo || {};

    const identity = await identities.findOne(
        { provider, externalUserId: String(externalUserId) },
        { projection: { userId: 1 } }
    );

    let userId;

    if (identity) {
        userId = identity.userId;
        const userEmail = await normalizeEmailForUser(safeEmail, userId);

        await users.updateOne(
            { _id: userId },
            {
                $set: {
                    email: userEmail,
                    emailLower: normalizeLower(userEmail),
                    displayName: safeDisplayName,
                    avatarUrl: safeAvatarUrl,
                    updatedAt: now,
                    lastLoginAt: now,
                    lastLoginIp: lastLoginIp || null
                }
            }
        );

        await identities.updateOne(
            { provider, externalUserId: String(externalUserId) },
            {
                $set: {
                    providerUsername: safeProviderUsername,
                    providerUsernameLower: safeProviderUsernameLower,
                    email: safeEmail,
                    emailLower: safeEmailLower,
                    accessToken: accessToken || null,
                    refreshToken: refreshToken || null,
                    tokenExpiresIn: safeTokenInfo.expiresIn ?? null,
                    tokenExpiryTime: safeTokenInfo.expiryTime ?? null,
                    profile: safeProfile,
                    lastLoginAt: now,
                    updatedAt: now
                }
            }
        );
    } else {
        const existingUserByEmail = safeEmailLower
            ? await users.findOne(
                { emailLower: safeEmailLower },
                { projection: { _id: 1 } }
            )
            : null;

        if (existingUserByEmail) {
            userId = existingUserByEmail._id;
            const userEmail = await normalizeEmailForUser(safeEmail, userId);

            await users.updateOne(
                { _id: userId },
                {
                    $set: {
                        email: userEmail,
                        emailLower: normalizeLower(userEmail),
                        displayName: safeDisplayName,
                        avatarUrl: safeAvatarUrl,
                        updatedAt: now,
                        lastLoginAt: now,
                        lastLoginIp: lastLoginIp || null
                    }
                }
            );
        } else {
            const username = await buildUniqueUsername(
                providerUsername || displayName || `user-${externalUserId}`
            );
            const userEmail = await normalizeEmailForUser(safeEmail);

            const insertResult = await users.insertOne({
                username,
                usernameLower: normalizeLower(username),
                email: userEmail,
                emailLower: normalizeLower(userEmail),
                displayName: safeDisplayName,
                avatarUrl: safeAvatarUrl,
                authSource: provider,
                status: 'active',
                createdAt: now,
                updatedAt: now,
                lastLoginAt: now,
                lastLoginIp: lastLoginIp || null
            });

            userId = insertResult.insertedId;
        }

        await identities.insertOne({
            userId,
            provider,
            externalUserId: String(externalUserId),
            providerUsername: safeProviderUsername,
            providerUsernameLower: safeProviderUsernameLower,
            email: safeEmail,
            emailLower: safeEmailLower,
            accessToken: accessToken || null,
            refreshToken: refreshToken || null,
            tokenExpiresIn: safeTokenInfo.expiresIn ?? null,
            tokenExpiryTime: safeTokenInfo.expiryTime ?? null,
            profile: safeProfile,
            createdAt: now,
            updatedAt: now,
            lastLoginAt: now
        });
    }

    return getUserById(String(userId));
}

module.exports = {
    getUserById,
    upsertOAuthUser
};
