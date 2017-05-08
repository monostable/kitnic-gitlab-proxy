const superagent = require('superagent')
const express    = require('express')
const sessions   = require('client-sessions')
const shortid    = require('shortid')

const config  = require('../config')
const api_url = config.gitlab_api_url

const app = express()

app.use(sessions({
  cookieName     : 'session',
  secret         : config.session_secret,
  duration       : config.session_timeout,
  activeDuration : config.session_timeout,
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
  if (req.session.token) {
    const req_url = `${api_url}${req.url}`
    return superagent(req.method, req_url)
      .set('PRIVATE-TOKEN', req.session.token)
      .then(r => res.send(r.body))
      .catch(e => res.sendStatus(e.status))
  }
  return res.sendStatus(401)
})

function createUser() {
  const id = shortid.generate()
  return superagent.post(`${api_url}/users`)
    .send({
      email         : `temp-email-for-oauth-${id}@gitlab.localhost`,
      username      : id,
      name          : id,
      private_token : config.gitlab_api_token ,
      password      : shortid.generate(),
    })
    .then(r => r.body)
    .then(user => {
      return superagent.post(`${api_url}/users/${user.id}/impersonation_tokens`)
        .send({
          private_token : config.gitlab_api_token,
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
