'use strict';

angular.module( 'laspChart' ).factory( 'HighstockOptions', [
    'DatasetTypes',
    'ChartData',
    'Logger',
    function ( DatasetTypes, ChartData, Logger ) {
        
        // create a new class, passing in a highstock adapter (Chart) object
        function HighstockOptions( highstockAdapter ) {
            // create some default options, which don't ever change
            return {
                chart: {
                    animation: false,
                    renderTo: null,
                    resetZoomButton: {
                        theme: {}
                    }
                },
                credits: {
                    enabled: false
                },
                exporting: {
                    enabled: false, // hide the default highcharts exporting menu
                    fallbackToExportServer: false,
                    chartOptions: {
                        legend: {
                            labelFormat: '{name}'
                        }
                    }
                },
                legend: {
                    enabled: false,
                    labelFormatter: function() {
                        var styledSeriesName = '<span style="color:' + this.color + '">' + this.name + '</span>';
                        
                        //if there's no data just return a hyphen (returning nothing can mess with the legend height calculation)
                        if ( typeof this.point === 'undefined' || this.point.series === null ) {
                            return '-';
                        }
                        //Show this for hidden series
                        if ( !this.visible ) {
                            return styledSeriesName + ': disabled';
                        }
                        //This happens when no points are hovered, show name but no value
                        if ( angular.equals(this.point, {}) ) {
                            return styledSeriesName;
                        }

                        var point = this.point;

                        // auto-hide the range series in the legend when it's only showing info on a single full-res data point
                        if ( point.series.name === 'range'
                        && highstockAdapter.callbacks.dataIsFullRes()
                        && ( typeof point.dataGroup !== 'undefined' && point.dataGroup.length === 1 || typeof point.dataGroup === 'undefined' )
                        && point.low === point.high ) {
                            return '-';
                        }

                        if ( !highstockAdapter.showSingleLegendXValue && this.point.series.name !== 'range' ) {
                            // Show an x-value next to each series name in the legend, instead of having one x-value for the entire legend.
                            // But don't show a separate x-value for each range series.
                            var seriesIndex = this.chart.series.indexOf( this.point.series );
                            var xOffset = ChartData.parseOffset( seriesIndex === -1 ? 0 : highstockAdapter.seriesOffsets[ seriesIndex ] );
                            styledSeriesName = highstockAdapter.generateXLegendString( this.point, xOffset ) + ' ' + styledSeriesName;
                        }
                        var conversions = highstockAdapter.callbacks.getTypeConversions();
                        if ( conversions ) {
                            for ( var i = 0; i < conversions[0].length; i++ ) {
                                if ( conversions[0][i].value === point.y ) {
                                    point.stateLabel = conversions[0][i].state;
                                }
                            }
                        }
                        // Sometimes this length can go extremely negative, this checks to make sure its a valid value for .toFixed()
                        var tooltipDecimalLength = ( highstockAdapter.tooltipDecimalLength < 0 ) ? -1 : highstockAdapter.tooltipDecimalLength;
                        var s = styledSeriesName + ': ';

                        if ( typeof point.low !== 'undefined' && point.low !== null && typeof point.high !== 'undefined' && point.high !== null ) {
                            // Make sure the decimals are rounded to the correct precision
                            s += point.low.toFixed( tooltipDecimalLength + 1 )
                                    + ' - '
                                    + point.high.toFixed( tooltipDecimalLength + 1 );
                        } else if ( point.y !== null ) {
                            if ( point.stateLabel ) {
                                s += ' State: ' + point.stateLabel + ' (DN: ' + point.y + ')';
                            } else {
                                if ( point.y.toString().indexOf('e') !== -1 ) { // If scientific notation
                                    // Make sure the decimal is rounded to the correct precision
                                    s += ' ' + point.y.toExponential( tooltipDecimalLength + 1 );
                                } else {
                                    // Make sure the decimal is rounded to the correct precision
                                    s += ' ' + point.y.toFixed( tooltipDecimalLength + 1 );
                                }
                                // if we're not at full resolution, or this value represents a data group, add an indication that this is an average value
                                if ( !highstockAdapter.callbacks.dataIsFullRes() || typeof point.dataGroup !== 'undefined' && point.dataGroup.length > 1 ) {
                                    s += ' (avg)';
                                }
                            }
                        } else {
                            throw "Error: point type unrecognized for legend label formatter: " + point;
                        }
                        
                        return s;
                    },
                    title: {
                        text: ' '
                    },
                    padding: 0,
                    margin: 0,
                    align: 'left',
                    verticalAlign: 'top'
                },
                loading: {
                    enabled: true
                },
                navigator: {
                    adaptToUpdatedData: false,
                    xAxis: {
                        labels: {}
                    }
                },
                plotOptions: {
                    line: {
                        cursor: 'default',
                        dataGrouping: {
                            groupPixelWidth: 1
                        },
                        marker: {
                            radius: 2
                        }
                    },
                    arearange: {
                        cursor: 'default',
                        fillOpacity: 0.35,
                        lineWidth: 0,
                        dataGrouping: {
                            groupPixelWidth: 1
                        }
                    },
                    polygon: {
                        // polygon is used for events
                        cursor: 'pointer',
                        linecap: 'square',
                        showInLegend: false,
                        yAxis: 1
                    },
                    series: {
                        connectNulls: false,
                        softThreshold: false,
                        states: {
                            hover: {
                                enabled: false
                            }
                        },
                        cursor: 'pointer',
                        events: {
                            click: function() {
                                // when click event is defined for plotOptions.series, the click event doesn't fire for plotOptions.[anythingElse],
                                // so we have to check for different series types here
                                if ( this.options.type === 'polygon' ) {
                                    highstockAdapter.callbacks.onSpacecraftEventClick( this.options.eventDetails );
                                } else {
                                    highstockAdapter.callbacks.onSeriesClick( this.options.url );
                                }
                            }
                        },
                        dataGrouping: {
                            // The units are mostly the same as the defaults, except without 'week' and a few more values thrown in.
                            // The extra values make it so that the actual pixel width of each group will be closer to 1 more often than otherwise.
                            units: [
                            [ 'millisecond', [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500] ],
                            [ 'second', [1, 2, 4, 5, 10, 15, 20, 30] ],
                            [ 'minute', [1, 2, 4, 5, 10, 15, 20, 30] ],
                            [ 'hour', [1, 2, 3, 4, 6, 8, 12] ],
                            [ 'day', [1, 2, 3, 4, 5, 7, 10, 15] ],
                            [ 'month', [1, 2, 3, 4, 6] ],
                            [ 'year', null ]
                            ]
                        }
                    }
                },
                rangeSelector: {
                    enabled: false,
                    inputEnabled: false
                },
                scrollbar: {
                    liveRedraw: false
                },
                title: {
                    text: ''
                },
                xAxis: [{
                    type: 'datetime',
                    startOnTick: false,
                    endOnTick: false,
                    title: {},
                    labels: {
                        staggerLines: 1,
                        step: 1
                    },
                    events: {
                        afterSetExtremes: function( e ) {
                            Logger.log( 'afterSetExtremes:', e.min, e.max );
                            highstockAdapter.callbacks.onAfterSetExtremes( e.min, e.max );
                        }
                    },
                    minRange: Number.MIN_VALUE,
                    ordinal: false,
                    plotLines: [],
                    plotBands: []
                }],
                yAxis: [{
                    min: null,
                    max: null,
                    height: '100%',
                    opposite: false,
                    plotBands: [],
                    startOnTick: false,
                    endOnTick: false,
                    showLastLabel: true,
                    tickPixelInterval: 45,
                    lineWidth: 1,
                    title: {},
                    labels: {
                        align: 'right',
                        x: -5,
                        y: 4,
                        formatter: function() {
                            /* If we have changed the x-axis since the last time we calculated a max
                            * precision value, we should re-calculate the max starting from 0
                            */
                            if ( highstockAdapter.tooltipDecimalLengthReset === true ) {
                                highstockAdapter.tooltipDecimalLength = 0;
                                highstockAdapter.tooltipDecimalLengthReset = false;
                            }
                            // Change value to a string
                            var str = this.value.toString();
                            // Calculate how many decimal places the string has beyond its .
                            var numDecimals;
                            if ( str.indexOf( "." ) === -1 ) {
                                numDecimals = 0;
                            } else {
                                numDecimals = str.substr( str.indexOf(".") + 1 ).length;
                            }
                            // Only save the most precise number of decimals
                            if ( numDecimals > highstockAdapter.tooltipDecimalLength ) {
                                highstockAdapter.tooltipDecimalLength = numDecimals;
                            }
                            return this.value;
                        }
                    }
                }, {
                    // second y-axis, used for events overlay
                    className: 'events-y-axis',
                    // shade this area to distinguish it from the rest of the plot
                    plotBands: [{
                        className: 'events-plot-band',
                        from: -Infinity,
                        to: Infinity,
                        zIndex: 0
                    }],
                    top: '100%',
                    offset: 0,
                    lineWidth: 1,
                    opposite: false,
                    // Put lower y-values on the top and higher values on the bottom.
                    // This causes the order of labels on the axis to match the order in
                    // the View->EventTypes menu (which is also sorted numerically ascending by event type)
                    reversed: true,
                    labels: {
                        align: 'right',
                        x: -5,
                        y: 13,
                        style: {
                            textOverflow: 'none'
                        }
                    },
                    tickPositioner: HighstockOptions.tickPositionerEveryInteger
                }]
            };
        }

        HighstockOptions.tickPositionerEveryInteger = function ( min, max ) {
            min = Math.floor( min );
            max = Math.ceil( max );
            var ticks = [];
            while (min <= max) {
                ticks.push(min);
                min++;
            }
            return ticks;
        };
        
        return HighstockOptions;

    }
]);

