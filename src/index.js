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
  jar: jar
  //debug: true
})

const baseUrl = 'https://www.boulanger.com/'
const loginUrl = baseUrl + 'webapp/wcs/stores/servlet/BLAuthentication'
const billsUrl =
  baseUrl +
  'webapp/wcs/stores/servlet/BLAccountOrdersHistoryCmd?purchase=allYear&store=store-site'
const downloadUrl = baseUrl + 'webapp/wcs/stores/servlet/'

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
  // Get a list of interesting b block (amount and date)
  datas = Array.from(
    $('.order-head b').map((index, element) => {
      return $(element)
        .text()
        .trim()
    })
  )
  console.log(datas)
  return Array.from(
    $('.verifyCredentials').map((index, element) => {
      const link = downloadUrl + $(element).attr('href')
      const number = $(element)
        .attr('href')
        .match('=(.+?)$')[1]
      return {
        fileurl: link,
        filename: number + '.pdf',
        vendor: 'Boulanger',
        date: datas[index * 2],
        amount: datas[index * 2 + 1],
        requestOptions: {
          jar: jar // Cookie WP_PERSITENT (long version) mandatory
        }
      }
    })
  )
}

function authenticate(email, password) {
  return request({
    method: 'POST',
    uri: loginUrl,
    form: {
      'email.value': email,
      'password.value': password,
      rememberMe: true,
      reLogonURL: 'BLAuthenticationView&storeId=10001' // Needed for getting WP_PERSISTENT cookie
    }
  }) // .catch(err => { })   ?
}
