const {
  BaseKonnector,
  requestFactory,
  log,
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
  return authenticate(fields.email, fields.password).then(getList)
}

function getList() {
  return request({
    method: 'GET',
    uri: billsUrl
  }).then(parseList)
}

function parseList($) {
  log('info', 'Parsing bills urls...')
  console.log(Array.from($('#verifyCredentials')))
  return 'aa'
}

function authenticate(email, password) {
  return request({
    method: 'POST',
    uri: loginUrl,
    form: {
      'email.value': email,
      'password.value': password
    }
  }) // .catch( ?
}
