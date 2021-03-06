const superagent = require('superagent')
const express    = require('express')
const sessions   = require('client-sessions')
const crypto     = require('crypto')
const bodyParser = require('body-parser')

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

app.use('/gitlab', function createSession(req, res, next) {
  if (req.session.id == null) {
    return createUser().then(info => {
      req.session = info
      return next()
    })
  }
  return next()
})

app.use('/gitlab', function resetTimeout(req, res, next) {
  const id = req.session.id
  if (id != null) {
    clearTimeout(timeouts[id])
    timeouts[id] = setTimeout(() => {
      deleteUser(id)
    }, config.session_timeout)
  }
  return next()
})

const jsonParser = bodyParser.json()

function proxyApi(req, res, next) {
  console.log('got gitlab proxy request', req.url)
  if (req.session.token) {
    const url = api_url + req.url.replace(/^\/gitlab/, '')
    console.log(url)
    return superagent(req.method, url)
      .set('PRIVATE-TOKEN', req.session.token)
      .accept('application/json')
      .send(req.body)
      .then(r => {
        if (req.headers['accept'] === 'application/json') {
          return res.send(r.body)
        }
        return res.send(r.text)
      })
      .catch(e => res.sendStatus(e.status))
  }
  return res.sendStatus(401)
}

app.get('/', (req, res) => res.send('ok'))

app.use('/gitlab', function checkIfJson(req, res, next)  {
  const type = req.headers['content-type']
  if (type === 'application/json') {
    return jsonParser(req, res, next)
  }
  return next()
})


app.post('/gitlab/projects', function addProject(req, res, next) {
  console.log('got /gitlab/projects')
  if (req.session.token) {
    if (req.body.import_url && (req.body.name == null)) {
        const split = req.body.import_url.split('/')
        req.body.name = split[split.length - 1]
    }
    const url = api_url + req.url.replace(/^\/gitlab/, '')
    return superagent(req.method, url)
      .set('PRIVATE-TOKEN', req.session.token)
      .send(req.body)
      .then(r => r.body)
      .then(async project => {
        //if it's an import wait till we can actually see the file tree
        if (req.body.import_url) {
          let status, tries = 0
          const url = api_url + `/projects/${project.id}/repository/tree`
          while (status !== 200) {
            tries += 1
            if (tries >= 1000) {
              return Promise.reject({status: 500})
            }
            status = await superagent.get(url)
              .set('PRIVATE-TOKEN', req.session.token)
              .then(r => r.status)
              .catch(e => e.status)
          }
        }

        return project
      })
      .then(project => res.send(project))
      .catch(e => res.sendStatus(e.status))
  }
  return res.sendStatus(401)
})

app.use('/gitlab', proxyApi)


app.post('/hooks/:session_id/:project_id', jsonParser, function handleHook(req, res, next) {
  console.log('got a hook!')
  console.log(req.body)
  return res.send('ok')
})

app.post('/system-hooks', jsonParser, function handleHook(req, res, next) {
  console.log('system-hook', req.body.event_name)
  if (req.body.event_name === 'project_create') {
    const url = api_url + `/projects/${req.body.project_id}/repository/tree`
    console.log(url)
    superagent.get(url)
        .accept('application/json')
        .set('PRIVATE-TOKEN', config.gitlab_api_token)
        .then(r => console.log(r.body))
        .catch(e => console.error(e))
  }
  return res.send('ok')
})


function createUser() {
  const name = random()
  return superagent.post(`${api_url}/users`)
    .set('PRIVATE-TOKEN', config.gitlab_api_token)
    .send({
      //That's the pattern gitlab uses internally for oauth when it can't get
      //the email. Using this might prevent it actually trying to send out
      //emails?
      email          : `temp-email-for-oauth-${name}@gitlab.localhost`,
      username       : name,
      name           : name,
      password       : random(),
      projects_limit : 10,
    })
    .then(r => r.body)
    .then(user => {
      return superagent.post(`${api_url}/users/${user.id}/impersonation_tokens`)
        .set('PRIVATE-TOKEN', config.gitlab_api_token)
        .send({
          user_id : user.id,
          name    : random(),
          scopes  : ['api', 'read_user'],
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

module.exports = {deleteUser, app}
