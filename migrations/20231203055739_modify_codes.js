exports.up = function (knex) {
    return knex.schema.createTable('code_stats', function (table) {
        table.string('code').notNullable();
        table.bigInteger('user_id').notNullable();
        table.dateTime('created_at').defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists('code_stats');
};