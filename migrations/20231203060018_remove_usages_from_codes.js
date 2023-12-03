
exports.up = function (knex) {
    return knex.schema.alterTable('codes', function (table) {
        table.dropColumn('usages');
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable('codes', function (table) {
        table.integer('usages');
    });
};
