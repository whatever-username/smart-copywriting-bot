const Markup = require('telegraf/markup');
const Scene = require("telegraf/scenes/base");
const Extra = require("telegraf/extra");
const db = require("../sqlite");
const bot = require("../bot");
const util = require("../util");
const axios = require('axios');
const cfg = require("../config");
const XLSX = require('xlsx');
const fs = require('fs');

module.exports = {
    adminScene: function () {
        const backKB = Markup.keyboard([["Добавить пост"], ["Статистика"], ["Выгрузка"], ["Назад"]]).resize().extra();
        const scene = new Scene("AdminScene");
        scene.on("callback_query", async (ctx) => {
            let callbackData = ctx.update.callback_query.data;

            ctx.answerCbQuery()
        })
        scene.enter(async (ctx) => {
            codes = (await db.getCodes()).map(s => s.id);
            if (codes.length != 0) {
                await ctx.reply("В следующем сообщении список кодовых слов");
                let codesMessage = "";
                for (let i = 0; i < codes.length; i++) {
                    codesMessage += codes[i];
                    if (i !== codes.length - 1) {
                        codesMessage += "\n";
                    }
                }
                ctx.reply(codesMessage)
            }
            ctx.reply("Команды для редактирования:\n\n" +
                "/add <значение1> <значение2> <значение3>\n" +
                "/delete <значение1> <значение2> <значение3>\n", backKB)
        })
        scene.hears("Добавить пост", async (ctx) => {
            ctx.scene.enter("adminPostCreation");
        })
        scene.hears("Статистика", async ctx => {
            let codes = await db.getCodes();
            let res = "";
            codes.forEach(s => res += (s.id + " - " + s.usages + "\n"));
            await ctx.reply(res)
        })
        scene.hears("Выгрузка", async ctx => {
            try {
                let data = [['id', 'firstname', 'lastname', 'username', 'start', 'code', "code entered at"]];
                (await db.getExportStats()).forEach(it => {
                    let row = Object.keys(it).map(key => {
                        return it[key]
                    })
                    data.push(row)
                });
                const ws = XLSX.utils.aoa_to_sheet(data);

                const wb = XLSX.utils.book_new();
                await XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
                await XLSX.writeFile(wb, `${__dirname}/output.xlsx`);
                await ctx.replyWithDocument({source: `${__dirname}/output.xlsx`})
                fs.unlinkSync(`${__dirname}/output.xlsx`);
            } catch (e) {
                await ctx.reply("Ошибка " + e)

            }

        })
        scene.hears("Назад", async ctx => {
            await ctx.scene.leave();
            await bot.onStartLogic(ctx)
        })
        scene.command("add", async ctx => {
            let splitted = ctx.update.message.text.split(" ");
            let args = splitted.slice(1, splitted.length)
            for (const value of args) {
                await db.addCode(value);
            }
            let newCodes = (await db.getCodes()).map(s => s.id);
            bot.codes = newCodes;
            let codesStr = "";
            newCodes.forEach(value => codesStr += (value + "\n"));
            ctx.reply("Обновленный список кодов:\n" +
                codesStr)
        });
        scene.command("delete", async ctx => {
            let splitted = ctx.update.message.text.split(" ");
            let args = splitted.slice(1, splitted.length)
            for (const value of args) {
                await db.deleteCode(value);
            }
            let newCodes = (await db.getCodes()).map(s => s.id);
            bot.codes = newCodes;
            let codesStr = "";
            newCodes.forEach(value => codesStr += (value + "\n"));
            ctx.reply("Обновленный список кодов:\n" +
                codesStr)
        });
        scene.command("check", async ctx => {
            let splitted = ctx.update.message.text.split(" ");
            let args = splitted.slice(1, splitted.length)
            let subscribed
            try {
                subscribed = await checkSubscription(args[0])
            } catch (e) {
                ctx.reply("Ошибка: " + e.text)
            }
            ctx.reply("Subscribed: " + subscribed)
        });
        return scene;
    },
    adminPostCreationScene: function () {
        const scene = new Scene("adminPostCreation");

        const mainKeyboard = Markup
            .keyboard([
                    ["Проверить"],
                    ["Назад"],
                ]
            )
            .resize()
            .extra();
        scene.enter(async (ctx) => {
            await ctx.reply('Добавить пост', mainKeyboard)
            await ctx.reply('Введите текст поста и добавьте картинки (по необходимости)')
            ctx.session.addPostScene = {
                photos: [],
                text: ""
            };

        });
        scene.leave((ctx) => {
            delete ctx.session.addPostScene
        });
        scene.on('message', async (ctx) => {
            let mes = ctx.message.text;
            if (mes === "Назад") {
                ctx.scene.enter("AdminScene");
                try {
                    delete ctx.session.addPostScene.timeInput
                } catch (e) {

                }
                return;
            }
            if (ctx.session.addPostScene.timeInput) {
                let inputTime;
                if (mes === 'now') {
                    inputTime = new Date();
                } else {
                    try {
                        inputTime = new Date(mes);
                    } catch (e) {
                        ctx.reply("Произошла какая-то ошибка. Попробуйте заново");
                    }
                }
                let postText = ctx.session.addPostScene.text;
                if (postText.length && postText.charAt(postText.length - 1) === "\n") {
                    ctx.session.addPostScene.text = postText.substring(0, postText.length - 1);
                }
                try {
                    db.addPost(
                        ctx.session.addPostScene.text,
                        ctx.session.addPostScene.photos,
                        inputTime);
                } catch (e) {
                    console.error(e)
                }
                ctx.reply('Пост успешно создан. Будет отправлен ' + inputTime.toLocaleString());
                delete ctx.session.addPostScene;
                ctx.scene.leave()
                return;
            }
            if (mes === "Проверить") {
                if (ctx.session.addPostScene.photos.length || ctx.session.addPostScene.text) {
                    if (ctx.session.addPostScene.photos.length) {
                        let mediaGroup = util.buildMediaGroupArrayString(ctx.session.addPostScene.photos, ctx.session.addPostScene.text)
                        await ctx.telegram.sendMediaGroup(ctx.chat.id, mediaGroup)
                    } else {
                        await ctx.telegram.sendMessage(ctx.chat.id, ctx.session.addPostScene.text)
                    }
                    await ctx.reply("Продолжить?", Markup
                        .inlineKeyboard([
                            [Markup.callbackButton('Да', 'proceed')],
                            [Markup.callbackButton('Заново', 'restart')],
                        ]).resize()
                        .extra())
                }
                return;
            }
            let photo
            let text;
            if (ctx.message.photo) {
                photo = ctx.message.photo ? ctx.message.photo[0].file_id : null;
            }
            text = ctx.message.text ? ctx.message.text : ctx.message.caption;
            photo ? ctx.session.addPostScene.photos.push(photo) : null;
            if (text) {
                ctx.session.addPostScene.text = ctx.session.addPostScene.text.concat(text + "\n")
            }
            // ctx.telegram.getFileLink(fileId)
            // ctx.from.id
        })
        scene.on('callback_query', async (ctx) => {
            let callbackData = ctx.update.callback_query.data;
            if (callbackData === "proceed") {
                if (ctx.session.addPostScene) {
                    ctx.deleteMessage();
                    ctx.session.addPostScene.timeInput = true;
                    let dateStr = new Date().toLocaleString();
                    dateStr = dateStr.substring(0, dateStr.length - 3);
                    ctx.reply("Отправьте дату отправки в формате \"" + dateStr + "\". Если нужно запостить сейчас - \"now\"")
                }
            } else if (callbackData === "restart") {
                ctx.deleteMessage();
                await ctx.reply("Пост обнулён")
                ctx.scene.enter("adminPostCreation")

            }
            ctx.answerCbQuery();
        })
        return scene;
    },
};


async function checkSubscription(userId) {
    let link = '@' + cfg.channel_username;
    let url = 'https://api.telegram.org/bot' + cfg.bot_token + '/getChatMember?user_id=' + userId + '&chat_id=' + link;
    let response;
    try {
        response = await axios.get(url)
    } catch (e) {
        throw e
    }
    let statuses = ['creator', 'administrator', 'member', 'restricted', 'kicked'];
    let res = false;
    if (statuses.indexOf(response.data.result.status) !== -1) {
        res = true;
    }
    return res
}
