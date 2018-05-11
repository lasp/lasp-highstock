'use strict';

describe('Service: highstockAdapter', function () {
    var chart;

    // load the controller's module
    beforeEach(angular.mock.module('laspChart'));
    var constants, LimitTypes, ColorThemes;

    beforeEach(inject(function(Chart, _constants_, _LimitTypes_, _ColorThemes_) {
        constants = _constants_;
        LimitTypes = _LimitTypes_;
        ColorThemes = _ColorThemes_;

        chart = new Chart();
        chart.init();

        spyOn( chart.chart, 'update' ); // spy on whether the highstock object is updated with new options
        spyOn( chart.chart.yAxis[0], 'update' );

        // a mock Highcharts object is defined in plot_frame.directive.spec.js
        // since it's defined under window.Highcharts, it's able to be used for these tests
    }));

    it('should create and destroy a highstock chart', function() {
        // beforeEach already initializes the chart
        expect( typeof chart.chart ).toBe( 'object' );
        chart.destroy();
        expect( chart.chart ).toBe( false );
        chart.init();
        expect( typeof chart.chart ).toBe( 'object' );
    });

    it('should return info on the series', function() {
        chart.init();
        var lineSeries =  { name: 'a', type: 'line', color: '#ffffff', index: 0, userOptions: false };
        var rangeSeries = { name: 'range', type: 'arearange', color: '#000000', index: 2, userOptions: true };
        var eventSeries = { name: 'Event', type: 'polygon', color: '#dddddd' }; // spacecraft event
        // mock some series on the chart
        chart.chart.series = [ lineSeries, eventSeries, rangeSeries ];
        // it should not return info on the eventSeries
        expect( JSON.stringify(chart.getAllSeries()) ).toEqual( JSON.stringify([lineSeries, rangeSeries]) );
    });

    it('should add series', function() {
        spyOn( chart.chart, 'addSeries' );
        chart.addSeries();
        expect( chart.chart.addSeries ).toHaveBeenCalled();
    });

    it('should add, remove, and hide/show spacecraft events', function() {
        // mock the highstock addSeries function, and some series methods
        chart.chart.addSeries = function( options ) {
            var highchart = this;
            var seriesObject = options;
            seriesObject.remove = function() {
                highchart.series.splice( highchart.series.indexOf(this), 1 );
            };
            seriesObject.setVisible = function( isVisible ) {
                this.visible = isVisible;
            };
            seriesObject.visible = true;
            seriesObject.options = angular.copy( options );
            this.series.push( seriesObject );
        };

        // the mock chart should start with one series
        expect( chart.chart.series.length ).toBe( 1 );

        // add an event
        var eventDetails = {
            y: 1,
            start: 10,
            end: 14,
            type: {id: 20},
            info: 'hello'
        };
        chart.addEvent( eventDetails, 'brown', 100, 110 );
        var series = chart.chart.series;
        expect( series.length ).toBe( 2 );
        expect( series[1].eventDetails ).toEqual( eventDetails );
        expect( series[1].color ).toBe( 'brown' );
        expect( series[1].name ).toBe( 'Event' );

        // the event should start as visible, as defined by the mock functions above
        expect( series[1].visible ).toBe( true );
        // show event types other than the one we added
        chart.setEventTypeVisibility( [1,2,3,4,5] );
        expect( series[1].visible ).toBe( false );
        // show our event type
        chart.setEventTypeVisibility( [1,2,20] );
        expect( series[1].visible ).toBe( true );

        // now remove it
        chart.removeEvents();
        expect( chart.chart.series.length ).toBe( 1 );
    });

    it('should set extremes', function() {
        spyOn( chart.chart.xAxis[0], 'setExtremes' );

        chart.setExtremes( 10, 20, 15, 16 );
        expect( chart.options.xAxis[0].min ).toBe( 10 );
        expect( chart.options.xAxis[0].max ).toBe( 20 );
        expect( chart.options.navigator.xAxis.min ).toBe( 15 );
        expect( chart.options.navigator.xAxis.max ).toBe( 16 );

        expect( chart.chart.xAxis[0].setExtremes ).toHaveBeenCalled();
    });

    it('should set the chart\'s height', function() {
        chart.setHeight( 2 );
        expect( chart.options.chart.height ).toBe( 2 );

        expect( chart.chart.update ).toHaveBeenCalled();
    });

    it('should enable and disable the navigator', function() {
        chart.setNavigatorEnabled( true );
        expect( chart.options.navigator.enabled ).toBe( true );
        chart.setNavigatorEnabled( false );
        expect( chart.options.navigator.enabled ).toBe( false );

        expect( chart.chart.update ).toHaveBeenCalled();
    });

    it('should enable and disable the scrollbar', function() {
        chart.setScrollbarEnabled( true );
        expect( chart.options.scrollbar.enabled ).toBe( true );
        chart.setScrollbarEnabled( false );
        expect( chart.options.scrollbar.enabled ).toBe( false );

        expect( chart.chart.update ).toHaveBeenCalled();
    });

    it('should enable and disable data grouping', function() {
        chart.setDataGroupingEnabled( true );
        expect( chart.options.plotOptions.line.dataGrouping.enabled ).toBe( true );
        expect( chart.options.plotOptions.arearange.dataGrouping.enabled ).toBe( true );
        chart.setDataGroupingEnabled( false );
        expect( chart.options.plotOptions.line.dataGrouping.enabled ).toBe( false );
        expect( chart.options.plotOptions.arearange.dataGrouping.enabled ).toBe( false );

        expect( chart.chart.update ).toHaveBeenCalled();
    });

    it('should set the alignment of the legend', function() {
        chart.setLegendAlign( 'aabb' );
        expect( chart.options.legend.align = 'aabb' );

        expect( chart.chart.update ).toHaveBeenCalled();
    });

    it('should set the zoom type', function() {
        chart.setZoomType( 'xyz' );
        expect( chart.options.chart.zoomType ).toBe( 'xyz' );

        expect( chart.chart.update ).toHaveBeenCalled();
    });

    it('should set the series display mode', function() {
        chart.setSeriesDisplayMode( 'lines' );
        expect( chart.options.plotOptions.line.marker.enabled ).toBe( false );
        expect( chart.options.plotOptions.line.lineWidth ).toBeGreaterThan( 0 );
        chart.setSeriesDisplayMode( 'points' );
        expect( chart.options.plotOptions.line.marker.enabled ).toBe( true );
        expect( chart.options.plotOptions.line.lineWidth ).toBe( 0 );
        chart.setSeriesDisplayMode( 'linesAndPoints' );
        expect( chart.options.plotOptions.line.marker.enabled ).toBe( true );
        expect( chart.options.plotOptions.line.lineWidth ).toBeGreaterThan( 0 );

        expect( chart.chart.update ).toHaveBeenCalled();
    });

    it('should set the visibility of range series', function() {
        chart.setRangeVisibility( true );
        expect( chart.options.plotOptions.arearange.visible ).toBe( true );
        chart.setRangeVisibility( false );
        expect( chart.options.plotOptions.arearange.visible ).toBe( false );

        expect( chart.chart.update ).toHaveBeenCalled();
    });

    it('should set and disable y-axis limit bands', function() {
        // mock a color theme
        chart.colorTheme = {
            limits: {
                bands: {
                    warn: 'warn',
                    bad: 'bad'
                }
            }
        };

        // set limit bands
        chart.setYAxisLimitBands( -2, 2, -1, 1 );
        var bands = chart.options.yAxis[0].plotBands;
        expect( bands.length ).toBe( 4 );
        // yellow low
        expect( [bands[0].color, bands[0].from, bands[0].to] ).toEqual( ['warn', -2, -1] );
        // yellow high
        expect( [bands[1].color, bands[1].from, bands[1].to] ).toEqual( ['warn', 1, 2] );
        // red low
        expect( [bands[2].color, bands[2].from, bands[2].to] ).toEqual( ['bad', -Number.MAX_VALUE, -2] );
        // red high
        expect( [bands[3].color, bands[3].from, bands[3].to] ).toEqual( ['bad', 2, Number.MAX_VALUE] );

        // remove the bands
        chart.disableYAxisLimitBands();
        expect( chart.options.yAxis[0].plotBands ).toEqual( [] );

        expect( chart.chart.yAxis[0].update ).toHaveBeenCalled();
    });

    it('should set the y-axis title', function() {
        chart.setYAxisTitle( 'foo' );
        expect( chart.options.yAxis[0].title.text ).toBe( 'foo' );
        chart.setYAxisTitle( false );
        expect( chart.options.yAxis[0].title.text ).toBe( undefined );

        expect( chart.chart.yAxis[0].update ).toHaveBeenCalled();
    });

    it('should set y-axis scaling', function() {
        // default padding should be zero
        chart.setYAxisScaling( 0, 100 );
        expect( chart.options.yAxis[0].min ).toBe( 0 );
        expect( chart.options.yAxis[0].max ).toBe( 100 );

        // set a custom padding
        chart.setYAxisScaling( 0, 100, 0.02 );
        expect( chart.options.yAxis[0].min ).toBe( -2 );
        expect( chart.options.yAxis[0].max ).toBe( 102 );

        expect( chart.chart.yAxis[0].update ).toHaveBeenCalled();
    });

    it('should set the y-axis scale type', function() {
        chart.setYAxisScaleType( 'linear' );
        expect( chart.options.yAxis[0].type ).toBe( 'linear' );
        // set a bogus value
        chart.setYAxisScaleType( 'monkey' );
        // the scale type should remain the same
        expect( chart.options.yAxis[0].type ).toBe( 'linear' );
        // log scale
        chart.setYAxisScaleType( 'logarithmic' );
        expect( chart.options.yAxis[0].type ).toBe( 'logarithmic' );

        expect( chart.chart.yAxis[0].update ).toHaveBeenCalled();
    });

    it('should set x-axis labels correctly', function() {
        /////// set it to secondsSinceT0
        chart.setXAxisLabels( 'secondsSinceT0' );
        expect( typeof chart.options.xAxis[0].labels.formatter ).toBe( 'function' );
        // the navigator formatter should be the same
        expect( chart.options.navigator.xAxis.labels.formatter ).toBe( chart.options.xAxis[0].labels.formatter );
        // mock the object which is passed to the formatter function
        var formatterParamObj = {
            value: 140020, // 140 seconds
            chart: { xAxis: [{
                getExtremes: function() {
                    return { dataMin: 100000 }; // 100 seconds
                }
            }]}
        };

        // test the formatter function
        expect( chart.options.xAxis[0].labels.formatter.call(formatterParamObj) ).toBe( '+40s' );
        formatterParamObj.value = 100000;
        expect( chart.options.xAxis[0].labels.formatter.call(formatterParamObj) ).toBe( '+0s' );

        /////// test a bogus formatter value
        chart.setXAxisLabels( 'monkey' );
        // the formatter functions should be undefined
        expect( chart.options.xAxis[0].labels.formatter ).toBe( undefined );
        expect( chart.options.navigator.xAxis.labels.formatter ).toBe( undefined );


        /////// set it to raw
        chart.setXAxisLabels( 'raw' );
        expect( typeof chart.options.xAxis[0].labels.formatter ).toBe( 'function' );
        // the navigator formatter should be the same
        expect( chart.options.navigator.xAxis.labels.formatter ).toBe( chart.options.xAxis[0].labels.formatter );
        // raw uses chart.xAxisValueOffset and adds it to the value of the hovered point
        chart.xAxisValueOffset = 22;
        expect( chart.options.xAxis[0].labels.formatter.call(formatterParamObj) ).toBe( formatterParamObj.value + chart.xAxisValueOffset );


        /////// set it to auto
        chart.setXAxisLabels( 'auto' );
        expect( typeof chart.options.xAxis[0].labels.formatter ).toBe( 'function' );
        expect( typeof chart.options.navigator.xAxis.labels.formatter ).toBe( 'function' );

        chart.xAxisValueOffset = 0;
        chart.timezone = 'Zulu';
        chart.momentTimeFormat = 'YYYY-MM-DD';
        // the value of the hovered point is set to 100000, or 100 seconds. This is 1 minute 40 seconds after the unix epoch
        expect( chart.options.xAxis[0].labels.formatter.call(formatterParamObj) ).toBe( '1970-01-01<br>00:01:40' );
        // this formatter should also take the x-axis offset into account
        chart.xAxisValueOffset = -20000;
        expect( chart.options.xAxis[0].labels.formatter.call(formatterParamObj) ).toBe( '1970-01-01<br>00:01:20' );
        // the navigator only shows hours and minutes
        expect( chart.options.navigator.xAxis.labels.formatter.call(formatterParamObj) ).toBe( '00:01' );
        chart.xAxisValueOffset = 1000 * 60 * 60; // 1 hour
        expect( chart.options.navigator.xAxis.labels.formatter.call(formatterParamObj) ).toBe( '01:01' );


        /////// set it to null, which, internally to highstock, uses highstock's own default formatter
        chart.setXAxisLabels( null );
        expect( chart.options.xAxis[0].labels.formatter ).toBe( null );
        expect( chart.options.navigator.xAxis.labels.formatter ).toBe( null );
        // setting it to undefined does the same thing
        chart.setXAxisLabels();
        expect( chart.options.xAxis[0].labels.formatter ).toBe( null );
        expect( chart.options.navigator.xAxis.labels.formatter ).toBe( null );

        expect( chart.chart.update ).toHaveBeenCalled();
    });

    it('should set the x-axis title', function() {
        chart.setXAxisTitle( 'bar' );
        expect( chart.options.xAxis[0].title.text ).toBe( 'bar' );
        chart.setXAxisTitle();
        expect( chart.options.xAxis[0].title.text ).toBe( undefined );

        expect( chart.chart.update ).toHaveBeenCalled();
    });

    it('should enable and disable y-axis crosshairs', function() {
        chart.colorTheme = undefined;
        chart.setYAxisCrosshairEnabled( true );
        expect( chart.options.yAxis[0].crosshair ).toEqual( {snap: false} );
        chart.setYAxisCrosshairEnabled( false );
        expect( chart.options.yAxis[0].crosshair ).toBe( false );
        chart.setYAxisCrosshairEnabled( true );
        expect( chart.options.yAxis[0].crosshair ).toEqual( {snap: false} );

        expect( chart.chart.update ).toHaveBeenCalled();
    });

    it('should set color zones', function() {
        // the function passes the object directly to highcharts series, so we can just test that
        var seriesObj1 = {
            update: function() {}
        };
        var seriesObj2 = {
            update: function() {}
        };
        spyOn( seriesObj1, 'update' );
        spyOn( seriesObj2, 'update' );
        chart.chart.series = [ seriesObj1, seriesObj2 ];
        chart.setSeriesColorZones( 0, 1234 );
        expect( seriesObj1.update ).toHaveBeenCalled();
        chart.setSeriesColorZones( 1, 1234 );
        expect( seriesObj2.update ).toHaveBeenCalled();
    });

    it('should enable and disable the legend', function() {
        chart.setLegendEnabled( true );
        expect( chart.options.legend.enabled ).toBe( true );
        chart.setLegendEnabled( false );
        expect( chart.options.legend.enabled ).toBe( false );
        chart.setLegendEnabled( true );
        expect( chart.options.legend.enabled ).toBe( true );

        expect( chart.chart.update ).toHaveBeenCalled();
    });

    it('should set a spacecraft events overlay', function() {
        chart.colorTheme = ColorThemes.themes.light;

        var eventsData = {};
        eventsData.types = [
            { id: 1, name: 'Orbit', label: 'Orbit' },
            { id: 2, name: 'Perigee', label: 'Perigee' },
            { id: 3, name: 'Apogee', label: 'Apogee' }
        ];
        eventsData.events = [
            { type: eventsData.types[1], start: 1000, end: 1000, y: 1 },
            { type: eventsData.types[0], start: 3000, end: 4000, y: -1 },
            { type: eventsData.types[0], start: 6000, end: 7000, y: -1 },
            { type: eventsData.types[2], start: 0, end: 5000, y: 2 }
        ];

        // show events with type id 1 and 2
        chart.setEventsOverlay( true, eventsData, [1,2] );

        expect( chart.options.yAxis[1].height ).toBe( 32 );
        expect( chart.options.yAxis[1].breaks ).toEqual( [] );
        expect( chart.options.yAxis[1].min ).toBe( 0 );
        expect( chart.options.yAxis[1].max ).toBe( 2 );
        var plotLines = chart.options.xAxis[0].plotLines;
        expect( plotLines.length ).toBe( 1 );
        expect( plotLines[0].value ).toBe( 1000 );
        var plotBands = chart.options.xAxis[0].plotBands;
        expect( plotBands.length ).toBe( 2 );
        expect( [plotBands[0].from, plotBands[0].to] ).toEqual( [3000, 4000] );
        expect( [plotBands[1].from, plotBands[1].to] ).toEqual( [6000, 7000] );

        // show events with type id 1 and 3
        chart.setEventsOverlay( true, eventsData, [1,3] );

        expect( chart.options.yAxis[1].height ).toBe( 32 );
        expect( chart.options.yAxis[1].breaks ).toEqual( [{from:0.99999, to:1.99999}] );
        expect( chart.options.yAxis[1].min ).toBe( 0 );
        expect( chart.options.yAxis[1].max ).toBe( 3 );
        var plotLines = chart.options.xAxis[0].plotLines;
        expect( plotLines.length ).toBe( 0 );
        var plotBands = chart.options.xAxis[0].plotBands;
        expect( plotBands.length ).toBe( 3 );
        expect( [plotBands[0].from, plotBands[0].to] ).toEqual( [3000, 4000] );
        expect( [plotBands[1].from, plotBands[1].to] ).toEqual( [6000, 7000] );
        expect( [plotBands[2].from, plotBands[2].to] ).toEqual( [0, 5000] );

        expect( chart.chart.update ).toHaveBeenCalled();

        // show no events
        chart.setEventsOverlay( false );

        expect( chart.options.yAxis[1].height ).toBe( 0 );
        expect( chart.options.yAxis[1].visible ).toBe( false );
        expect( chart.options.xAxis[0].plotLines ).toEqual( [] );
        expect( chart.options.xAxis[0].plotBands ).toEqual( [] );
        expect( chart.chart.update ).toHaveBeenCalled();
    });

    it('should set options for showing/hiding discrete labels', function() {
        var conversions = [
            [{value:0}, {value:1}, {value:2}]
        ];
        chart.showAllDiscreteLabels( conversions );
        expect( chart.options.yAxis[0].breaks ).toBe( undefined );
        // the padding on each side is a tenth of the total range
        var padding = 0.05 * 2;
        expect( chart.options.yAxis[0].min ).toBe( 0 - padding );
        expect( chart.options.yAxis[0].max ).toBe( 2 + padding );

        var breaks = [
            {from: 1.5, to: 3.5}
        ];
        var usedDiscreteVals = [ 1, 4, 5 ];
        padding = 0.05 * usedDiscreteVals.length;
        chart.hideUnusedDiscreteLabels( breaks, usedDiscreteVals );
        expect( chart.options.yAxis[0].breaks ).toEqual( breaks );
        expect( chart.options.yAxis[0].min ).toBe( 1 - padding );
        expect( chart.options.yAxis[0].max ).toBe( 5 + padding );

        // test data with only one unique y-value
        chart.hideUnusedDiscreteLabels( [], [5] );
        expect( chart.options.yAxis[0].min ).toEqual( 5 );
        expect( chart.options.yAxis[0].max ).toEqual( 5 );

        expect( chart.chart.yAxis[0].update ).toHaveBeenCalled();
    });

    it('should set discrete formatters', function() {
        chart.setDiscreteFormatters( false );
        expect( chart.options.yAxis[0].labels.formatter ).toBe( undefined );
        expect( chart.chart.yAxis[0].update ).toHaveBeenCalled();
        expect( chart.chart.update ).toHaveBeenCalled();

        var conversions = [[
            {value: 0, state: "D1"},
            {value: 1, state: "ENBL", desirability: "GOOD"},
            {value: 2, state: "DSBL", desirability: "BAD"},
            {value: 3, state: "OTHER"},
            {value: 4, state: "UNKNOWN"},
            {value: 5, state: "META", desirability: "CAUTION"},
            {value: 6, state: "E1"},
            {value: 7, state: "E2"},
            {value: 8, state: "E3"}
        ]];

        chart.setDiscreteFormatters( conversions );
        expect( chart.options.yAxis[0].labels.formatter.call({value:0}) ).toBe( 'D1' );
        expect( chart.options.yAxis[0].labels.formatter.call({value:1}) ).toBe( 'ENBL' );
        expect( chart.options.yAxis[0].labels.formatter.call({value:2}) ).toBe( 'DSBL' );
        expect( chart.options.yAxis[0].labels.formatter.call({value:3}) ).toBe( 'OTHER' );
        expect( chart.options.yAxis[0].labels.formatter.call({value:8}) ).toBe( 'E3' );

        expect( chart.chart.yAxis[0].update ).toHaveBeenCalled();
        expect( chart.chart.update ).toHaveBeenCalled();
    });

});

// findIndex polyfill
// https://tc39.github.io/ecma262/#sec-array.prototype.findIndex
Array.prototype.findIndex||Object.defineProperty(Array.prototype,"findIndex",{value:function(r){if(null==this)throw new TypeError('"this" is null or not defined');var e=Object(this),t=e.length>>>0;if("function"!=typeof r)throw new TypeError("predicate must be a function");for(var n=arguments[1],o=0;t>o;){var i=e[o];if(r.call(n,i,o,e))return o;o++}return-1}});
