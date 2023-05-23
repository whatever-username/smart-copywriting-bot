const cfg = {
  "bot_token": "",
  "admins": [], // ex: [123, 32, 1234]
  "channel_username": "", // ex: "qweqweqwe"
  "message_text": "test" //ex: см. ниже
}
module.exports = cfg

/*
Пример сообщения:
"1) Шаблон контент-плана доступен по <a href ='https://docs.google.com/spreadsheets/..../edit?usp=sharing'>ссылке</a>\n\n" +
    "2) <a href='https://docs.google.com/spreadsheets/...../edit?usp=sharing'>Ссылка</a> на таблицу для создания сценария\n\n" +
    "<i>Она в режиме чтения, для ее использования вам нужно будет сделать копию у себя на диске.</i>\n\n" +
    "<a href='https://drive.google.com/file/..../view?usp=sharing'>Пример</a> заполненной таблицы для написания сценария"
*/
