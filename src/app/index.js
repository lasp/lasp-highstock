'use strict';

angular
  .module('laspHighstock', [
    'ngRoute',
    'ui.bootstrap',
    'latis',
    'constants',
    'laspChart',
    'laspDatePicker',
    'ngMockE2E'
  ])
  .config(['$routeProvider', function ($routeProvider) {
    $routeProvider
      .when('/', {
        templateUrl: 'app/main/main.html',
        controller: 'MainCtrl'
      })
      .when('/colors', {
        templateUrl: 'app/main/colors.html',
        controller: 'ColorCtrl'
      })
      .otherwise({
        redirectTo: '/'
      });
  }]);
