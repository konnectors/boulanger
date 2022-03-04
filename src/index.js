process.env.SENTRY_DSN =
  process.env.SENTRY_DSN ||
  'https://0a734fc9bea84117bd562b823e8819e8:601dc1f6690449eca232c747daff7fac@sentry.cozycloud.cc/34'

const {
  BaseKonnector,
  requestFactory,
  log
  // scrape
} = require('cozy-konnector-libs')
const base64url = require('base64url')
const crypto = require('crypto')
const request = requestFactory({
  // debug: true,
  json: true,
  jar: true,
  headers: {
    'Content-Type': 'application/json;charset=UTF-8'
  }
})
const moment = require('moment')
moment.locale('fr')

// const baseUrl = 'https://www.boulanger.com'

module.exports = new BaseKonnector(start)

async function start(fields) {
  if (!fields.login) {
    log('warn', 'Email is needed, maybe a login is provided, check it')
    throw 'LOGIN_FAILED'
  }
  log('info', 'Authenticating...')
  await request('https://www.boulanger.com/account/auth')
  const pkceAuth = await authenticate.bind(this)(fields.login, fields.password)
  log('debug', pkceAuth)
  // log('debug', tkn)
  log('info', 'Fetching bills...')
  const entries = await getList(pkceAuth)
  log('debug', entries)
  // if (entries) {
  //   log('debug', `${entries.length} entries found`)
  //   log('info', 'Saving bills...')
  //   await this.saveBills(entries, fields, {
  //     contentType: 'application/pdf',
  //     linkBankOperations: false,
  //     sourceAccountIdentifier: fields.login,
  //     fileIdAttributes: ['vendorRef'],
  //     validateFileContent: true
  //   })
  // }
}

async function authenticate(email, password) {
  await request('https://www.boulanger.com/libs/granite/csrf/token.json')
  // Auth return 302 if OK, and 200 with body if not
  const tkn = await request({
    url: 'https://login.boulanger.com/identity/v1/password/login',
    method: 'POST',
    followRedirect: true,
    json: {
      email: email,
      password: password,
      client_id: 'QmofH7P73vSvG7H1lJqo',
      scope:
        'openid profile email phone address bl:customer.aftersale.intervention:read:self bl:customer.delivery:read:self bl:customer.invoice:read:self bl:customer.loyalty:read:self bl:customer.loyalty:write:self bl:customer.review:read:self bl:customer.review:write:self bl:customer.sale:read:self bl:customer.sale:write:self bl:sales.sale:read:self bl:service.giftcard.debit.request:all bl:service.giftcard:read:all events full_write offline_access'
    }
  })

  const codeVerifier = codeGenerator(
    48,
    '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
  )
  const base64Digest = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64')
  const code_challenge = base64url(base64Digest)

  const redirectToken = await request({
    url: `https://login.boulanger.com/oauth/authorize`,
    qs: {
      client_id: 'QmofH7P73vSvG7H1lJqo',
      response_type: 'code',
      redirect_uri: 'https://www.boulanger.com/account/auth',
      state: '%7B%22identifierType%22:%22email%22%7D',
      persistent: 'false',
      scope:
        'openid profile email phone address bl:customer.aftersale.intervention:read:self bl:customer.delivery:read:self bl:customer.invoice:read:self bl:customer.loyalty:read:self bl:customer.loyalty:write:self bl:customer.review:read:self bl:customer.review:write:self bl:customer.sale:read:self bl:customer.sale:write:self bl:sales.sale:read:self bl:service.giftcard.debit.request:all bl:service.giftcard:read:all events full_write offline_access',
      display: 'page',
      // code_challenge is a random string, its length must be at least 43
      // code_challenge: 'pEjkZc-DjTpLxsAFBjksponRx-34JvdL_Rsuv5jtDf-',
      code_challenge: code_challenge,
      code_challenge_method: 'S256',
      tkn: tkn.tkn
    },
    resolveWithFullResponse: true
  })
  const redirectionHref = redirectToken.request.href
  const keyValueCode = redirectionHref.match(/code=([a-zA-Z0-9-_])*/g)
  const codeTkn = keyValueCode[0].split('=')[1]
  const pkceAuth = {
    codeTkn,
    code_challenge
  }
  return pkceAuth
}

async function getList(pkceAuth) {
  log('debug', pkceAuth)
  await request('https://www.boulanger.com/account/my-orders')
  await request(
    'https://login.boulanger.com/identity/v1/config?client_id=QmofH7P73vSvG7H1lJqo'
  )
  await request({
    url: 'https://login.boulanger.com/oauth/token',
    method: 'POST',
    json: {
      grant_type: 'authorization_code',
      client_id: 'QmofH7P73vSvG7H1lJqo',
      code: `${pkceAuth.codeTkn}`,
      code_verifier: `${pkceAuth.code_challenge}`,
      redirect_uri: 'https://www.boulanger.com/account/auth'
    }
  })
}

// function parseList($) {
//   if ($.text().includes("Vous n'avez pas réalisé d'achat.")) {
//     log('warn', "Vous n'avez pas réalisé d'achat")
//     return false
//   }

//   log('info', 'Parsing bills urls...')

//   const result = scrape(
//     $,
//     {
//       vendorRef: '.number > b',
//       url1: {
//         sel: '.verifyCredentials',
//         attr: 'data-modal-url',
//         parse: url =>
//           url
//             ? `${baseUrl}/webapp/wcs/stores/servlet/${url.replace(
//                 'DisplayStoreSequencesFacturePDF',
//                 'DisplayStoreFacturePDF'
//               )}&sequence=001`
//             : null
//       },
//       url2: {
//         sel: '.verifyCredentials',
//         attr: 'href',
//         parse: url =>
//           url ? `${baseUrl}/webapp/wcs/stores/servlet/${url}` : null
//       },
//       info: {
//         sel: '.order-head > .infos-purchase b',
//         fn: els => Array.from($(els)).map(el => $(el).text().trim())
//       }
//     },
//     '.order-merchant'
//   )
//     .filter(doc => doc.url1 || doc.url2)
//     .map(doc => {
//       const date = moment(doc.info[0], 'L')
//       const amount = doc.info[1].replace(/\s/g, '')
//       return {
//         vendorRef: doc.vendorRef,
//         vendor: 'Boulanger',
//         fileurl: doc.url1 || doc.url2,
//         date: date.toDate(),
//         amount: parseFloat(amount.replace('€', '').replace(',', '.')),
//         filename:
//           date.format('YYYY-MM-DD') +
//           '_' +
//           amount +
//           '_' +
//           doc.vendorRef +
//           '.pdf'
//       }
//     })

//   return result
// }

function codeGenerator(length, chars) {
  var result = ''
  for (var i = length; i > 0; --i) {
    result += chars[Math.round(Math.random() * (chars.length - 1))]
  }
  return result
}

// function codeChallengeGenerator(code) {
//   const secret = 'thisisasecret'
//   const sha256Hasher = crypto.createHmac('sha256', secret)
//   const hash256 = sha256Hasher.update(code, 'base64url')
//   return hash256
// }

// const code_verifier = randomstring.generate(48)

// const base64Digest = crypto
//   .createHash('sha256')
//   .update(code_verifier)
//   .digest('base64')

// const code_challenge = base64url.fromBase64(base64Digest)
