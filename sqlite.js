const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const databaseFile = './database.db';

if (!fs.existsSync(databaseFile)) {
  const db = new sqlite3.Database(databaseFile);
  db.serialize(() => {
    db.run(`
        CREATE TABLE users
        (
            id            INTEGER PRIMARY KEY,
            first_name    TEXT,
            last_name     TEXT,
            username      TEXT,
            language_code TEXT,
            is_bot        INTEGER,
            is_premium    INTEGER,
            is_blocked    INTEGER
        );
    `);
    db.run(`
        CREATE TABLE codes
        (
            id     TEXT PRIMARY KEY,
            usages INTEGER
        );
    `);
    db.run(`
        CREATE TABLE posts
        (
            id        INTEGER PRIMARY KEY,
            date_time TEXT,
            photos    TEXT,
            text      TEXT
        );
    `);
    db.close();
  });
}
const db = new sqlite3.Database(databaseFile, sqlite3.OPEN_READWRITE);



function getCodes() {
  return new Promise((resolve, reject) => {
    db.all("SELECT id, usages FROM codes", (error, rows) => {
      if (error) {
        reject(error);
      } else {
        resolve(rows);
      }
    });
  });
}

function addCode(name) {
  return new Promise((resolve, reject) => {
    const statement = db.prepare('INSERT INTO codes (id, usages) VALUES (?, ?)');
    const codesData = [
      {id: name, usages: 0},
    ];

    codesData.forEach(data => {
      statement.run(data.id, data.usages);
    });

    statement.finalize((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function deleteCode(code) {
  return new Promise((resolve, reject) => {
    const statement = db.prepare('DELETE FROM codes WHERE id = ?');

    statement.run(code, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });

    statement.finalize();
  });
}

function incUsage(name) {
  return new Promise((resolve, reject) => {
    const statement = db.prepare('UPDATE codes SET usages = usages + 1 WHERE id = ?');

    statement.run(name, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });

    statement.finalize();
  });
}

function getUserById(id) {
  const statement = db.prepare('SELECT * FROM users where id = ?');
  return new Promise((resolve, reject) => {
    statement.all(id, (error, rows) => {
      if (error) {
        reject(error);
      } else {
        resolve(rows.length ? rows[0] : null)
      }
    });
  });
}

function saveUser(user) {
  return new Promise((resolve, reject) => {
    const statement = db.prepare(
      'INSERT INTO users (id, first_name, last_name, username, language_code, is_bot, is_blocked) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    const {id, first_name, last_name, username, language_code, is_bot} = user;

    statement.run(id, first_name, last_name, username, language_code, is_bot === true ? 1 : 0, 0, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });

    statement.finalize();
  });
}

function updateUser(userId, update) {
  return new Promise((resolve, reject) => {
    let oldUser = getUserById(userId)
    const statement = db.prepare(
      'UPDATE users set first_name = ?, last_name = ? , username = ?, language_code = ? , is_bot = ? where id = ?'
    );
    var first_name = update['first_name'] ? update['first_name']: oldUser.first_name
    var last_name = update['last_name'] ? update['last_name']: oldUser.last_name
    var username = update['username'] ? update['username']: oldUser.username
    var language_code = update['language_code'] ? update['language_code']: oldUser.language_code
    var is_bot = update['is_bot'] ? update['is_bot']: oldUser.is_bot

    statement.run(first_name, last_name, username, language_code, is_bot === true ? 1 : 0, userId, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });

    statement.finalize();
  });
}

function addPost(text, photos, dateTime) {
  return new Promise((resolve, reject) => {
    const statement = db.prepare(
      'INSERT INTO posts (date_time, photos, text) ' +
      'VALUES (?, ?, ?)'
    );


    statement.run(dateToString(dateTime), fromArrayToString(photos), text, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });

    statement.finalize();
  });
}

function getPostsIdsToPost() {
  return new Promise((resolve, reject) => {
    const statement = db.prepare('SELECT id FROM posts where datetime(date_time) < datetime(?)');

    statement.all(dateToString(new Date()), (error, rows) => {
      if (error) {
        reject(error);
      } else {
        resolve(rows);
      }
    });
  });
}

function deletePostsByIds(ids) {
  return new Promise((resolve, reject) => {
    const statement = db.prepare('DELETE FROM posts WHERE id in (?)');

    statement.run(ids, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });

    statement.finalize();
  });
}

function getPostsByIds(ids) {
  return new Promise((resolve, reject) => {
    const statement = db.prepare('SELECT id, date_time, photos, text FROM posts WHERE id IN (' + Array(ids.length).fill('?').join(', ') + ')');
    statement.all(...ids, (error, rows) => {
      if (error) {
        reject(error);
      } else {
        resolve(rows.map(row => {
          row.date_time = new Date(row.date_time)
          row.photos = fromStringToArray(row.photos)
          return row
        }));
      }
    });

    statement.finalize();
  });
}

function getUsersIds(filter) {
  return new Promise((resolve, reject) => {
    const statement = db.prepare('SELECT id FROM users');
    statement.all( (error, rows) => {
      if (error) {
        reject(error);
      } else {
        resolve(rows);
      }
    });

    statement.finalize();
  });
}

function fromArrayToString(array) {
  if (array.length == 0){
    return null
  }
  return '[' + array.map(element => `'${element}'`).join(', ') + ']';
}

function fromStringToArray(string) {
  if (!string || string.length == 0) {
    return null
  }
  const trimmedString = string.replace(/\[|\]|'|\"|\s/g, '');
  const array = trimmedString.split(',');
  const trimmedArray = array.map(element => element.trim());
  return trimmedArray;
}

function dateToString(d) {
  return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" +
    ("0" + d.getDate()).slice(-2) + " " + ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2) + ":" + ("0" + d.getSeconds()).slice(-2);
}

module.exports = {
  getCodes,
  getUserById,
  getUsersIds,
  incUsage,
  deleteCode,
  deletePostsByIds,
  addPost,
  addCode,
  saveUser,
  updateUser,
  getPostsIdsToPost,
  getPostsByIds
}
