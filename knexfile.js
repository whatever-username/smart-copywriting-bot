// knexfile.js
module.exports = {
    client: 'sqlite3',
    connection: {
        filename: './database.db',
    },
    useNullAsDefault: true,
    migrations: {
        tableName: 'knex_migrations',
        directory: './migrations',
    },
};
