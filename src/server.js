const superagent = require('superagent')
const express    = require('express')
const sessions   = require('client-sessions')
const shortid    = require('shortid')

const secrets = require('../secrets')

const app = express()

app.use(sessions({
  cookieName: 'session',
  secret: secrets.cookie_secret,
  duration: 1 * 60 * 60 * 1000,
  activeDuration: 1000 * 60 * 5
}))

app.use((req, res, next) => {
  if (req.session.id == null) {
    return createUser().then(info => {
      req.session = info
      return next()
    })
  }
  return next()
})

app.use((req, res, next) => {
  res.send(req.session)
})

function createUser() {
  const apiUrl = 'https://gitlab2.kitnic.it/accounts/api/v4/'
  const id = shortid.generate()
  return superagent.post(`${apiUrl}users`)
    .send({
      email         : `temp-email-for-oauth-${id}@gitlab.localhost`,
      username      : id,
      name          : id,
      private_token : secrets.gitlab_api_token ,
      password      : shortid.generate(),
    })
    .then(r => r.body)
    .then(user => {
      return superagent.post(`${apiUrl}users/${user.id}/impersonation_tokens`)
        .send({
          private_token : secrets.gitlab_api_token,
          user_id: user.id,
          name: shortid.generate(),
          scopes: ['api', 'read_user'],
        })
        .then(r => {
          return {id: user.id, token: r.body.token}
        })
    })
}


const port = process.env.PORT || 4003

app.listen(port)
console.log(`Running kitnic-gitlab-proxy at localhost:${port}`)
