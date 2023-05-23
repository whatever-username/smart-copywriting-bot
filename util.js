const axios = require('axios');
module.exports = {
  saveFile: function (fileUrl) {

    axios({fileUrl, responseType: 'stream'}).then(response => {
      return new Promise((resolve, reject) => {
        response.data.pipe(fs.createWriteStream(`//${new Date().getUTCSeconds()}.jpg`))
          .on('finish', (res) => {
            console.log(res)
          })
          .on('error', e => {
            console.log(e)
          })
      });
    })
  }
  ,
  buildMediaGroupArrayString: function (photoLinks, text) {
    let arr = [];
    photoLinks.forEach(l => {
      arr.push({
        type: "photo",
        media: l,
      })
    })
    arr[photoLinks.length - 1].caption = text;
    return arr
  },
  splitArrayToChunks(arr, chunkSize) {
    let res = []
    var R = [];
    for (var i = 0; i < arr.length; i += chunkSize)
      res.push(arr.slice(i, i + chunkSize));
    return res;
  },
  emailRegex : /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/g,
  instRegex: /^@(?!.*\.\.)(?!.*\.$)[^\W][\w.]{0,29}$/g

}