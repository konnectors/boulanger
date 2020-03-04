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
  saveBills,
  scrape
} = require('cozy-konnector-libs')
const request = requestFactory({
  // debug: true,
  cheerio: true,
  jar: true,
  userAgent:
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:72.0) Gecko/20100101 Firefox/72.0',
  headers: {
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3'
  }
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
  if(!fields.email) {
    log('warn', 'Email is needed, maybe a login is provided, check it')
    throw 'LOGIN_FAILED'
  }
  log('info', 'Authenticating...')
  await authenticate(fields.email, fields.password)
  log('info', 'Fetching bills...')
  const entries = await getList()
  if (entries) {
    log('debug', `${entries.length} entries found`)
    log('info', 'Saving bills...')
    await saveBills(entries, fields, {
      requestInstance: request,
      contentType: 'application/pdf',
      linkBankOperations: false,
      sourceAccount: this.accountId,
      sourceAccountIdentifier: fields.email,
      fileIdAttributes: ['vendorRef'],
      validateFileContent: true
    })
  }
}

async function getList() {
  const $ = await request({
    method: 'GET',
    uri: billsUrl
  })
  return parseList($)
}

function parseList($) {
  if ($.text().includes("Vous n'avez pas réalisé d'achat.")) {
    log('warn', "Vous n'avez pas réalisé d'achat")
    return false
  }

  log('info', 'Parsing bills urls...')

  const result = scrape(
    $,
    {
      vendorRef: '.number > b',
      url1: {
        sel: '.verifyCredentials',
        attr: 'data-modal-url',
        parse: url =>
          url
            ? `${baseUrl}/webapp/wcs/stores/servlet/${url.replace(
                'DisplayStoreSequencesFacturePDF',
                'DisplayStoreFacturePDF'
              )}&sequence=001`
            : null
      },
      url2: {
        sel: '.verifyCredentials',
        attr: 'href',
        parse: url =>
          url ? `${baseUrl}/webapp/wcs/stores/servlet/${url}` : null
      },
      info: {
        sel: '.order-head > .infos-purchase b',
        fn: els =>
          Array.from($(els)).map(el =>
            $(el)
              .text()
              .trim()
          )
      }
    },
    '.order-merchant'
  )
    .filter(doc => doc.url1 || doc.url2)
    .map(doc => {
      const date = moment(doc.info[0], 'L')
      const amount = doc.info[1].replace(/\s/g, '')
      return {
        vendorRef: doc.vendorRef,
        vendor: 'Boulanger',
        fileurl: doc.url1 || doc.url2,
        date: date.toDate(),
        amount: parseFloat(amount.replace('€', '').replace(',', '.')),
        filename:
          date.format('YYYY-MM-DD') +
          '_' +
          amount +
          '_' +
          doc.vendorRef +
          '.pdf'
      }
    })

  return result
}

async function authenticate(email, password) {
  // Auth return 302 if OK, and 200 with body if not
  await signin({
    requestInstance: request,
    url: loginUrl,
    formSelector: 'form[name="BLAuthenticationForm"]',
    formData: {
      'email.value': email,
      'password.value': password
    },
    validate: (statusCode, $) => {
      return !$('div.mp.login').length
    }
  })
}
