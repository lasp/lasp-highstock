'use strict';

describe('The main view', function () {
  var page;

  beforeEach(function () {
    browser.get('http://localhost:3000/index.html');
    page = require('./main.po');
  });

  it('should include jumbotron with correct data', function() {
    expect(page.h1El.getText()).toBe('LASP HighStock');
  });
  
  it('should allow us to toggle options', function(){
    page.dataPointsBtn.click();
    expect(element(by.css('.highcharts-navigator')).isPresent()).toBe(true);
    page.navigatorBtn.click();
    expect(element(by.css('.highcharts-navigator')).isPresent()).toBe(false);
  });
});
