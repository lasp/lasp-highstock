/**
 * This file uses the Page Object pattern to define the main page for tests
 * https://docs.google.com/presentation/d/1B6manhG0zEXkC-H-tPo2vwU06JhL8w9-XCF9oehXzAQ
 */

'use strict';

var MainPage = function() {
  this.plot = element(by.css('.plot-wrapper'));
  this.dataPointsBtn = element(by.id('markers-enable'));
  this.navigatorBtn = element(by.id('navigator-enable'));
  this.jumbEl = element(by.css('.jumbotron'));
  this.h1El = this.jumbEl.element(by.css('h1'));
  this.thumbnailEls = element(by.css('body')).all(by.repeater('awesomeThing in awesomeThings'));
};

module.exports = new MainPage();
