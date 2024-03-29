const {
  BaseKonnector,
  requestFactory,
  log,
  scrape
} = require('cozy-konnector-libs')
const request = requestFactory({
  // debug: true,
  cheerio: true,
  jar: true,
  headers: {
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36'
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
  if (!fields.email) {
    log('warn', 'Email is needed, maybe a login is provided, check it')
    throw 'LOGIN_FAILED'
  }
  log('info', 'Authenticating...')
  await authenticate.bind(this)(fields.email, fields.password)
  log('info', 'Fetching bills...')
  const entries = await getList()
  if (entries) {
    log('debug', `${entries.length} entries found`)
    log('info', 'Saving bills...')
    await this.saveBills(entries, fields, {
      contentType: 'application/pdf',
      linkBankOperations: false,
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
  await this.signin({
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
