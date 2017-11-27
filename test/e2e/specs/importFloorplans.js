const path = require('path');
const fs = require('fs');
const Ajv = require('ajv');
const jsonSchemaDraft4 = require('ajv/lib/refs/json-schema-draft-04.json');
const schema = require('../../../schema/geometry_schema.json');
const downloads = path.join(require('os').homedir(), 'Downloads');
const failOnError = require('../helpers').failOnError;
const draw50By50Square = require('../helpers').draw50By50Square;
const withScales = require('../helpers').withScales;

const exported = path.join(downloads, 'floorplan_nightwatch_exported.json');

module.exports = {
  tags: ['import-floorplan'],
  setUp: (browser) => {
    const devServer = browser.globals.devServerURL;

    failOnError(browser)
      .url(devServer)
      .resizeWindow(1000, 800)
      .waitForElementVisible('.modal .open-floorplan', 100)
      .setFlagOnError();
  },
  'import succeeds': (browser) => {
    browser
      .setValue('#importInput', path.join(__dirname, '../fixtures/floorplan-2017-08-31.json'))
      .waitForElementVisible('#grid svg polygon', 100)
      .checkForErrors()
      .end();
  },
  'export is importable': (browser) => {
    withScales(browser)
      .click('.modal .new-floorplan svg')
      .getScales()
      .perform(draw50By50Square)
      .click('[title="save floorplan"]')
      .setValue('#download-name', '_nightwatch_exported')
      .click('.download-button')
      .pause(10)
      .checkForErrors();

    browser
      .refresh()
      .waitForElementVisible('.modal .open-floorplan', 100)
      .setFlagOnError()
      .setValue('#importInput', exported)
      .waitForElementVisible('#grid svg polygon', 100)
      .checkForErrors()
      .end();
  },
  'exported floorplan satisfies schema': (browser) => {
    const ajv = new Ajv({ allErrors: true });
    ajv.addMetaSchema(jsonSchemaDraft4);

    withScales(browser)
      .click('.modal .new-floorplan svg')
      .getScales()
      .perform(draw50By50Square)
      .click('[title="save floorplan"]')
      .setValue('#download-name', '_nightwatch_exported')
      .click('.download-button')
      .pause(10)
      .checkForErrors();

    fs.readFile(exported, 'utf8', (err, data) => {
      browser.assert.ok(!err, 'floorplan file was found');
      const valid = ajv.validate(schema, JSON.parse(data));
      if (!valid) {
        browser.assert.ok(false, 'schema failed to validate:' + JSON.stringify(ajv.errors, null, '  '));
      }
      browser.end();
    });
  },
  'project.north_axis new location': (browser) => {
    browser
      .setValue('#importInput', path.join(__dirname, '../fixtures/floorplan-2017-08-31.json'))
      .waitForElementVisible('#grid svg polygon', 100)
      .execute('return window.application.$store.state.project.north_axis', [], ({ value }) => {
        browser.assert.equal(value, 12, 'expected project.config.north_axis to be moved to project.north_axis');
      })
      .execute('return window.application.$store.state.project.config.north_axis', [], ({ value }) => {
        browser.assert.ok(!value); // should be deleted from project.config
      })
      .checkForErrors()
      .end();
  },
  after: () => {
    fs.stat(exported, (statErr) => {
      if (!statErr) {
        fs.unlink(exported, (err) => { console.error(err); });
      }
    });
  },
};
