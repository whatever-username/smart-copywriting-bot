const Markup = require('telegraf/markup');
const Scene = require("telegraf/scenes/base");
const Extra = require("telegraf/extra");
const adminScene = require("./scenes/adminScene");
module.exports = {

    scenes: [
        adminScene.adminScene(),
        adminScene.adminPostCreationScene()
    ]
}
