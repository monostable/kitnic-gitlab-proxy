const request = require('supertest')
const path    = require('path')
const assert  = require('better-assert')

const {app, deleteUser} = require('../src/app')

let agent

beforeEach(() => {
  agent = request.agent(app)
})

afterEach(() => {
  return agent.get('/gitlab/user')
    .accept('application/json')
    .then(r => deleteUser(r.body.id))
})

describe('basics', () => {
  it('responds to GET on index', () => {
    return agent.get('/')
      .expect(200)
  })
  it('responds with user', () => {
    return agent.get('/gitlab/user')
      .accept('application/json')
      .then(r => {
        assert(r.status === 200)
        assert(r.body.id != null)
      })
  })
})

describe('projects', () => {
  it('allows creating a project', () => {
    return agent.post('/gitlab/projects')
      .send({
        name: 'test'
      })
      .then(r => {
        assert(r.status === 200)
      })
  })
})

describe('uploads' , () => {
  const file1 = 'file1'
  const file2 = 'file2'
  const content1 = 'hi'
  const content2 = 'lo'
  const branch = 'master'

  beforeEach(() => {
    return agent.post('/gitlab/projects')
      .send({
        name: 'test'
      })
      .then(r => {
        assert(r.status === 200)
        id = r.body.id
      })
  })

  it('lets you upload a file', () => {
    return agent.post(`/gitlab/projects/${id}/repository/files/test`)
      .send({
        file_path: 'test',
        branch: 'master',
        content: 'hi',
        commit_message: 'Upload file through kitnic.it'
      })
      .then(r => {
        assert(r.status === 200)
      })
  })

  it('lets you upload multiple files', () => {
      return agent.post(`/gitlab/projects/${id}/repository/commits`)
        .send({
          branch,
          commit_message: 'Upload file through kitnic.it',
          actions: [
            {
              action: 'create',
              file_path: file1,
              content: content1,
            },
            {
              action: 'create',
              file_path: file2,
              content: content2,
            },
          ],
        }).then(r => {
          assert(r.status === 200)
          const p1 = agent.get(`/gitlab/projects/${id}/repository/files/${file1}/raw?ref=${branch}`)
          .then(r => {
            assert(r.status === 200)
            assert(r.text === content1)
          })
          const p2 = agent.get(`/gitlab/projects/${id}/repository/files/${file2}/raw?ref=${branch}`)
          .then(r => {
            assert(r.status === 200)
            assert(r.text === content2)
          })
          return Promise.all([p1, p2])
      })
  })
})
