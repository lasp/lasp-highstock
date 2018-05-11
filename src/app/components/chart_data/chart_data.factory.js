'use strict';

function chartData( constants, backend, LimitTypes, $q ) {

    function Data() {
        this.resetVariables();
    }
    
    // static function. Takes an array of data and finds the unique y-values.
    // getValueFunc is passed an element of the data array, and should return the y-value
    Data.findUniqueVals = function( data, getValueFunc ) {
        // search through the data and find which values are present
        // this function would technically work fine on analog data but there is currently no use case for that 
        var valKeys = {};
        data.forEach( function(point) {
            valKeys[ getValueFunc(point) ] = true;
        });
        // the values of the keys in valKeys now are associated with the unique y-values found in the data.
        return Object.keys( valKeys ).map( function(val) {
            return parseInt( val );
        }).sort(function(a,b) {
            return a-b;
        });
    };
    
    // static function. Takes an array of unique values and outputs where the y-axis breaks should be for discrete data.
    Data.calculateYAxisBreaks = function( uniqueVals ) {
        // ensure the array is sorted numerically
        uniqueVals.sort( function(a,b) {
            return a-b;
        });
        // discrete values are always integers. Create breaks that start and end between integers (at n.5).
        // this chops out the unused values while keeping the labels we want to see, and retaining an even spacing on the axis between the used values
        var yAxisBreaks = [];
        if ( uniqueVals.length > 1 ) {
            // the loop below intentionally starts at 1 instead of 0 because we need to refer to i-1
            for ( var i = 1; i < uniqueVals.length; i++ ) {
                // place an axis break between the values defined at i-1 and i
                // don't add an axis break if the values are consecutive integers
                if ( uniqueVals[i-1] + 1 === uniqueVals[i] ) {
                    continue;
                }
                yAxisBreaks.push({
                    from: uniqueVals[i-1] + 0.5,
                    to: uniqueVals[i] - 0.5
                });
            }
        }
        return yAxisBreaks;
    };
    
    // Parse an offset value into a number. The offset value can be either a number or a string (representing a time duration).
    Data.parseOffset = function( offsetVal ) {
        if ( typeof offsetVal === 'undefined' ) {
            return 0;
        } else if ( typeof offsetVal === 'number' ) {
            return offsetVal;
        } else {
            offsetVal = offsetVal.split(' ');
            var scalar = parseFloat( offsetVal[0] );
            var period = offsetVal[1];
            return moment.duration( scalar, period ).asMilliseconds();
        }
    };
    
    Data.prototype = {
        resetVariables: function() {
            this.rawData = [];              // the data as given to the setData function
            
            this.data = [];                 // data representing [x,y] values
            this.dataWithGaps = [];
            this.minMaxData = [];           // data representing [x,yMin,yMax] values
            this.minMaxDataWithGaps = [];
            this.minMaxDataCreatedFromLine = false;
            
            this.xName = '';
            this.yName = '';
            this.url = '';
            this.offset = 0;
            
            this.isFullResolution = undefined;
            this.numViolations = {
                red: undefined,
                yellow: undefined
            };
            this.metadata = [];
            this.seriesTypes = [];
            
            this.typeConversions = [];
            this.usedDiscreteVals = undefined;
            this.yAxisBreaks = undefined;
            
            this.error = false;
            this.gapThreshold = undefined;
            this.xRange = undefined;
            
            this.xIndex = -1;
            this.yIndex = -1;
            this.yMinIndex = -1;
            this.yMaxIndex = -1;
        },
        /**
         * @ngdoc method
         * @name setData
         * @methodOf chartData
         * @description
         * Initializes the chartData object with data and variable names. The data can represent a line series, a min/max series, or both a line and min/max series.
         * 
         * @param {array} data An array of points. Each point is an array of numbers. I.e., `[[2,50],[3,54],[4,40]]`.
         *      For a line series, two values must be given for each point (`x` and `y`).
         *      For a min/max series, three values must be given for each point (`x`, `yMin`, and `yMax`).
         *      For a line & min/max series, four values must be given for each point (`x`, `y`, `yMin`, and `yMax`).
         *      The order of the values in each point does not matter, since it can be defined by the `indexes` parameter, however, the order must be the same for each point.
         * @param {array} [parameterNames] The names of the parameters, given in the same order as the values in each data point. I.e. `['Time', 'Temperature']`.
         * @param {array} [indexes=['x','y','yMin','yMax']] A definition of which values in each data point represent `x`, `y`, `yMin`, or `yMax`, given in the same order as the values in each data point.
         *      For example, if each data point contains `[min_temp, max_temp, avg_temp, time]`, you would define `indexes` as `['yMin', 'yMax', 'y', 'x']`.
         *      If left undefined, chartData assumes you're providing both a line and min/max series if each data point contains at least four values,
         *      and if each data point contains less than four values, it assumes you're providing a line series.
         *      If you're providing only a min/max series, you must define the `indexes` parameter.
         *      Note that this parameter allows you to ignore values passed in the data. If each data point contains `[time, temperature, pressure]` and you only want to plot
         *      time vs. pressure, you can define `indexes` as `['x', null, 'y']`.
         * @param {string} [linkURL] The URL to open when a series is clicked.
         * @param {string} [name] The name of the series. If left undefined, the name of the series is the value in `parameterNames` which corresponds to the index of `y` in `indexes`.
         *      For example, if `parameterNames` equals `['Time', 'Temperature']` and `indexes` equals `['x', 'y']`, then the series name is `Temperature`.
         *      This is the only way to set the series name for min/max series, since a min/max series doesn't define a `y` value.
         * @param {number} [offset=0] The x-offset that this dataset has or is expected to have compared to the plot's main x-range. For example, if the plot's main x-range is [10,20], and
         *      this dataset has a known or expected x-range of [110,120], the xOffset would be 100.
         *      The offset can be a numeric value, or a string representing a moment duration, formatted like below:
         *      '[s] [p]' : where [s] is a scalar, and [p] is a period of time--one of ['s','m','h','d','y'], representing [seconds,minutes,hours,days,years].
         */
        setData: function( data, parameterNames, indexes, linkURL, name, offset ) {
            this.resetVariables();
            this.rawData = data;
            this.offset = offset || 0;
            
            if ( data.length > 0 && data[0].length < 2 ) {
                throw 'Each data point must contain at least two values';
            }
            
            parameterNames = parameterNames || [];
            
            // if indexes is undefined, assume that the values of each data point are [x, y, yMin, yMax]
            if ( typeof indexes === 'undefined' ) {
                this.xIndex = 0,
                this.yIndex = 1;
                if ( data.length > 0 && data[0].length >= 4 ) {
                    this.yMinIndex = 2;
                    this.yMaxIndex = 3;
                }
            } else {
                // indexes must contain x,y or x,yMin,yMax, or x,y,yMin,yMax
                this.xIndex = indexes.indexOf('x');
                this.yIndex = indexes.indexOf('y');
                this.yMinIndex = indexes.indexOf('yMin');
                this.yMaxIndex = indexes.indexOf('yMax');
                if ( this.xIndex === -1 ) {
                    throw 'The index for x values must be defined';
                } else if ( this.yIndex + this.yMinIndex + this.yMaxIndex === -3 // none were defined
                        || this.yIndex === -1 && (this.yMinIndex === -1 || this.yMaxIndex === -1) ) {// yIndex isn't defined, and both min/max are not defined
                    throw 'At least the y index, or the yMin index and yMax index, must be defined';
                }
            }
            
            // Manipulate the x-value data if the offset is not 0.
            // This is done to put the dataset on the same x-axis and in the same range as the other datasets.
            var offsetVal = Data.parseOffset( this.offset );
            if ( offsetVal !== 0 ) {
                for ( var i = 0; i < this.rawData.length; i++ ) {
                    if ( typeof this.rawData[i][this.xIndex] === 'number' ) {
                        this.rawData[i][this.xIndex] -= offsetVal;
                    }
                }
            }
            
            // determine what kind of series this data contains
            if ( this.yIndex !== -1 ) {
                this.seriesTypes.push( 'line' );
            }
            if ( this.yMinIndex !== -1 && this.yMaxIndex !== -1 ) {
                this.seriesTypes.push( 'arearange' );
            }
            
            this.xName = parameterNames[this.xIndex];
            this.yName = name || parameterNames[this.yIndex];
            this.url = linkURL;
        },
        getLinkURL: function() {
            return this.url;
        },
        getData: function() {
            // return data that looks like [x,y] for each point
            var i;
            // generate the array if needed
            if ( this.data.length < 1 ) {
                if ( this.xIndex === 0 && this.yIndex === 1 ) {
                    this.data = this.rawData;
                } else {
                    for ( i = 0; i < this.rawData.length; i++ ) {
                        this.data[i] = [ this.rawData[i][this.xIndex], this.rawData[i][this.yIndex] ];
                    }
                }
            }
            return this.data;
        },
        getSeriesTypes: function() {
            return this.seriesTypes;
        },
        getError: function() {
            return this.error;
        },
        downloadData: function( accessURL, cancel, progressHandler, indexes, offset ) {
            // Generally, javascript callbacks, like here the $http.get callback,
            // change the value of the "this" variable inside it
            // so we need to keep a reference to the current instance "this" :
            this.error = false;
            var self = this;
            return backend.get( accessURL, cancel, progressHandler ).then( function( response ) {
                for ( var key in response.data ) {
                    if ( response.data.hasOwnProperty( key ) ) {
                        self.setData( response.data[key].data, response.data[key].parameters, indexes, undefined, undefined, offset );
                        var yName = self.yName;
                        var xName = self.xName;
                        
                        var metadata = response.data[key].metadata;
                        var tempMetadata;
                        // format metadata from the server
                        if ( typeof metadata !== 'undefined' && typeof metadata[yName] !== 'undefined' ) {
                            tempMetadata = {
                                Name: yName,
                                Description: ( metadata[yName].long_name ? metadata[yName].long_name : undefined ),
                                IndependentVariable: {
                                    Name: xName,
                                    Alias: ( metadata[xName] && metadata[xName].alias ? metadata[xName].alias : undefined ),
                                    Units: ( metadata[xName] && metadata[xName].units ? metadata[xName].units : undefined ),
                                    Length: ( metadata[xName] && metadata[xName].length ? metadata[xName].length : undefined ),
                                    Type: ( metadata[xName] && metadata[xName].type ? metadata[xName].type : undefined )
                                },
                                Info: {
                                    tlmID: ( metadata[yName].tlmId ? metadata[yName].tlmId : undefined ),
                                    Alias: ( metadata[yName].alias ? metadata[yName].alias : undefined ),
                                    Units: ( metadata[yName].units ? metadata[yName].units : undefined )
                                }
                            };

                            // If limits exist, add Limits to the metadata object
                            if( metadata[yName].limits ) {
                                tempMetadata.Limits = {
                                        Yellow: {
                                            Low: metadata[yName].limits.yellow.low,
                                            High: metadata[yName].limits.yellow.high
                                        },
                                        Red: {
                                            Low: metadata[yName].limits.red.low,
                                            High: metadata[yName].limits.red.high
                                        }
                                    };
                            }
                            // If analog conversions exist, add to the metadata object
                            if( typeof metadata[yName].state_conversions !== 'undefined' ) {
                                // sort conversions by ascending numeric value
                                metadata[yName].state_conversions.sort( function(a,b) {
                                    return a.value - b.value;
                                });
                                self.typeConversions = metadata[yName].state_conversions;
                                tempMetadata['State Conversions'] = metadata[yName].state_conversions;
                            }
                            
                            self.setMetadata( tempMetadata );
                        }
                        
                        break;
                    }
                }
            }, function( response ) {
                var helptext = 'If the server is busy, please try again. If this problem persists, please contact webtcad.support@lasp.colorado.edu';
                if ( response.status === 502 ) {
                    self.error = {
                        message: 'Error 502: Proxy Timeout. ' + helptext,
                        code: 'Proxy Timeout'
                    };
                } else if ( response.status === 504 ) {
                    self.error = {
                        message: 'Error 504: Gateway Timeout. ' + helptext,
                        code: 'Gateway Timeout'
                    };
                } else if ( response.status === -1 ) {
                    // See this on status code -1: https://stackoverflow.com/questions/43666937/what-are-the-angular-http-request-status-codes-0-and-1
                    self.error = {
                        message: 'Error: unable to send HTTP request',
                        code: 'Request Failed'
                    };
                } else {
                    self.error = {
                        message: response.data ? response.data : 'Error: unknown',
                        code: 'LaTiS error'
                    };
                }
                self.error.status = response.status;
                // return a rejected promise so that further chained promise handlers will correctly execute the error handler
                return $q.reject( self );
            });
        },
        getTypeConversions: function() {
            return this.typeConversions;
        },
        getXName: function() {
            return this.xName;
        },
        getXNameAndUnits: function() {
            var returnVal = this.xName;
            try {
                if ( typeof this.metadata.IndependentVariable.Units !== 'undefined' ) {
                    returnVal += ' (' + this.metadata.IndependentVariable.Units + ')';
                }
            } catch ( e ) {
                // some part of this.metadata.Info was undefined. Just continue and return only the name.
            }
            return returnVal;
        },
        getYName: function() {
            return this.yName;
        },
        getYNameAndUnits: function() {
            var returnVal = this.yName;

            try {
                if ( typeof this.metadata.Info.Units !== 'undefined' ) {
                    returnVal += ' (' + this.metadata.Info.Units + ')';
                }
            } catch ( e ) {
                // some part of this.metadata.Info was undefined. Just continue and return only the name.
            }

            return returnVal;
        },
        getDescription: function() {
            return this.description;
        },
        getMetadata: function() {
            return this.metadata;
        },
        setMetadata: function(meta) {
            this.metadata = meta;
        },
        getXRange: function() {
            if ( this.rawData.length === 0 ) return;
            if ( !this.xRange ) {
                // get the minimum and maximum times contained in the data
                this.xRange = {
                    start: this.rawData[0][this.xIndex],
                    end: this.rawData[this.rawData.length-1][this.xIndex]
                };
            }
            return this.xRange;
        },
        getMinMaxData: function() {
            // return data that looks like [x,yMin,yMax] for each point
            var i;
            // generate the array if needed
            if ( this.minMaxData.length < 1 ) {
                if ( this.xIndex === 0 && this.yMinIndex === 1 && this.yMaxIndex === 2 ) {
                    this.minMaxData = this.rawData;
                } else {
                    for ( i = 0; i < this.rawData.length; i++ ) {
                        this.minMaxData[i] = [ this.rawData[i][this.xIndex], this.rawData[i][this.yMinIndex], this.rawData[i][this.yMaxIndex] ];
                    }
                }
            }
            return this.minMaxData;
        },
        getDataWithGaps: function( threshold ) {
            this.generateDataWithGaps( threshold );
            return this.dataWithGaps;
        },
        getMinMaxDataWithGaps: function( threshold ) {
            this.generateDataWithGaps( threshold );
            return this.minMaxDataWithGaps;
        },
        generateDataWithGaps: function( threshold ) {
            
            // if the threshold parameter that was passed is the same as it was last time, don't bother recalculating all this
            if ( threshold === this.gapThreshold ) {
                return;
            }
            
            this.gapThreshold = threshold;
            
            // run the getData and getMinMaxData methods so those arrays are generated, if they haven't been generated already
            this.getData();
            this.getMinMaxData();
            
            if ( this.rawData.length < 4 ) {
                // if the array is this short, there's not enough info to calculate where gaps are
                this.dataWithGaps = this.data;
                this.minMaxDataWithGaps = this.minMaxData;
                return;
            }
            
            // leave the original data arrays alone, and generate new data arrays
            this.dataWithGaps = [];
            this.minMaxDataWithGaps = [];
            
            // loop through the data array to find where gaps should be inserted, and insert null points into data and minMaxData
            // If the interval between two points is significantly greater than both of the adjacent intervals, then insert a null point in that interval.
            // End the loop 3 short of the end of the array, because we need to look at three intervals at a time, which involves 4 points at a time (looking 3 points ahead).
            var interval1, interval2, interval3;
            
            for ( var i = 0; i < this.rawData.length -3; i++ ) {
                if ( typeof interval1 === 'undefined' ) {
                    interval1 = this.rawData[i+1][this.xIndex] - this.rawData[i][this.xIndex];
                    interval2 = this.rawData[i+2][this.xIndex] - this.rawData[i+1][this.xIndex];
                } else {
                    // reuse a couple of the intervals that we calculated last time
                    // as we move one step to the right, intervals 2  and 3 from last time become intervals 1 and 2, respectively
                    interval1 = interval2;
                    interval2 = interval3;
                }
                interval3 = this.rawData[i+3][this.xIndex] - this.rawData[i+2][this.xIndex];
                
                // push the second point out of the four we're looking at onto the new arrays
                // we might insert a null between the 2nd and 3rd points, so we don't want to insert the 3rd or 4th points yet (we will at the next loop iteration)
                this.dataWithGaps.push( this.data[i+1] );
                this.minMaxDataWithGaps.push( this.minMaxData[i+1] );
                
                // compare the center interval with its adjacent intervals.
                // In order for a gap to appear, the center interval must be larger than threshold times the largest of the adjacent intervals
                if ( interval2 > threshold * Math.max(interval1, interval3) ) {
                    var midpointTimestamp = ( this.rawData[i+1][this.xIndex] + this.rawData[i+2][this.xIndex] ) / 2;
                    this.dataWithGaps.push( [midpointTimestamp, null] );
                    this.minMaxDataWithGaps.push( [midpointTimestamp, null, null] );
                }
            }
            
            // copy the first data point and last two data points to the new array, because they weren't inserted during the loop
            var dataLength = this.rawData.length;
            var minMaxDataLength = this.minMaxData.length;
            this.dataWithGaps.unshift( this.data[0] );
            this.minMaxDataWithGaps.unshift( this.minMaxData[0] );
            this.dataWithGaps.push( this.data[dataLength-2], this.data[dataLength-1] );
            this.minMaxDataWithGaps.push( this.minMaxData[minMaxDataLength-2], this.minMaxData[minMaxDataLength-1] );
        },
        // takes a line series and turns it into a min/max series,
        // with both the min and the max equalling the y-value of the line series.
        // Returns false if the data does not contain a line series, or if it already contains an arearange series.
        // Returns true on success.
        createMinMaxDataFromLine: function() {
            if ( this.seriesTypes.indexOf('line') === -1 || this.seriesTypes.indexOf('arearange') !== -1 || typeof this.rawData[0] === 'undefined' ) {
                return false;
            }
            // alter the raw data, creating min/max data.
            this.yMinIndex = this.rawData[0].length;
            this.yMaxIndex = this.yMinIndex + 1;
            for ( var i = 0; i < this.rawData.length; i++ ) {
                this.rawData[i][this.yMinIndex] = this.rawData[i][this.yMaxIndex] = this.rawData[i][this.yIndex];
            }
            this.minMaxDataCreatedFromLine = true;
            // add the series type, now that we've got a new one
            this.seriesTypes.push( 'arearange' );
        },
        removeMinMaxDataCreatedFromLine: function() {
            if ( this.minMaxDataCreatedFromLine ) {
                // remove the data from rawData
                for ( var i = 0; i < this.rawData.length; i++ ) {
                    delete this.rawData[i][this.yMinIndex];
                    delete this.rawData[i][this.yMaxIndex];
                }
                // Since there's no longer a min/max series, clear any associated data
                this.yMinIndex = -1;
                this.yMaxIndex = -1;
                this.minMaxData = this.minMaxDataWithGaps = [];
                this.seriesTypes.splice( this.seriesTypes.indexOf('arearange'), 1 );
                this.minMaxDataCreatedFromLine = false;
            }
        },
        getLength: function() {
            return this.rawData.length;
        },
        checkLimitViolations: function() {
            var self = this;
            var metadata = this.metadata;
            var redLow = metadata.Limits ? metadata.Limits.Red.Low : undefined;
            var redHigh = metadata.Limits ? metadata.Limits.Red.High : undefined;
            var yellowLow = metadata.Limits ? metadata.Limits.Yellow.Low : undefined;
            var yellowHigh = metadata.Limits ? metadata.Limits.Yellow.High : undefined;

            var state_conversions = ( typeof metadata['State Conversions'] === 'undefined' ) ? null : metadata['State Conversions'];

            // for discrete datasets
            if ( state_conversions ) {
                countLimitViolations( function( point ) {
                    // return a limit type based on if this data point violates any of the defined limits
                    var state_conversion = state_conversions.find( function( state_conversion ) {
                        return state_conversion.value === point[self.yIndex];
                    });
                    
                    if ( !state_conversion ) {
                        return; // no conversion available; return undefined.
                    } else if ( state_conversion.desirability === 'BAD' ) {
                        return LimitTypes.BAD;
                    } else if ( state_conversion.desirability === 'CAUTION' ) {
                        return LimitTypes.WARN;
                    } else {
                        return LimitTypes.GOOD;
                    }
                });
            }
            // for analog datasets
            else if ( typeof redLow !== 'undefined' && typeof redHigh !== 'undefined' && typeof yellowLow !== 'undefined' && typeof yellowHigh !== 'undefined' ) {
                countLimitViolations( function( point ) {
                    var y = point[self.yIndex];
                    var yMin = self.yMinIndex === -1 ? y : point[self.yMinIndex];
                    var yMax = self.yMaxIndex === -1 ? y : point[self.yMaxIndex];

                    // return a limit type based on if this data point violates any of the defined limits
                    if ( yMin > yellowLow && yMax < yellowHigh ) {
                        return LimitTypes.GOOD;
                    }
                    // If the min or max value of the data point is in a yellow limit range, return warning limit violation
                    else if ( (yMin <= yellowLow && yMin > redLow) || (yMax >= yellowHigh && yMax < redHigh) ) {
                        return LimitTypes.WARN;
                    }
                    // If the min or max of the data point is outside red limits, return bad limit violation
                    else if ( yMin <= redLow || yMax >= redHigh ) {
                        return LimitTypes.BAD;
                    }
                });
            }
            
            function countLimitViolations( limitCheckFn ) {
                // count number of limit violations in a dataset.
                // limitCheckFn should take a data point as a parameter and return either LimitTypes.GOOD, LimitTypes.WARN, or LimitTypes.BAD
                //    based on whether that point violates any limits
                //    or return undefined if limit information is not available
                self.numViolations.yellow = 0;
                self.numViolations.red = 0;
                var filteredData = self.rawData.filter( function( point ) { return point[self.yIndex] !== null; });

                filteredData.forEach( function( point ) {
                    var limitState = limitCheckFn( point );
                    switch( limitState ) {
                        case LimitTypes.WARN:
                            self.numViolations.yellow++;
                            break;
                        case LimitTypes.BAD:
                            self.numViolations.red++;
                            break;
                        default: ;
                    }
                });
            }
        },
        getLimitZones: function( greenColor, yellowColor, redColor ) {
            // create y-value color zones that highstock can understand
            var zones = [];
            var stateConversions = this.metadata['State Conversions'];
            if ( typeof this.metadata.Limits !== 'undefined' ) {
                zones = [{
                    // from -Infinity to Red.Low
                    value: this.metadata.Limits.Red.Low,
                    color: redColor
                }, {
                    // from Red.Low to Yellow.Low
                    value: this.metadata.Limits.Yellow.Low,
                    color: yellowColor
                }, {
                    // from Yellow.Low to Yellow.High
                    value: this.metadata.Limits.Yellow.High,
                    color: greenColor
                }, {
                    // from Yellow.High to Red.High
                    value: this.metadata.Limits.Red.High,
                    color: yellowColor
                }, {
                    // from Red.High to Infinity
                    // no "value" means Infinity
                    color: redColor
                }];
            } else if ( typeof stateConversions !== 'undefined' ) {
                // state conversions are already sorted by ascending y-value
                var zoneWidth = 0.05;
                stateConversions.forEach( function(conversion) {
                    var color = conversion.desirability === 'GOOD' ? greenColor :
                                conversion.desirability === 'CAUTION' ? yellowColor :
                                conversion.desirability === 'BAD' ? redColor :
                                undefined;
                    if ( color !== undefined ) {
                        // create a zone right around this single value
                        zones.push({
                            // from the previous value to right below this conversion's value
                            value: conversion.value - zoneWidth
                            // no color means default series color
                        });
                        zones.push({
                            // from right below this conversion's value to right above it
                            value: conversion.value + zoneWidth,
                            color: color
                        });
                    }
                });
                zones.push({
                    // from the previous zone definition to Infinity, use the default series color
                    // (this is done by giving it an empty object with no defined color or value)
                });
            }

            return zones;
        },
        checkFullResolution: function() {
            if ( typeof this.isFullResolution === 'undefined' ) {
                // we haven't yet calculated whether the data is full res. Check now.

                this.isFullResolution = true; // true until proven false

                for ( var i = 0; i < this.rawData.length; i++ ) {
                    if ( this.rawData[i][this.yMinIndex] !== this.data[i][this.yMaxIndex] ) {
                        this.isFullResolution = false;
                        break;
                    }
                }
            }
            return this.isFullResolution;
        },
        getYAxisBreaks: function() {
            if ( typeof this.yAxisBreaks === 'undefined' ) {
                this.yAxisBreaks = Data.calculateYAxisBreaks( this.getUsedDiscreteVals() );
            }
            return this.yAxisBreaks;
        },
        getUsedDiscreteVals: function() {
            if ( typeof this.usedDiscreteVals === 'undefined' ) {
                var self = this;
                this.usedDiscreteVals = Data.findUniqueVals( this.rawData, function(element) {
                    return element[self.yIndex];
                });
            }
            return this.usedDiscreteVals;
        }
    };
    return( Data );
}

angular.module( 'laspChart' ).factory( 'ChartData', [ 'constants', 'latis', 'LimitTypes', '$q', chartData ]);