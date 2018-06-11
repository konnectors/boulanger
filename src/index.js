// Force sentry DSN into environment variables
// In the future, will be set by the stack
process.env.SENTRY_DSN =
  process.env.SENTRY_DSN ||
  'https://0a734fc9bea84117bd562b823e8819e8:601dc1f6690449eca232c747daff7fac@sentry.cozycloud.cc/34'

const {
  BaseKonnector,
  requestFactory,
  signin,
  log,
  saveBills
} = require('cozy-konnector-libs')
const request = requestFactory({
  //debug: true,
  cheerio: true,
  jar: true
})
const moment = require('moment')
moment.locale('fr')

const baseUrl = 'https://www.boulanger.com'
const loginUrl =
  baseUrl +
  '/authentication?action=logon&catalogId=10001&storeId=10001&langId=-2'
const billsUrl =
  baseUrl +
  '/webapp/wcs/stores/servlet/BLAccountOrdersHistoryCmd?purchase=allYear&store=store-site'

module.exports = new BaseKonnector(start)

async function start(fields) {
  log('info', 'Authenticating...')
  await authenticate(fields.email, fields.password)
  log('info', 'Fetching bills...')
  const entries = await getList()
  log('debug', `${entries.length} entries found`)
  log('info', 'Saving bills...')
  await saveBills(entries, fields, {
    identifiers: ['boulanger'],
    contentType: 'application/pdf'
  })
}

async function getList() {
  const $ = await request({
    method: 'GET',
    uri: billsUrl
  })
  return parseList($)
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
      const link =
        baseUrl + '/webapp/wcs/stores/servlet/' + $(element).attr('href')
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
        amount: parseFloat(amount.replace('€', '').replace(',', '.'))
      }
    })
  )
}

async function authenticate(email, password) {
  // Auth return 302 if OK, and 200 with body if not
  await signin({
    url: loginUrl,
    formSelector: 'form[name="BLAuthenticationForm"]',
    formData: {
      'email.value': email,
      'password.value': password
    },
    validate: (statusCode, $) => {
      // Find info about profil to check login
      if (
        $('dt[class="off"]')
          .first()
          .text() == 'Mon profil'
      ) {
        return true
      } else {
        return false
      }
    }
  })
}
