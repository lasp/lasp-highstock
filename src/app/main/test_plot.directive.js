
(function() {

'use strict'

angular.module( "laspChart" ).directive( "testPlot", [
  function() {
    return {
      restrict: 'A',
      templateUrl: "app/main/test_plot.html",
      scope: {
        datasets: '=',
        dark: '=',
        color: '='
      },
      link: function ( scope ) {

        scope.displayOptions = [
          {name:'Points', value:'points'},
          {name:'Lines', value:'lines'},
          {name:'Points and Lines', value:'linesAndPoints'}
        ];

        scope.selectedTimeDisplay = 'YYYY-MM-DD';
        scope.timeOptions = [
            {name:'YYYY-MM-DD', value:'YYYY-MM-DD'},
            {name:'YYYY-DDD', value:'YYYY-DDDD'}
        ];

        scope.updateTimeDisplay = function(value) {
          console.log('updateTimeDisplay: ' + value);
          scope.menuOptions.timeLabels.momentTimeFormat = value;
          scope.chart.updateXAxis();
        };

        var setDefaultOptions = function() {
          return {
              dataDisplay: {
                  dataGrouping: false,
                  gaps: {
                      enabled: true,
                      threshold: 3
                  },
                  filter: {
                      minmax: {
                          enabled: false,
                          min: null,
                          max: null
                      },
                      delta: {
                          enabled: false,
                          value: null
                      }
                  },
                  seriesDisplayMode: 'lines',
                  showMinMax: true,
              },
              menuDisabled: false,
              timeLabels: {
                  format: 'auto',
                  momentTimeFormat: scope.selectedTimeDisplay,
                  timezone: 'Zulu'
              },
              view: {
                  legend: true,
                  limits: false,
                  limitViolationFlags: true,
                  navigator: true
              },
              yAxis: {
                  scaling: {
                      type: 'auto',
                      low: null,
                      high: null
                  }
              },
              zoomMode: 'x'
          };
        };

        scope.menuOptions = setDefaultOptions();
        if ( scope.datasets[0].accessURL === 'dataset_analog4' ) {
            scope.menuOptions.yAxis.scaleType = 'logarithmic';
            scope.menuOptions.timeLabels.format = 'raw';
        }
        scope.timeRange = {
            total: { start: null, end: null },
            visible: { start: null, end: null }
        };
        scope.uiOptions = {
            plotHeight: 420,
            colorTheme: scope.dark ? 'dark' : 'light'
        };
      }
    }
  }
]);

})();
