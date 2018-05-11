'use strict';

describe('Service: ChartData', function () {
    // load the controller's module
    beforeEach(angular.mock.module('laspChart'));
    var constants, LimitTypes;

    it('should be able to set data', inject(function (ChartData, _constants_, _LimitTypes_) {
        constants = _constants_;
        LimitTypes = _LimitTypes_;
        var data = new ChartData();
        data.setData( [[0,1],[1,2],[2,3],[3,4]], ['A','B'], undefined, 'linkurl' );
        
        expect( data.getData() ).toEqual( [[0,1],[1,2],[2,3],[3,4]] );
        expect( data.getXName() ).toBe('A');
        expect( data.getYName() ).toBe('B');
        expect( data.getLinkURL() ).toBe('linkurl');
    }));
    
    it('should properly set data, minmax data, and name given non-default indexes', inject(function (ChartData) {
        var data = new ChartData();
        data.setData( [[0,10,1,500],[0,10,2,600],[0,10,3,700],[0,10,4,800]], ['Val min', 'Val max', 'Val', 'Time'], ['yMin','yMax','y','x'] );
        expect( data.getData() ).toEqual( [[500,1],[600,2],[700,3],[800,4]] );
        expect( data.getXName() ).toBe( 'Time' );
        expect( data.getYName() ).toBe( 'Val' );
        expect( data.getMinMaxData() ).toEqual( [[500,0,10],[600,0,10],[700,0,10],[800,0,10]] );
        
        data.setData( [[0,10,1,500],[0,10,2,600],[0,10,3,700],[0,10,4,800]], ['Val min', 'Val max', 'Val', 'Time'], ['yMin','yMax','y','x'], undefined, 'Custom name' );
        expect( data.getYName() ).toBe( 'Custom name' );
    }));
    
    it('should be able to download data', inject(function (ChartData, $httpBackend) {
        var data = new ChartData();
        var dataFromLatis = [[1412143350000, 0.9, 1, 1.1, 5],
                            [1412143650000,1.9, 2, 2.1, 5],
                            [1412143950000,3.9, 3, 3.1, 5],
                            [1412144250000,-1.1, -1, -0.9, 5]];
        $httpBackend.expectGET( 'latis/accessurl' ).respond( 200, {
            'TST1': {
                'metadata': {
                    'time': {
                        'alias': 'time',
                        'units': 'milliseconds since 1970-01-01',
                        'length': '25',
                        'type': 'text'
                    },
                    'value': {
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
                'data': dataFromLatis
            }
        });
        
        data.downloadData( 'accessurl' );
        $httpBackend.flush();
        expect( data.getData() ).toEqual( dataFromLatis );
        expect( data.getMetadata() ).not.toBe( [] );
        expect( data.getYName() ).toBe( 'TST1' );
    }));

    it('should set and read metadata', inject(function (ChartData) {
        var data = new ChartData();
        data.setMetadata( {
            'time': {
                'alias': 'time',
                'units': 'milliseconds since 1970-01-01',
                'length': '25',
                'type': 'text'
            },
            'value': {
                'long_name': 'Test Data',
                'tlmId': '1',
                'missing_value': '0',
                'limits': {'yellow': {'low': -3, 'high': 3}, 'red': {'low': -4, 'high': 5}},
                'analog_conversions': {
                    'conversion_type': 'UNSEGMENTED',
                    'coefficients': [
                        {'c0': 0.0},
                        {'c1': 0.01},
                        {'c2': 0.0},
                        {'c3': 0.0},
                        {'c4': 0.0},
                        {'c5': 0.0}
                    ]
                }
            },
            'min': {
                 'missing_value': '0'
            },
            'max': {
                'missing_value': '0'
            },
            'count': {}
        });
        expect(data.getMetadata().value.limits.yellow.low).toBe(-3);
    }));

    it('should create color zones for limit violations', inject(function (ChartData) {
        //check mixed red and yellow violations
        var data = new ChartData();
        data.setData([[100, 0, -0.1, 0.1, 300],[200, 1, 0.9, 1.1, 300],[300, -3, -4, -2, 300],[400, 6, 5, 7, 300]] );
        data.setMetadata({
            'Limits': {
                'Red': {
                    'Low': -5,
                    'High': 5
                },
                'Yellow': {
                    'Low': -1,
                    'High': 1
                }
            }
        });
        
        data.checkLimitViolations();
        expect( data.numViolations.yellow ).toBe( 2 );
        expect( data.numViolations.red ).toBe( 1 );
        
        var zones = data.getLimitZones( 1, 2, 3 );
        expect( zones ).toEqual([
            {value: -5, color: 3},
            {value: -1, color: 2},
            {value: 1, color: 1},
            {value: 5, color: 2},
            {color: 3}
        ]);

        //now just yellow violations
        data.setMetadata({
            'Limits': {
                'Red': {
                    'Low': -10,
                    'High': 10
                },
                'Yellow': {
                    'Low': -1,
                    'High': 1
                }
            }
        });

        data.checkLimitViolations()
        expect( data.numViolations.yellow ).toBe( 3 );
        expect( data.numViolations.red ).toBe( 0 );
    }));
    
    it('should properly handle HTTP errors', inject(function (ChartData, $httpBackend) {
        $httpBackend.whenGET( 'latis/proxyTimeoutURL' ).respond( 502, {});
        $httpBackend.whenGET( 'latis/gatewayTimeoutURL' ).respond( 504, {});
        $httpBackend.whenGET( 'latis/miscErrorURL' ).respond( 500, 'some error' );
        $httpBackend.whenGET( 'latis/goodURL' ).respond( 200, {});
        
        var data = new ChartData();
        
        data.downloadData( 'proxyTimeoutURL' );
        $httpBackend.flush();
        expect( data.getError().code ).toBe( 'Proxy Timeout' );
        
        data.downloadData( 'gatewayTimeoutURL' );
        $httpBackend.flush();
        expect( data.getError().code ).toBe( 'Gateway Timeout' );
        
        data.downloadData( 'miscErrorURL' );
        $httpBackend.flush();
        expect( data.getError().code ).toBe( 'LaTiS error' );
        expect( data.getError().message ).toBe( 'some error' );
        
        // it should clear the error when it gets a HTTP 200 or right before requesting data
        data.downloadData( 'goodURL' );
        expect( data.getError() ).toEqual( false );
        $httpBackend.flush();
        expect( data.getError() ).toEqual( false );
    }));
    
    it('should correctly calculate y-axis breaks for discrete data', inject(function (ChartData) {
        var data = new ChartData();
        
        data.setData([ [100, 2, "DSBL"], [200, 2, "DSBL"] ] );
        // should be no breaks
        expect( data.getYAxisBreaks() ).toEqual( [] )
        expect( data.getUsedDiscreteVals() ).toEqual( [2] );
        
        data.setData([ [100, 2, "DSBL"], [200, 1, "ENBL"], [300, 2, "DSBL"] ] );
        // should still be no breaks
        expect( data.getYAxisBreaks() ).toEqual( [] );
        expect( data.getUsedDiscreteVals() ).toEqual( [1,2] );
        
        data.setData([ [100, 2, "DSBL"], [200, 0, "ENBL"], [300, 2, "DSBL"] ] );
        // should be one break
        expect( data.getYAxisBreaks() ).toEqual([
            { from: 0.5, to: 1.5 }
        ]);
        expect( data.getUsedDiscreteVals() ).toEqual( [0,2] );
        
        data.setData([ [0, 6, "B"], [100, 2, "DSBL"], [200, 0, "ENBL"], [300, 2, "DSBL"], [400, 3, "A"] ] );
        // should be two breaks
        expect( data.getYAxisBreaks() ).toEqual([
            { from: 0.5, to: 1.5 },
            { from: 3.5, to: 5.5 }
        ]);
        expect( data.getUsedDiscreteVals() ).toEqual( [0,2,3,6] );
    }));
    
    it('should correctly generate data gaps', inject(function (ChartData) {
        var data = new ChartData();
        data.setData( [ [1,0,0,0], [2,0,0,0], [3,0,0,0], [4,0,0,0] ] );
        // it should insert a null point if the middle interval is at least n times the length of each of its adjacent intervals, n being the parameter passed to generateDataWithGaps
        /* Test the following situations. Each @ represents a point, and the spacing between them represents the relative x-value distance between the points.
         * Situation number 3 should be the only one to generate a gap, because all other situations could potentially be from a change of cadence in the data measurements
         * 1. @ @ @ @
         * 2. @   @ @ @
         * 3. @ @   @ @
         * 4. @ @ @   @
         * 5. @   @   @ @
         * 6. @   @ @   @
         * 7. @ @   @   @
         */
        
        // 1.
        data.generateDataWithGaps( 1.5 );
        // there should be no gaps in the above data
        expect( data.dataWithGaps ).toEqual( data.data );
        
        // 2.
        data.setData( [ [10,0,0,0], [30,0,0,0], [40,0,0,0], [50,0,0,0] ] );
        data.generateDataWithGaps( 1.5 );
        expect( data.dataWithGaps ).toEqual( data.data );
        
        // 3.
        data.setData( [ [10,0,0,0], [20,0,0,0], [40,0,0,0], [50,0,0,0] ] );
        data.generateDataWithGaps( 1.5 );
        // it should have inserted one null
        expect( data.dataWithGaps ).toEqual( [ [10,0,0,0], [20,0,0,0], [30,null], [40,0,0,0], [50,0,0,0] ] );
        
        // 4.
        data.setData( [ [10,0,0,0], [20,0,0,0], [30,0,0,0], [50,0,0,0] ] );
        data.generateDataWithGaps( 1.5 );
        expect( data.dataWithGaps ).toEqual( data.data );
        
        // 5.
        data.setData( [ [10,0,0,0], [30,0,0,0], [50,0,0,0], [60,0,0,0] ] );
        data.generateDataWithGaps( 1.5 );
        expect( data.dataWithGaps ).toEqual( data.data );
        
        // 6.
        data.setData( [ [10,0,0,0], [30,0,0,0], [40,0,0,0], [60,0,0,0] ] );
        data.generateDataWithGaps( 1.5 );
        expect( data.dataWithGaps ).toEqual( data.data );
        
        // 7.
        data.setData( [ [10,0,0,0], [20,0,0,0], [40,0,0,0], [60,0,0,0] ] );
        data.generateDataWithGaps( 1.5 );
        expect( data.dataWithGaps ).toEqual( data.data );
        
        // if I set the gap threshold too high, it should not insert a gap. This is example #3 from above, where it did previously insert a gap
        data.setData( [ [10,0,0,0], [20,0,0,0], [40,0,0,0], [50,0,0,0] ] );
        data.generateDataWithGaps( 3 );
        expect( data.dataWithGaps ).toEqual( data.data );
        
        // test a longer data array with one gap
        var dataArray = [ [10,0,0,0], [20,0,0,0], [30,0,0,0], [40,0,0,0], [70,0,0,0], [80,0,0,0], [90,0,0,0], [100,0,0,0] ];
        data.setData( dataArray.slice() );
        data.generateDataWithGaps( 1.5 );
        // manually insert a null point in the original array, where we expect it to be after generating gaps
        dataArray.splice( 4, 0, [55,null] );
        expect( data.dataWithGaps ).toEqual( dataArray );
        
        // test a data array with a couple gaps
        dataArray = [ [10,0,0,0], [20,0,0,0], [40,0,0,0], [50,0,0,0], [60,0,0,0], [80,0,0,0], [90,0,0,0], [100,0,0,0] ];
        data.setData( dataArray.slice() );
        data.generateDataWithGaps( 1.5 );
        // manually insert null points in the original array, where we expect them to be after generating gaps
        dataArray.splice( 5, 0, [70,null] );
        dataArray.splice( 2, 0, [30,null] );
        expect( data.dataWithGaps ).toEqual( dataArray );
        
        // test a data array with a change of cadence. There should be no gaps inserted
        data.setData( [ [10,0,0,0], [20,0,0,0], [30,0,0,0], [40,0,0,0], [140,0,0,0], [240,0,0,0], [340,0,0,0], [440,0,0,0] ] );
        data.generateDataWithGaps( 1.5 );
        expect( data.dataWithGaps ).toEqual( data.data );
    }));
    
    it('should find the data\'s time range', inject(function (ChartData) {
        var data = new ChartData();
        data.setData( [[1,0],[2,0],[3,400],[4,23],[10,0]] );
        expect( data.getXRange() ).toEqual({
            start: 1,
            end: 10
        });
    }));
});