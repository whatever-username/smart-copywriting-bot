const {Markup} = require("telegraf");
const {Telegraf} = require('telegraf')
const axios = require('axios')
const fs = require('fs')
const session = require("telegraf/session");
const Scene = require("telegraf/scenes/base");
const Stage = require("telegraf/stage");
const db = require("./sqlite");
const util = require("./util");
const scenes = require('./scenes');
const schedule = require('node-schedule');
const cfg = require("./config")

const token = cfg.bot_token;
const adminIds = cfg.admins
var codes;
process.on('exit', () => {
    adminIds.forEach(id => {
        try {
            axios.post(`https://api.telegram.org/bot${token}/sendMessage`, null, {
                params: {
                    chatid: id, text: "Лёг"
                }
            })
        } catch (e) {
            console.error(`Failed to send message onExit for chat ${id}: ${e}`)
        }
    })

});

adminIds.forEach(id => {
    try {
        axios.post(`https://api.telegram.org/bot${token}/sendMessage`, null, {
            params: {
                chat_id: id, text: "Встал"
            }
        })
    } catch (e) {
        console.error(`Failed to send message onStart for chat ${id}: ${e}`)
    }

})
const bot = new Telegraf(token)
let fileCache = {}
var stage = new Stage(scenes.scenes)
bot.use(session())
bot.use(stage.middleware());
bot.use(async (ctx, next) => {
    await checkUser(ctx);
    return next()
})
bot.start(async (ctx) => {
    await onStartLogic(ctx)
})

const checkPosts = schedule.scheduleJob('5 * * * * *', async function () {

    let postsIds = await db.getPostsIdsToPost();
    if (postsIds && postsIds.length) {

        let usersIds = await db.getUsersIds({});
        usersIds = usersIds.map(userId => userId.id);

        postsIds = postsIds.map(postsId => postsId.id);
        await sendPosts(usersIds, postsIds)
    }

});
bot.hears("Панель администратора", (ctx) => {
    if (adminIds.includes(ctx.from.id)) {
        ctx.scene.enter("AdminScene")
    }
})
bot.hears("Назад", async (ctx) => {
    if (adminIds.includes(ctx.from.id)) {
        await onStartLogic(ctx)
    }
})
bot.on("callback_query", async ctx => {
    let callbackData = ctx.update.callback_query.data;
    if (callbackData === "checkSubscription") {
        let isSubscribed = await ((ctx.session.isSubscribed == null || ctx.session.isSubscribed === false) ? await checkSubscription(ctx) : ctx.session.isSubscribed);
        if (!isSubscribed) {
            await ctx.answerCbQuery("Вы не подписаны на канал", true)
        } else {
            await onStartLogic(ctx)
        }
        ctx.answerCbQuery();
    }
})
bot.on("message", async ctx => {
    let update = ctx.update;
    let user = ctx.from;
    let text = update.message.text;
    codes = await db.getCodes();
    codes = codes.map(s => s.id);
    if (codes.includes(text)) {
        let isSubscribed = (ctx.session.isSubscribed == null || ctx.session.isSubscribed === false) ? await checkSubscription(ctx) : ctx.session.isSubscribed;
        if (isSubscribed) {
            let repText = cfg.message_text
            await ctx.replyWithHTML(repText, {disable_web_page_preview: true})
            await handleFilesSending(ctx)
            await db.incUsage(text, user.id);
        } else {
            await onStartLogic(ctx)
        }
    } else {
        await ctx.reply("Кодовое слово неправильное. Пожалуйста, введите корректное кодовое слово")
    }
})
bot.launch()
exports.onStartLogic = onStartLogic;
exports.codes = codes;

async function onStartLogic(ctx) {
    let isSubscribed = await ((ctx.session.isSubscribed == null || ctx.session.isSubscribed === false) ? checkSubscription(ctx) : ctx.session.isSubscribed);
    let keyboard = getAdminKeyboard(ctx.from);
    if (isSubscribed) {
        keyboard == null ? ctx.reply("Введите кодовое слово") : ctx.reply("Введите кодовое слово", keyboard);
    } else {
        let text = "Вы не подписаны на канал"
        let inlineKB = Markup.inlineKeyboard([[Markup.urlButton("Ссылка на канал", `https://t.me/${cfg.channel_username}`)], [Markup.callbackButton("Проверить подписку", "checkSubscription")]]).resize().extra()
        if (keyboard == null) {
            ctx.reply(text, inlineKB)
        } else {
            ctx.reply(text, inlineKB)
            ctx.reply("Панель администратора в трее", keyboard);
        }

    }
}

function getAdminKeyboard(user) {
    if (adminIds.includes(user.id)) {
        return Markup.keyboard([["Панель администратора"]]).resize().extra()
    }
    return null;

}

async function handleFilesSending(ctx) {
    let filesDir = __dirname + "/files"
    fs.readdir(filesDir, (error, files) => {
        if (error) {
            massSendToAdmins('Ошибка чтения директории:' + error);
            return;
        }
        let filenames = []
        files.forEach((file) => {
            filenames.push(file)
        });
        files.forEach(async file => {
            try {
                if (file.toLowerCase().endsWith(".jpg") || file.toLowerCase().endsWith(".png") || file.toLowerCase().endsWith(".jpeg")) {
                    if (!fileCache[file]) {
                        let res = await ctx.replyWithPhoto({source: `${filesDir}/${file}`})
                        fileCache[file] = res.photo[0].file_id
                    } else {
                        await ctx.replyWithPhoto(fileCache[file])
                    }
                } else if (file.toLowerCase().endsWith(".mp4")) {
                    if (!fileCache[file]) {
                        let res = await ctx.replyWithVideo({source: `${filesDir}/${file}`})
                        fileCache[file] = res.video.file_id
                    } else {
                        await ctx.replyWithVideo(fileCache[file])
                    }

                } else {
                    if (!fileCache[file]) {
                        let res = await ctx.replyWithDocument({source: `${filesDir}/${file}`})
                        fileCache[file] = res.document.file_id
                    } else {
                        await ctx.replyWithDocument(fileCache[file])
                    }
                }
            } catch (e) {
                await massSendToAdmins("Ошибка при отправке документа:" + e)
            }
        })
    });

}

async function checkSubscription(ctx) {
    let userId = ctx.from.id;
    let link = '@' + cfg.channel_username;
    let url = 'https://api.telegram.org/bot' + token + '/getChatMember?user_id=' + userId + '&chat_id=' + link;
    try {
        response = await axios.get(url)
    } catch (e) {
        return;
    }
    let statuses = ['creator', 'administrator', 'member', 'restricted', 'kicked'];
    let res = false;
    if (statuses.indexOf(response.data.result.status) !== -1) {
        res = true;
    }
    ctx.session.isSubscribed = res;
    return res
}

async function checkUser(ctx) {
    try {
        const fieldNames = ["first_name", "last_name", "username", "language_code"]
        let newUser;
        try {
            newUser = !ctx.from ? ctx.message.from : ctx.from;
        } catch (e) {
            console.log(e);
        }
        let oldUser = ctx.session ? ctx.session.user : undefined;
        if (!oldUser) {
            oldUser = await db.getUserById(newUser.id);
            if (!oldUser) {
                await db.saveUser(newUser)
                ctx.session.user = oldUser;
                return;
            }
            ctx.session.user = oldUser;
        }
        let fieldsToUpdate = {};
        fieldNames.forEach(key => {
            if (oldUser[key] != newUser[key]) {
                    fieldsToUpdate[key] = newUser[key];
                    if (newUser[key]) {
                        oldUser[key] = newUser[key];
                    } else {
                        delete oldUser[key];
                    }
                }
        });
        ctx.session.user = oldUser;
        if (Object.keys(fieldsToUpdate).length > 0) {
            await db.updateUser(newUser.id, fieldsToUpdate);
        }
    } catch (ex) {
        console.log(ex);
        if (ctx && ctx.session) ctx.session.user = ctx.from;
    }

}

async function sendPosts(usersIds, postsIds) {
    let posts = await db.getPostsByIds(postsIds)
    for (let i = 0; i < posts.length; i++) {
        let post = posts[i]
        await db.deletePostsByIds([post.id])
        if (post.photos) {
            let mediaGroup = util.buildMediaGroupArrayString(post.photos, post.text)
            for (let j = 0; j < usersIds.length; j++) {
                let userId = usersIds[j];
                console.log(("mass mes send user #" + j))
                try {
                    await bot.telegram.sendMediaGroup(userId, mediaGroup)
                } catch (e) {
                    console.log(e.message)
                }
            }

        } else {
            for (let j = 0; j < usersIds.length; j++) {
                let userId = usersIds[j];
                console.log(("mass mes send user #" + j))
                try {
                    await bot.telegram.sendMessage(userId, post.text)
                } catch (e) {
                    console.log(e.message)
                    if (e.code == 403) {
                        //todo rework
                        db.updateUser(userId, {isBlocked: true})
                    }
                }
            }
        }
    }
    return;
}

async function massSendToAdmins(text) {
    cfg.admins.forEach(admin => {
        bot.telegram.sendMessage(admin, text)
    })
}

