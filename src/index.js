const moment = require('moment')
moment.locale('fr')
const {
  BaseKonnector,
  requestFactory,
  log,
  saveBills
} = require('cozy-konnector-libs')
let request = requestFactory()
const jar = request.jar()
request = requestFactory({
  cheerio: true,
  jar: jar
  //debug: true
})

const baseUrl = 'https://www.boulanger.com/webapp/wcs/stores/servlet/'
const loginUrl = baseUrl + 'BLAuthentication'
const billsUrl =
  baseUrl + 'BLAccountOrdersHistoryCmd?purchase=allYear&store=store-site'

module.exports = new BaseKonnector(start)

function start(fields) {
  log('info', 'Authenticating ...')
  return authenticate(fields.email, fields.password)
    .then(getList)
    .then(entries => {
      return saveBills(entries, fields, {
        timeout: Date.now() + 60 * 1000,
        identifiers: ['boulanger'],
        dateDelta: 12,
        amountDelta: 5
      })
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
  const datas = Array.from(
    $('.order-head b').map((index, element) => {
      return $(element)
        .text()
        .trim()
    })
  )
  return Array.from(
    $('.verifyCredentials').map((index, element) => {
      const link = baseUrl + $(element).attr('href')
      const number = $(element)
        .attr('href')
        .match('=(.+?)$')[1]
      const amount = datas[index * 2 + 1].replace(/\s/g, '')
      const date = moment(datas[index * 2], 'L')
      return {
        fileurl: link,
        filename:
          date.format('YYYY-MM-DD') + '_' + amount + '_' + number + '.pdf',
        vendor: 'Boulanger',
        date: date.toDate(),
        amount: parseFloat(amount.replace('€', '').replace(',', '.')),
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
  }) // .catch(err => {})   ?
}
