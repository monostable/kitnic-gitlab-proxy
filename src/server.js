const superagent = require('superagent')
const express    = require('express')
const sessions   = require('client-sessions')
const crypto     = require('crypto')

const config  = require('../config')
const api_url = config.gitlab_api_url

const app = express()

const timeouts = {}

app.use(sessions({
  cookieName     : 'session',
  secret         : config.session_secret,
  duration       : config.session_timeout,
  activeDuration : config.session_timeout,
}))

app.use(function createSession(req, res, next) {
  if (req.session.id == null) {
    return createUser().then(info => {
      req.session = info
      return next()
    })
  }
  return next()
})

app.use(function resetTimeout(req, res, next) {
  const id = req.session.id
  if (id != null) {
    clearTimeout(timeouts[id])
    timeouts[id] = setTimeout(() => {
      deleteUser(id)
    }, config.session_timeout)
  }
  return next()
})

app.use(function proxyApi(req, res, next) {
  if (req.session.token) {
    return superagent(req.method, api_url + req.url)
      .set('PRIVATE-TOKEN', req.session.token)
      .then(r => res.send(r.body))
      .catch(e => res.sendStatus(e.status))
  }
  return res.sendStatus(401)
})

function createUser() {
  const id = random()
  return superagent.post(`${api_url}/users`)
    .set('PRIVATE-TOKEN', config.gitlab_api_token)
    .send({
      //That's the pattern gitlab uses internally for oauth when it can't get
      //the email. Using this might prevent it actually trying to send out
      //emails?
      email    : `temp-email-for-oauth-${id}@gitlab.localhost`,
      username : id,
      name     : id,
      password : random(),
    })
    .then(r => r.body)
    .then(user => {
      return superagent.post(`${api_url}/users/${user.id}/impersonation_tokens`)
        .set('PRIVATE-TOKEN', config.gitlab_api_token)
        .send({
          user_id: user.id,
          name: random(),
          scopes: ['api', 'read_user'],
        })
        .then(r => {
          console.log('Created user', user.id)
          return {id: user.id, token: r.body.token}
        })
    })
}

function deleteUser(user_id) {
  return superagent.delete(`${api_url}/users/${user_id}`)
    .set('PRIVATE-TOKEN', config.gitlab_api_token)
    .then(r => console.log('Deleted user', user_id))
    .catch(e => console.error('Error deleting user', user_id, e))
}

function random() {
  return crypto.randomBytes(20).toString('hex')
}


const port = process.env.PORT || 4003

app.listen(port)
console.log(`Running kitnic-gitlab-proxy at localhost:${port}`)
