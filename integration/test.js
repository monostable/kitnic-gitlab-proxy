const {expect} = require('chai')
const request  = require('supertest')
const path     = require('path')

const app = require('../src/app')

describe('app' , () => {
  it('responds to GET on index', done => {
    request(app)
    .get('/')
    .expect(200, done)
  })
})
