const { MongoClient } = require('mongodb');

let client;
let database;
let databaseInfo;

function getMongoUri() {
    return process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
}

function getMongoDbName() {
    return process.env.MONGODB_DB_NAME || 'opengms_jupyter';
}

function maskMongoUri(uri) {
    return uri.replace(/\/\/([^/@]+)@/, '//***:***@');
}

async function initDatabase() {
    if (database) {
        return database;
    }

    const uri = getMongoUri();
    const dbName = getMongoDbName();

    client = new MongoClient(uri);
    await client.connect();
    database = client.db(dbName);

    await Promise.all([
        database.collection('users').createIndex(
            { usernameLower: 1 },
            { unique: true, name: 'uniq_users_username_lower' }
        ),
        database.collection('users').createIndex(
            { emailLower: 1 },
            {
                unique: true,
                partialFilterExpression: { emailLower: { $type: 'string' } },
                name: 'uniq_users_email_lower'
            }
        ),
        database.collection('users').createIndex(
            { status: 1 },
            { name: 'idx_users_status' }
        ),
        database.collection('user_identities').createIndex(
            { provider: 1, externalUserId: 1 },
            { unique: true, name: 'uniq_user_identities_provider_external' }
        ),
        database.collection('user_identities').createIndex(
            { userId: 1 },
            { name: 'idx_user_identities_user_id' }
        ),
        database.collection('user_identities').createIndex(
            { provider: 1, providerUsernameLower: 1 },
            {
                partialFilterExpression: { providerUsernameLower: { $type: 'string' } },
                name: 'idx_user_identities_provider_username_lower'
            }
        ),
        database.collection('user_credentials').createIndex(
            { userId: 1 },
            { unique: true, name: 'uniq_user_credentials_user_id' }
        )
    ]);

    databaseInfo = {
        uri: maskMongoUri(uri),
        dbName
    };

    return database;
}

function getDatabase() {
    if (!database) {
        throw new Error('MongoDB has not been initialized');
    }

    return database;
}

function getDatabaseInfo() {
    return databaseInfo || {
        uri: maskMongoUri(getMongoUri()),
        dbName: getMongoDbName()
    };
}

async function closeDatabase() {
    if (client) {
        await client.close();
    }

    client = null;
    database = null;
    databaseInfo = null;
}

module.exports = {
    closeDatabase,
    getDatabase,
    getDatabaseInfo,
    initDatabase
};
