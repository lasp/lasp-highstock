( function() {
    'use strict';
    
    describe( 'Factory: loading progress tracker', function() {
        
        var tracker;
        var requestStart = 1000;
        var requestEnd = 2000;
        
        beforeEach(angular.mock.module('laspChart'));
        beforeEach( inject( function( $injector, LoadingProgressTracker ) {
            tracker = new LoadingProgressTracker( requestStart, requestEnd );
        }));
        
        it( 'should initialize with proper values', inject( function() {
            expect( [tracker.kb, tracker.percent, tracker.startTime, tracker.endTime] ).toEqual( [0, 0, requestStart, requestEnd] );
        }));
        
        it( 'should report kb loaded (rounded) when the progress handler is called', inject( function() {
            var evt = {
                loaded: 2725,
                target: {
                    responseText: ''
                }
            };
            
            tracker.onProgressHandler( evt );
            expect( tracker.kb ).toBe( Math.round(2725/1024) );
        }));
        
        it ( 'should use total bytes loaded (if available) to calculate percent loaded', inject( function() {
            var evt = {
                loaded: 3,
                lengthComputable: true,
                total: 12
            };
            
            tracker.onProgressHandler( evt );
            expect( tracker.percent ).toBe( 25 );
        }));
        
        it( 'should correctly use the latest timestamp to calculate percent loaded', inject( function() {
            var evt = {
                target: {
                    // start with no valid timestamp in the response
                    responseText: 'abcdefg'
                }
            };
            
            var totalRange = tracker.endTime - tracker.startTime;
            
            tracker.onProgressHandler( evt );
            expect( tracker.percent ).toBe( null );
            
            // test something that looks like a complete response
            evt.target.responseText = '[1500,1,2,3,1.0],'
                +'[1600,1,2,3,1.0]],'
                +'}}';
            tracker.onProgressHandler( evt );
            expect( tracker.percent ).toBe( 100 * (1600-requestStart)/totalRange );
            
            // it should ignore the invalid timestamp (1600a)
            evt.target.responseText = '[1500,1,2,3,1.0],'
                +'[1600a,1,2,3,1.0]],'
                +'}}';
            tracker.onProgressHandler( evt );
            expect( tracker.percent ).toBe( 100 * (1500-requestStart)/totalRange );
            
            // it should accept negative values
            evt.target.responseText = '[-1500,1,2,3,1.0],'
                +'[1600a,1,2,3,1.0]],'
                +'}}';
            tracker.onProgressHandler( evt );
            expect( tracker.percent ).toBe( 100 * (-1500-requestStart)/totalRange );
            
            // it should set percent as null if it doesn't find a valid timestamp
            evt.target.responseText = '[b1500,1,2,3,1.0],'
                +'[1600a,1,2,3,1.0]],'
                +'}}';
            tracker.onProgressHandler( evt );
            expect( tracker.percent ).toBe( null );
            
            // it should ignore a possibly truncated timestamp at the end of the response
            // (it should only search for timestamps that have a following ",")
            
            evt.target.responseText = '[1500,1,2,3,1.0],'
                +'[1600,1,2,3,1.0],'
                +'[170';
            tracker.onProgressHandler( evt );
            expect( tracker.percent ).toBe( 100 * (1600-requestStart)/totalRange );
            
        }));
        
    } );
} )();
