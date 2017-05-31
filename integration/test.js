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
  it('lets you upload a file', done => {
    const agent = request.agent(app)
    let id
    agent.post('/gitlab/projects')
      .set('Content-Type', 'application/json')
      .send({
        name: 'test'
      })
      .then(r => {
        assert(r.status === 200)
        id = r.body.id
      })
      .catch(e => {
        assert(false)
      })
      .then(() => {
        return agent.post(`/gitlab/projects/${id}/repository/files/test`)
          .send({
            file_path: 'test',
            branch:'master',
            content:'hi',
            commit_message:'Upload file through kitnic.it'
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
})
