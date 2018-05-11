'use strict';

function trackerFactory() {

    function LoadingProgressTracker( startTime, endTime, progressCallback, dataType ) {
        this.percent = 0;
        this.kb = 0;
        this.startTime = startTime;
        this.endTime = endTime;
        this.timeRangeIsValid = !isNaN( startTime ) && !isNaN( endTime );
        this.progressCallback = progressCallback || angular.noop;
        this.dataType = dataType || LoadingProgressTracker.dataTypes.dataset; 
        
        // when onProgress is called, the value if 'this' ends up being Window rather than the instance of the
        // LoadingProgressTracker object, which is why we have to use this method to call the prototype method
        var self = this;
        this.onProgress = function( evt ) {
            self.onProgressHandler( evt );
        };
    }

    LoadingProgressTracker.dataTypes = {
        dataset: 1,
        events: 2
    };
    
    LoadingProgressTracker.prototype.onProgressHandler = function( evt ) {
        // Track the total kb loaded
        this.kb = Math.round( evt.loaded / 1024 );
        
        this.percent = null;
        if ( evt.lengthComputable ) {
            // If the server sent the total number of bytes in the request, compute the percent based on that
            this.percent = 100 * evt.loaded / evt.total;
        } else if ( this.timeRangeIsValid ) {
            // If latis doesn't know the total amount of data it will send, we can get the latest timestamp sent
            // and compare that to the range of data that was requested. There can be data gaps or varying data
            // cadences, so this isn't always an accurate representation of the percent of data loaded, but it's
            // better than nothing.
            
            // We need to get the last instance of something that looks like "[1481439764570,". This should be the
            // farthest timestamp loaded so far. There's no function to perform a regex search from the end of a
            // string, and we don't want to perform a regex search on the whole response in order to find only the
            // last match (the response could be on the order of many MB), so we'll search backwards until we find
            // a matching pattern, but we'll limit our search to 10,000 characters.
            
            var responseText = evt.target.responseText; // shorthand
            var responseLength = responseText.length;
            // max index of 0 in case the response is under 10000 characters
            var searchLimit = Math.max( responseLength - 10000, -1 );
            var index = responseLength;
            var match = null;
            
            // search from the end of the string to find '['
            while (
              match == null
              // if '[' is the first character of the string, lastIndexOf will never return -1, despite the value of
              // its second parameter. The condition below catches the case where we're already searched through the
              // entire string
              && index > 0
              // jump to the next instance of '[' closer to the beginning of the string
              && (index = responseText.lastIndexOf('[', index-1)) > searchLimit ) {
                if ( this.dataType === LoadingProgressTracker.dataTypes.dataset ) {
                    // regex search for a string that looks like "[12345," or "[-12345,". Only match at the beginning
                    // of the substring, because by the nature of how we're searching, we've already searched through
                    // the rest of the string.
                    match = responseText.substring( index ).match(/^\[-?\d+,/);
                } else if ( this.dataType === LoadingProgressTracker.dataTypes.events ) {
                    // events data returns arrays with the parameters [id, typeId, startTime, endTime] and we
                    // want to get the value of startTime
                    match = responseText.substring( index ).match(/^\[\d+,\d+,(\d+),/);
                } else {
                    // something wrong... the dataType wasn't set right.
                    return;
                }

            }
            
            if ( match !== null ) {
                var latestTimestamp;
                if ( this.dataType === LoadingProgressTracker.dataTypes.dataset ) {
                    // chop the first and last characters off the string ("[" and ",") and parse it as an integer
                    latestTimestamp = parseInt( match[0].substr( 1, match[0].length-2 ) );
                } else if ( this.dataType === LoadingProgressTracker.dataTypes.events ) {
                    // get the number matched by parens and parse as an int
                    latestTimestamp = parseInt( match[1] );
                    // the latest timestamp can be before the start time if the server returned an event
                    // which started before this.startTime, but ends either during or after our requested time range
                    if ( latestTimestamp < this.startTime ) {
                        latestTimestamp = null;
                    }
                }

                if ( latestTimestamp !== null ) {
                    this.percent = 100 * ( latestTimestamp - this.startTime ) / ( this.endTime - this.startTime );
                }
            }
        }
        
        this.progressCallback();
    };
    
    return LoadingProgressTracker;
}

angular.module( 'laspChart' ).factory( 'LoadingProgressTracker', [ trackerFactory ]);