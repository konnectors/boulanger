const {
  BaseKonnector,
  requestFactory,
  log,
  saveBills,
  saveFiles,
  addData
} = require('cozy-konnector-libs')
let request = requestFactory()
const jar = request.jar()
request = requestFactory({
  cheerio: true,
  jar: jar,
  debug: true
})

const baseUrl = 'https://www.boulanger.com/'
const loginUrl = baseUrl + 'webapp/wcs/stores/servlet/BLAuthentication'
const billsUrl =
  baseUrl +
  'webapp/wcs/stores/servlet/BLAccountOrdersHistoryCmd?purchase=allYear&store=store-site'

module.exports = new BaseKonnector(start)

function start(fields) {
  log('info', 'Authenticating ...')
  return authenticate(fields.email, fields.password)
    .then(getList)
    .then(entries => {
      return saveFiles(entries, fields)
    })
}

function getList() {
  return request({
    method: 'GET',
    uri: billsUrl
  }).then(parseList)
}

function parseList($) {
  log('info', 'Parsing bills urls...')
  datas = Array.from(
    $('.order-head b').map((index, element) => {
      return $(element)
        .text()
        .trim()
    })
  )
  return Array.from(
    $('.verifyCredentials').map((index, element) => {
      const link =
        baseUrl + 'webapp/wcs/stores/servlet/' + $(element).attr('href')
      const number = $(element)
        .attr('href')
        .match('=(.+?)$')[1]
      return { fileurl: link, filename: number + '.pdf', jar: jar }
    })
  )
  //  console.log(Array.from(`a[class="verifyCredentials"]`)))
  //  console.log($.html())
}

function authenticate(email, password) {
  return request({
    method: 'POST',
    uri: loginUrl,
    form: {
      'email.value': email,
      'password.value': password,
      rememberMe: true,
      reLogonURL: 'BLAuthenticationView&storeId=10001'
    }
  }) // .catch(err => { })   ?
}
