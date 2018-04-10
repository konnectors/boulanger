const {
  BaseKonnector,
  requestFactory,
  log,
  saveFiles,
  addData
} = require('cozy-konnector-libs')
const request = requestFactory({ cheerio: true })

const baseUrl = 'http://books.toscrape.com'


module.exports = new BaseKonnector(start)

function start(fields) {
  // The BaseKonnector instance expects a Promise as return of the function
  return request(`${baseUrl}/index.html`).then($ => {
    // cheerio (https://cheerio.js.org/) uses the same api as jQuery (http://jquery.com/)
    // here I do an Array.from to convert the cheerio fake array to a real js array.
    const entries = Array.from($('article')).map(article =>
      parseArticle($, article)
    )
    return addData(entries, 'com.toscrape.books').then(() =>
      saveFiles(entries, fields)
    )
  })
}

function authenticate(login, password) {
  return request({
    method: 'POST',
    uri: loginUrl,
    form: {
      username: login,
      password: password
    },


}
