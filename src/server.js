const superagent = require('superagent')
const express    = require('express')
const sessions   = require('client-sessions')
const shortid    = require('shortid')

const secrets = require('../secrets')

const app = express()

app.use(sessions({
  cookieName: 'session', // cookie name dictates the key name added to the request object
  secret: secrets.cookie_secret,
  duration: 1 * 60 * 60 * 1000,
  activeDuration: 1000 * 60 * 5
}))

app.use((req, res, next) => {
  if (req.session.id == null) {
    req.session.id = shortid.generate()
  } else {
    console.log(req.session.id)
  }
})

const port = process.env.PORT || 4003

app.listen(port)
console.log(`Running kitnic-gitlab-proxy at localhost:${port}`)
