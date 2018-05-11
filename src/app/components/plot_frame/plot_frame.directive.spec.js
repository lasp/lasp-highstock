'use strict';

var element, element2, scope, scope2,
    response1, response2, response3, stringResponse1, discreteResponse1,
    $httpBackend, $rootScope, $compile, $timeout, DatasetTypes;

var beforeEachFunc = function( _$compile_, _$rootScope_, _$timeout_, _$httpBackend_, _DatasetTypes_ ) {
    // The injector unwraps the underscores (_) from around the parameter names when matching
    $compile = _$compile_;
    $rootScope = _$rootScope_;
    $timeout = _$timeout_;
    $httpBackend = _$httpBackend_;
    DatasetTypes = _DatasetTypes_;
    
    spyOn(console, 'log');
    
    response1 = {
        'TST1': {
            'metadata': {
                'time': {
                    'alias': 'time',
                    'units': 'milliseconds since 1970-01-01',
                    'length': '25',
                    'type': 'text'
                },
                'TST1': {
                    'long_name': 'Test 1',
                    'tlmId': '1',
                    'missing_value': '0',
                    'limits': {'yellow': {'low': 0, 'high': 2}, 'red': {'low': -1, 'high': 5}},
                    'analog_conversions': {
                        'conversion_type': 'UNSEGMENTED',
                        'coefficients': [{'c0': 0.0}, {'c1': 0.001}, {'c2': 0.0}, {'c3': 0.0}, {'c4': 0.0}, {'c5': 0.0}]
                    }
                },
                'min': {
                    'missing_value': '0'
                },
                'max': {
                    'missing_value': '0'
                },
                'count': {}
            },
            'parameters': ['time', 'TST1'],
            'data': [
                 [1412143350000, 0.9, 1, 1.1, 5],
                 [1412143650000,1.9, 2, 2.1, 5],
                 [1412143950000,3.9, 3, 3.1, 5],
                 [1412144250000,-1.1, -1, -0.9, 5]
             ]
        }
    };
    
    response2 = { 'TST2': angular.copy( response1.TST1 ) };
    response2.TST2.long_name = 'Test 2';
    response2.TST2.tlmId = '2';
    response2.TST2.parameters = ['time', 'TST2'];
    response2.TST2.metadata.TST2 = response2.TST2.metadata.TST1;
    
    response3 = { 'TST3': angular.copy( response1.TST1 ) };
    response3.TST3.long_name = 'Test 3';
    response3.TST3.tlmId = '3';
    response3.TST3.parameters = ['time', 'TST3'];
    response3.TST3.metadata.TST3 = response3.TST3.metadata.TST1;
    
    stringResponse1 = { 'STST1': angular.copy( response1.TST1 ) };
    stringResponse1.STST1.long_name = 'String test 1';
    stringResponse1.STST1.tlmId = '4';
    stringResponse1.STST1.parameters = ['time', 'STST1'];
    stringResponse1.STST1.data = [
      [1426204800119,"/ram/mmsx_rts100_v02.bin"],
      [1426204805119,"/ram/mmsx_rts100_v03.bin"],
      [1426204810119,"/ram/mmsx_rts100_v04.bin"],
      [1426204815119,"/ram/mmsx_rts100_v05.bin"]
    ];
    
    discreteResponse1 = {"SCA2DTOUT": {
        "metadata": {"time": {
        "length": "23",
        "alias": "time,DT",
        "units": "milliseconds since 1970-01-01"
        },
        "SCA2DTOUT": {
        "long_name": "A2D or Pulse Discrete Timeout Flag",
        "state_conversions": [{"value": 0, "state": "NORMAL", "desirability": "GOOD"},
        {"value": 1, "state": "TMOUT", "desirability": "BAD"}],
        "tlmId": "975",
        "alias": "value",
        "missing_value": "-1",
        "full_resolution": "true"
        },
        "state": {
        "length": "16",
        "alias": "State"
        }},
        "parameters": [ "time", "SCA2DTOUT", "state" ],
        "data": [[1471672929050,0,"NORMAL"],
        [1471673040050,0,"NORMAL"],
        [1471673156050,0,"NORMAL"],
        [1471673339050,0,"NORMAL"],
        [1471673638050,0,"NORMAL"],
        [1471673937050,0,"NORMAL"],
        [1471674236050,0,"NORMAL"],
        [1471674535050,0,"NORMAL"],
        [1471674834050,0,"NORMAL"],
        [1471675133050,0,"NORMAL"],
        [1471675432050,0,"NORMAL"],
        [1471675731050,0,"NORMAL"],
        [1471676030050,0,"NORMAL"],
        [1471676329050,0,"NORMAL"]]
    }};
    
    // define server responses
    $httpBackend.whenGET( /^latis\/url1.*/ ).respond( 200, response1 );
    $httpBackend.whenGET( /^latis\/url2.*/ ).respond( 200, response2 );
    $httpBackend.whenGET( /^latis\/url3.*/ ).respond( 200, response3 );
    $httpBackend.whenGET( /^latis\/DiscreteTelemetryItem1.*/ ).respond( 200, discreteResponse1 );
    $httpBackend.whenGET( /^latis\/StringTelemetryItem1.*/ ).respond( 200, stringResponse1 );
    $httpBackend.whenGET( /^latis\/ServerErrorTelemetryItem.*/ ).respond( 504, '<html><body>504 Gateway Timeout</body></html>');
    
    $rootScope.plotList = [];
    
    // generic plot options
    $rootScope.plot1 = {
        datasets: [
           {
               accessURL: 'url1',
               desc: 'desc1',
               name: 'name1'
           },{
               accessURL: 'url2',
               desc: 'desc2',
               name: 'name2'
           }
      ],
      timeRange: {
          total: {
              start: new Date('2014-01-05T18:38:11Z'),
              end: new Date('2014-02-05T18:38:11Z'),
              ertStart: null,
              ertEnd: null
          },
          visible: {
              start: new Date( 1412143350000 ),
              end: new Date( 1412144250000 )
          }
      },
      menuOptions: {
          timeLabels: {
              timezone: '',
              format: 'auto',
              momentTimeFormat: 'YYYY-MM-DD'
          },
          menuDisabled: true,
          view: {
              navigator: true,
              limits: false,
              limitViolationFlags: true
          },
          yAxis: {
              scaling: 'auto'
          },
          zoomMode: 'x'
      },
      uiOptions: {
          collapsed: false
      }
    }; 
    
    $rootScope.plot2 = angular.copy( $rootScope.plot1 );
    
    $rootScope.scope1 = {};
    $rootScope.scope2 = {};
    
    // create two plots
    element  = $compile('<div draw-plot time-range="plot1.timeRange" ui-options="plot1.uiOptions" datasets="plot1.datasets" menu-options="plot1.menuOptions" plot-list="plotList" plot-obj="scope1"></div>')($rootScope);
    element2 = $compile('<div draw-plot time-range="plot2.timeRange" ui-options="plot2.uiOptions" datasets="plot2.datasets" menu-options="plot2.menuOptions" plot-list="plotList" plot-obj="scope2"></div>')($rootScope);
    $rootScope.$digest();
    
    scope = $rootScope.scope1;
    scope2 = $rootScope.scope2;
    
    // define plotList
    $rootScope.plotList = scope2.plotList = [
      {
          timeRange: scope.timeRange,
          datasets: scope.datasets,
          menuOptions: scope.menuOptions,
          uiOptions: scope.uiOptions,
          plotObj: scope
      }, {
          timeRange: scope2.timeRange,
          datasets: scope2.datasets,
          menuOptions: scope2.menuOptions,
          uiOptions: scope2.uiOptions,
          plotObj: scope2
      }
    ];
    
    // complete the loading of plots
    $httpBackend.flush();
};

var afterEachFunc = function() {
    element.remove();
    element2.remove();
    scope.$destroy();
    scope2.$destroy();
};


describe('directive: plotFrame', function() {
    beforeEach( angular.mock.module('laspChart') );
    
    beforeEach(inject( beforeEachFunc ));
    
    afterEach( afterEachFunc );

    it('removes itself from the plot list', function() {
        // add the second plot several times to the plot list, and test removing the first one from different positions in the list
        var listItem1 = $rootScope.plotList[0];
        var listItem2 = $rootScope.plotList[1];
        $rootScope.plotList[2] = $rootScope.plotList[1];
        // the plot list should now resemble this: [ plot1, plot2, plot2 ]
        scope.removePlot();
        expect( $rootScope.plotList ).toEqual( [ listItem2, listItem2 ] );
        
        // add plot1 to the middle of the list and remove it
        $rootScope.plotList.splice( 1, 0, listItem1 );
        expect( $rootScope.plotList ).toEqual( [ listItem2, listItem1, listItem2 ] );
        scope.removePlot();
        expect( $rootScope.plotList ).toEqual( [ listItem2, listItem2 ] );
        
        // add plot1 to the end of the list and remove it
        $rootScope.plotList.push( listItem1 );
        scope.removePlot();
        expect( $rootScope.plotList ).toEqual( [ listItem2, listItem2 ] );
    });
    
    it('creates the appropriate kind of plot based on the access URL', function() {
        // create two new scopes, one to test a discrete plot, and another to test a string plot
        $rootScope.plot3 = angular.copy( $rootScope.plot1 );
        $rootScope.plot4 = angular.copy( $rootScope.plot1 );
        
        $rootScope.plot3.datasets = [{
            accessURL: 'DiscreteTelemetryItem1',
            desc: 'discrete1',
            name: 'discrete plot'
        }];
        $rootScope.plot4.datasets = [{
            accessURL: 'StringTelemetryItem1',
            desc: 'string1',
            name: 'string plot'
        }];
        
        $rootScope.scope3 = {};
        $rootScope.scope4 = {};
        
        var element3 = $compile('<div draw-plot datasets="plot3.datasets" ui-options="plot3.uiOptions" time-range="plot3.timeRange" menu-options="plot3.menuOptions" plot-list="plotList" plot-obj="scope3"></div>')($rootScope);
        var element4 = $compile('<div draw-plot datasets="plot4.datasets" ui-options="plot4.uiOptions" time-range="plot4.timeRange" menu-options="plot4.menuOptions" plot-list="plotList" plot-obj="scope4"></div>')($rootScope);
        $rootScope.$digest();
        $httpBackend.flush();
        
        // now check the types of the plots
        expect( scope.datasetType ).toBe( DatasetTypes.ANALOG );
        expect( $rootScope.scope3.datasetType ).toBe( DatasetTypes.DISCRETE );
        expect( $rootScope.scope4.datasetType ).toBe( DatasetTypes.EVENT_TABLE );
        
        element3.remove();
        element4.remove();
        $rootScope.scope3.$destroy();
        $rootScope.scope4.$destroy();
    });
    
    it('emits an event when its zoom history is added', function () {
        scope.$on( 'historyAdded', onPlotHistoryChange );
        
        var timesHistoryChanged = 0;
        function onPlotHistoryChange() {
            timesHistoryChanged++;
        }
        
        scope.setTimeRange({
            total: {
                start: new Date(0),
                end: new Date(1)
            }
        });
        expect( timesHistoryChanged ).toBe( 1 );
        
        // make sure it doesn't fire history watcher when the same time range is set
        scope.setTimeRange({
            total: {
                start: new Date(0),
                end: new Date(1)
            }
        });
        expect( timesHistoryChanged ).toBe( 1 );
        
        // change the date, but prevent it from adding to history this time
        scope.setTimeRange({
            total: {
                start: new Date(1),
                end: new Date(2)
            }
        }, false );
        expect( timesHistoryChanged ).toBe( 1 );
        
        // set only the visible range
        scope.setTimeRange({
            visible: {
                start: new Date(5),
                end: new Date(6)
            }
        });
        expect( timesHistoryChanged ).toBe( 2 );
    });
    
    it('can split its datasets into multiple plots', function() {
        var plotList = $rootScope.plotList;
        
        // the first plot already has two datasets. Split it.
        scope.splitDatasets();
        
        // there should now be 3 plots
        expect( plotList.length ).toBe( 3 );
        // the first and second plot should be plotting url1 and url2, respectively
        expect( plotList[0].datasets.length ).toBe( 1 );
        expect( plotList[0].datasets[0].accessURL ).toBe( 'url1' );
        expect( plotList[1].datasets.length ).toBe( 1 );
        expect( plotList[1].datasets[0].accessURL ).toBe( 'url2' );
    });
    
    it('can combine with other plots', function() {
        var plotList = scope.plotList;
        
        // change the accessURL of one of the second plot's datasets
        scope2.datasets[0].accessURL = 'url3';
        // combine plot 2 with plot 1
        scope.plotObj = scope;
        scope2.absorbDatasetsOf( scope );
        // there should now be 1 plot
        expect( plotList.length ).toBe( 1 );
        // this one plot should have four datasets
        // the accessURLs should be 'url3', 'url2', 'url1', and 'url3' in that order
        expect( scope2.datasets.length ).toBe( 4 );
        expect( scope2.datasets[0].accessURL ).toBe( 'url3' );
        expect( scope2.datasets[1].accessURL ).toBe( 'url2' );
        expect( scope2.datasets[2].accessURL ).toBe( 'url1' );
        expect( scope2.datasets[0].accessURL ).toBe( 'url3' );
    });
    
    it('can remove datasets from an overlaid plot', function() {
        scope.datasets.push({
            accessURL: 'url2',
            desc: 'desc2',
            name: 'name3'
        });
        // the plot now has three datasets, with 'name' values of 'name1', 'name2', and 'name3'.
        // try removing datasets that the plot doesn't have
        scope.removeDatasets(['fake1','fake2']);
        expect( scope.datasets.length ).toBe( 3 );
        
        // remove a couple datasets
        scope.removeDatasets(['name3', 'name1']);
        expect( scope.datasets.length ).toBe( 1 );
        expect( scope.datasets[0].name ).toBe( 'name2' );
    });
    
    it('can identify empty datasets', function() {
        // make one of the responses return an empty dataset
        response3.TST3.data = [];
        scope.datasets.push({
            accessURL: 'url3',
            desc: 'desc3',
            name: 'name3'
        });
        scope.$digest();
        $httpBackend.flush();
        
        // one of this new plot's datasets should have triggered a response with an empty dataset
        expect( scope.dataError ).toBe( 'noData' );
        expect( scope.noDataErrorKeys.length ).toBe( 1 );
        expect( scope.noDataErrorKeys ).toEqual( ['TST3'] );
    });
    
    it('shows an error on a 5XX response', function() {
        scope.datasets = [{
            accessURL: 'ServerErrorTelemetryItem',
            desc: 'desc',
            name: 'name'
        }];
        scope.$digest();
        $httpBackend.flush();
        
        // the plot should be showing the 5XX error
        expect( scope.dataError ).toBe( 'Server Error' );
    });

    it('gets a CSV download path', function() {
        expect( scope.getCSVdownloadPath(0) ).toBe( 'url1&time>=2014-01-05T18:38:11.000Z&time<=2014-02-05T18:38:11.000Z' );
        expect( scope.getCSVdownloadPath(1) ).toBe( 'url2&time>=2014-01-05T18:38:11.000Z&time<=2014-02-05T18:38:11.000Z' );
        scope.datasets[1].offset = '1 d';
        expect( scope.getCSVdownloadPath(1) ).toBe( 'url2&time>=2014-01-06T18:38:11.000Z&time<=2014-02-06T18:38:11.000Z' );
    });
});


describe('directive: highchart', function() {
    var options;
    
    beforeEach( angular.mock.module('laspChart') );
    
    beforeEach(inject( beforeEachFunc ));
    
    afterEach( afterEachFunc );
    
    var chart = {
        series: [{
            addPoint: angular.noop,
            name: '',
            type: 'line',
            color: '#000000'
        }],
        options: {
            chart: {}
        },
        redraw: angular.noop,
        reflow: angular.noop,
        update: angular.noop,
        showLoading: angular.noop,
        hideLoading: angular.noop,
        destroy: function() {
            destroyed = true;
        },
        addSeries: angular.noop,
        xAxis: [{
            getExtremes: function() {
                return {
                    dataMin: 1412143350000,
                    dataMax: 1412144250000
                };
            },
            setExtremes: angular.noop,
            update: angular.noop
        }],
        yAxis: [{
            setExtremes: angular.noop,
            update: angular.noop
        }]
    };
        
    var destroyed = false;
    var usedChartConstructor = '';
    
    window.Highcharts = {
        Chart: function (opt) {
          options = opt;
          usedChartConstructor = 'Chart';

          return chart;
        },
        StockChart: function (opt) {
          options = opt;
          usedChartConstructor = 'StockChart';

          return chart;
        },
        stockChart: function( renderElement, opt ) {
            options = opt;
            angular.merge( this, chart );
        },
        Map: function (opt) {
          options = opt;
          usedChartConstructor = 'Map';

          return chart;
        }
    };
    
    it('passes options to highcharts', function () {
        expect(options.chart).toBeDefined();
    });
    
    it('changes menuOptions object when calling setMenuOptions', function () {
        scope.setMenuOptions({ dataDisplay: { gaps: {threshold:9} }});
        expect( scope.menuOptions.dataDisplay.gaps.threshold ).toBe( 9 );
    });
    
    it('correctly sets xAxis options when created', function() {
        // define important values we will be using in this test
        var dateStart = 1412143350000;
        var dateEnd = 1412144250000;
        var visibleStart = 1412143650000;
        var visibleEnd = 1412143950000;
        
        // create a plot and set its currentMin/max to something smaller than the date range, and also smaller than the range of loaded data
        $rootScope.plot3 = angular.copy( $rootScope.plot1 );
        $rootScope.plot3.timeRange.total.start = new Date( dateStart ); // the earliest time value returned by the fake latis
        $rootScope.plot3.timeRange.total.end = new Date( dateEnd ); // the latest time value returned by the fake latis
        $rootScope.plot3.timeRange.visible.start = new Date( visibleStart ); // middle values returned by fake latis
        $rootScope.plot3.timeRange.visible.end = new Date( visibleEnd );
        $rootScope.scope3 = {};
        var element3 = $compile('<div draw-plot time-range="plot3.timeRange" ui-options="plot3.uiOptions" datasets="plot3.datasets" menu-options="plot3.menuOptions" plot-list="plotList" plot-obj="scope3"></div>')($rootScope);
        $rootScope.$digest();
        $httpBackend.flush();
        
        var scope3 = $rootScope.scope3;
        
        // currentMin/Max should reflect what we originally set it to
        expect( scope3.timeRange.visible.start.getTime() ).toBe( visibleStart );
        expect( scope3.timeRange.visible.end.getTime() ).toBe( visibleEnd );
        
        // the plot should have instructed the highcharts object to set the extremes to the xAxis.currentMin/Max values
        expect( scope3.chart.options.xAxis[0].min ).toBe( visibleStart );
        expect( scope3.chart.options.xAxis[0].max ).toBe( visibleEnd );
        
        element3.remove();
        $rootScope.scope3.$destroy();
    });
});
