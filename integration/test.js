const request = require('supertest')
const path    = require('path')
const assert  = require('assert')

const app = require('../src/app')

describe('app' , () => {
  it('responds to GET on index', done => {
    request(app)
    .get('/')
    .expect(200, done)
  })
  it('allows creating a project', done => {
    request(app)
      .post('/gitlab/projects')
      .set('Content-Type', 'application/json')
      .send({
        name: 'test'
      })
      .then(r => {
        assert(r.status === 200)
        done()
      })
      .catch(e => {
        assert(false)
        done()
      })
  })
})

describe('uploads' , () => {
  let agent, id, p
  beforeEach(test => {
    agent = request.agent(app)
    p = agent.post('/gitlab/projects')
      .set('Content-Type', 'application/json')
      .send({
        name: 'test'
      })
      .then(r => {
        assert(r.status === 200)
        id = r.body.id
      })
      .then(test)
  })
  it('lets you upload a file', () => {
    return p.then(() => {
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
  })
  it('lets you upload multiple files', () => {
    return p.then(() => {
      const file1 = 'file1'
      const file2 = 'file2'
      const content1 = 'hi'
      const content2 = 'lo'
      const branch = 'master'
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
        })
        .then(r => {
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
})
