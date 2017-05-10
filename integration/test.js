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
