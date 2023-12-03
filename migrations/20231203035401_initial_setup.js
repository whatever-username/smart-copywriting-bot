// 20211203123456_initial_setup.js
exports.up = function (knex) {
    return Promise.all([
        knex.schema.createTable('users', function (table) {
            table.increments('id').primary();
            table.string('first_name');
            table.string('last_name');
            table.string('username');
            table.string('language_code');
            table.integer('is_bot');
            table.integer('is_premium');
            table.integer('is_blocked');
            table.datetime('created_at').defaultTo(knex.fn.now());
        }),

        knex.schema.createTable('codes', function (table) {
            table.string('id').primary();
            table.integer('usages');
        }),

        knex.schema.createTable('posts', function (table) {
            table.increments('id').primary();
            table.string('date_time');
            table.text('photos');
            table.text('text');
        }),
    ]);
};

exports.down = function (knex) {
    return Promise.all([
        knex.schema.dropTableIfExists('users'),
        knex.schema.dropTableIfExists('codes'),
        knex.schema.dropTableIfExists('posts'),
    ]);
};
