'use strict';

function highstockAdapter( constants, LimitTypes, HighstockOptions, ColorThemes, Logger ) {

    function Chart( renderElement, callbacks ) {
        this.options = new HighstockOptions( this );
        
        this.chart = false;

        this.colorTheme = null;

        this.renderElement = renderElement;
        this.preInitFunc = null;
        this.postInitFunc = null;

        // if false, shows the x-value for each item in the legend
        this.showSingleLegendXValue = true;

        // for offset overplotted items, this enables the x-axis to show offset values
        this.xAxisValueOffset = 0;

        // an array of x-offset values for each series in the chart
        this.seriesOffsets = [];

        this.timezone = null;
        this.momentTimeFormat = null;
        this.labelFormat = null;
        this.legendFormatter = null;

        this.tooltipDecimalLengthReset = null;
        this.tooltipDecimalLength = -Number.MAX_VALUE;

        this.callbacks = angular.merge( {}, {
            // A function which is used to determine whether the chart's data is full resolution. Should return true or false.
            dataIsFullRes: angular.noop,
            // A function used to get the data type conversions. It should return an array of dataArray.typeConversion objects.
            getTypeConversions: angular.noop,
            // A function which is called after highcharts sets the x-axis min and max (usually as a result of user interaction).
            // Takes two arguments, min and max.
            onAfterSetExtremes: angular.noop,
            // A function which is called when the user clicks on a series. Takes one argument, which is the URL associated with the
            // clicked series, or undefined if there is none.
            onSeriesClick: angular.noop,
            // A function which is called when the user clicks on a spacecraft event. Takes one argument, which is an object that
            // contains various properties regarding the event.
            onSpacecraftEventClick: angular.noop
        }, callbacks );
    }

    // utility functions

    // find the min and max values in an entire array
    // getValFunc returns the value to compare, so that if it's an array of objects,
    // we can compare the value of a property of each object in the array
    function arrayMinMax( array, getValFunc ) {
        if ( typeof getValFunc === 'undefined' ) {
            getValFunc = function( arrayElement ) {
                return arrayElement;
            };
        }
        var min = Number.MAX_VALUE;
        var max = -Number.MAX_VALUE;
        // find min and max values of used values
        array.forEach( function(val) {
            min = Math.min( min, getValFunc(val) );
            max = Math.max( max, getValFunc(val) );
        });
        return {
            min: min,
            max: max
        };
    }

    // private methods

    /**
     * An object which contains basic information about a series in a chart.
     * @class
     * @type {Object}
     * @property {string} name The name of the series
     * @property {string} color The color of the series in hex notation
     * @property {string} type The type of the series, i.e. 'line' or 'arearange'
     */
    function ChartSeries( name, type, color, index, userOptions ) {
        this.name = name;
        this.type = type;
        this.color = color;
        this.index = index;
        this.userOptions = userOptions;
    }

    /**
     * Returns whether a highcharts series is in the navigator.
     * @private
     * @param {Series} series A highcharts series object.
     * @returns {boolean} Whether the series is in the navigator.
     */
    function seriesIsInNavigator( series ) {
        return series.name.indexOf( 'Navigator' ) !== -1;
    }

    /**
     * Returns whether a highcharts series represents a spacecraft event.
     * @private
     * @param {Series} series A highcharts series object.
     * @returns {boolean} Whether the series represents a spacecraft event.
     */
    function seriesIsEvent( series ) {
        return series.name === 'Event';
    }
    
    /**
     * Gets the x-axis associated with the navigator. Returns false if no navigator x-axis was found.
     * @private
     * @returns {Object}
     */
    function getNavigatorXAxis() {
        // find which x axis belongs to the navigator
        if ( this.chart.series === undefined ) return false;
        var navigatorSeries = this.chart.series.find( function( series ) {
            return series.name.indexOf( 'Navigator' ) !== -1;
        });
        if ( typeof navigatorSeries !== 'undefined' ) {
            return navigatorSeries.xAxis;
        } else return false;
    }

    function onSetNavigatorOrScrollbar() {
        this.options.navigator.margin = this.options.navigator.enabled ?
            constants.NAVIGATOR_MARGIN :
            this.options.scrollbar.enabled ? 10 : 0;
        // when only the scrollbar is enabled, there's extra space on the bottom (not sure why). Account for this by reducing the spacingBottom.
        this.options.chart.spacingBottom = !this.options.navigator.enabled && this.options.scrollbar.enabled ? 8 : 12;
    }

    /**
     * If the highstock object exists, it gets updated with the options contained in `this.options`.
     * @private
     * @param {boolean} [redraw=true] Whether to trigger a chart redraw.
     */
    function update( options, redraw ) {
        redraw = redraw === undefined ? true : redraw;
        if ( this.chart ) {
            this.chart.update( angular.copy(options), redraw );
        }
    }

    function updateYAxis( options, redraw ) {
        redraw = redraw === undefined ? true : redraw;
        if ( this.chart ) {
            this.chart.yAxis[0].update( angular.copy(options), redraw );
        }
    }

    /**
     * Formats the x-value in the chart's legend. Takes two arguments when data grouping is in effect, or
     * the data is not at full resolution, and one "point" represents a range of x-values. Takes one argument ortherwise.
     * @private
     * @param {number} xVal1 For grouped or binned data, this should be the smallest x-value in the group/bin. For full-res data, this should be the x-value of the point.
     * @param {number} [xVal2] For grouped or binned data, this should be the largest x-value in the group/bin.
     * @returns {string} The formatted x-value text for the legend.
     */
    function legendXValueFormatter ( xVal1, xVal2 ) {
        var self = this;
        
        // if xVal1 is a non-number, show a hyphen 
        xVal1 = ( typeof xVal1 !== 'number' || isNaN(xVal1) ) ? '-' : xVal1; 

        if ( typeof this.legendFormatter === 'function' ) {
            return this.legendFormatter( xVal1, xVal2 );
        }
        
        var legendText;
        if ( this.labelFormat === 'raw' ) {
            // Output the x-axis title, then the value(s)
            legendText = this.options.xAxis[0].title.text + ': ' + xVal1;
            if ( typeof xVal2 !== 'undefined' ) {
                legendText += ' - ' + xVal2;
            }
        } else {
            // if the format is 'auto', null, or undefined
            legendText = ( xVal1 === '-' ) ? '-' : formatXValueAsTime( xVal1 );
            if ( typeof xVal2 !== 'undefined' ) {
                legendText += ' - ' + formatXValueAsTime( xVal2 );
            }
        }
        return legendText;

        function formatXValueAsTime( xVal ) {
            // Output formatted time
            var tempDate = moment.utc( Highcharts.dateFormat('%Y-%m-%dT%H:%M:%S', xVal) );
            tempDate.tz( self.timezone );
            var tzAbbr = tempDate.tz( self.timezone ).zoneAbbr();
            return tempDate.format( self.momentTimeFormat + 'THH:mm:ss') + ' ' + tzAbbr;
        }
    }

    angular.copy({

        /**
         * Initializes the highstock chart.
         * @param {function} [preInitFunc] A function to execute just before the highstock chart is created. Takes one parameter, the configuration object.
         * @param {function} [postInitFunc] A function to execute right after the highstock chart is created. Takes one parameter, the highstock chart object.
         */
        init: function( preInitFunc, postInitFunc ) {
            if ( this.chart ) {
                this.destroy();
            }
            this.preInitFunc = preInitFunc;
            this.postInitFunc = postInitFunc;
            Logger.log('Creating New Stock Chart');

            // the chart uses a reference to the passed options object, and alters a few things here and there,
            // producing unexpected results. We give it a copy of the config object so our config object stays the way we want
            var options = angular.copy( this.options );
            // potentially make custom changes to the options
            if ( preInitFunc ) {
                preInitFunc( options );
            }
            // create the chart
            this.chart = new Highcharts.stockChart( this.renderElement, options, this.postInitFunc );

            // update the tooltip/legend right after the plot is created.
            // Otherwise, the height of the graphic area will change on the first mouseover.
            this.updateTooltip();
            
            // update legend on mousemove
            var self = this;
            angular.element( this.chart.container ).on( 'mousemove' , function(evt) {
                self.updateTooltip();
            });
        },

        /**
         * Destroys the highstock chart object.
         */
        destroy: function() {
            if ( this.chart ) {
                Logger.log('Destroying Chart');
                this.chart.destroy();
                this.chart = false;
            } else {
                Logger.log('No Chart to Destroy');
            }
        },

        /**
         * Adds a series to the highstock chart.
         * @param {array} data The data for the series, formatted according to highcharts API
         * @param {number} chartDataIndex The index in the chartData object that corresponds to the passed data.
         * @param {string} name The name of the series.
         * @param {string} color The color of the series, formatted in hex notation, i.e. '#ff5399'
         * @param {string} [seriesType='line'] The type of the series. Should be 'line' or 'arearange'.
         * @param {boolean} [redraw=true] Whether to trigger a redraw on the chart.
         * @param {string} [url=''] If defined, the browser will visit this URL when the series is clicked.
         */
        addSeries: function( data, chartDataIndex, name, color, seriesType, redraw, url ) {
            seriesType = ( typeof seriesType === 'undefined' ) ? 'line' : seriesType;
            redraw = ( typeof redraw === 'undefined' ) ? true : redraw;
            url = ( typeof url === 'undefined' ) ? '' : url;
            Logger.log('Adding Series to Chart: REDRAW? ' + redraw + ' seriesType? ' + seriesType );
            this.chart.addSeries({
                type: seriesType,
                name: name,
                data: data,
                url: url,
                color: color,
                chartDataIndex: chartDataIndex
            }, redraw );
        },

        /**
         * Gets an array of objects which contain info on each regular series in the chart.
         * (not spacecraft events or series in the navigator).
         * @returns {array} An array of ChartSeries objects.
         */
        getAllSeries: function() {
            // get all series except events and the navigator
            // in other words, get line and arearange series
            var allSeries = [];
            if ( !this.chart ) {
                return [];
            }
            this.chart.series.forEach( function(series, i) {
                if ( !seriesIsInNavigator.call(this,series) && !seriesIsEvent.call(this,series) ) {
                    allSeries.push( new ChartSeries(series.name, series.type, series.color, i, series.userOptions) );
                }
            });
            return allSeries;
        },

        /**
         * Adds a single spacecraft event to the chart.
         * @param {object} event An object describing the event. Contains properties 'y', 'start', 'end', 'type', and 'info'
         * @param {string} color A CSS-style color value.
         * @param {number} [min] A unix timestamp representing the start of the plot's loaded time range.
         * @param {number} [max] A unix timestamp representing the end of the plot's loaded time range.
         */
        addEvent: function( event, color, minTime, maxTime ) {
            if ( !this.chart ) return;

            // It's possible that an event will have a start time which is before the start of the plot's loaded time range,
            // or have an end time which is after the end of the loaded time range. This causes a few bugs.
            // Ensure that the polygon series will only be drawn within the loaded range.
            var xStart = typeof minTime === 'undefined' ? event.start : Math.max( minTime, event.start );
            var xEnd = typeof maxTime === 'undefined' ? event.end : Math.min( maxTime, event.end );
            // Each event type is placed at a different integer y-value.
            // Adjust the y-values so that each event rect takes up almost a height of 1
            var eventThickness = 14/16;
            var halfMargin = ( 1 - eventThickness ) / 2;
            // start by drawing a vertical line. If the event is discrete, this line will be a few pixels wide
            var data = [
                [xStart, event.y + halfMargin],
                [xStart, event.y + 1-halfMargin]
            ];
            
            // if the event has a duration, draw a rectangle instead of a line. Add a couple more points to make it a rectangle.
            if ( event.end !== event.start ) {
                data.push(
                    [xEnd, event.y + 1-halfMargin],
                    [xEnd, event.y + halfMargin]
                );
            }
            Logger.log( 'Adding event to chart', event );
            this.chart.addSeries({
                eventDetails: event, // store event details for the modal that pops up when the event is clicked on
                lineWidth: event.start === event.end ? 3 : 1, // thick line for instantaneous events, rectangle with thin lines otherwise
                color: color,
                type: 'polygon',
                data: data,
                name: 'Event'
            }, false );
        },

        /**
         * Removes all spacecraft events from the chart.
         * @param {boolean} [redraw=true] Whether to trigger a chart redraw.
         */
        removeEvents: function( redraw ) {
            redraw = redraw === undefined ? true : redraw;
            if ( !this.chart ) return;
            Logger.log( 'Removing all events from chart' );
            this.chart.series.forEach( function(series) {
                if ( seriesIsEvent.call(this,series) ) {
                    series.remove( false );
                }
            });
            if ( redraw ) {
                this.chart.redraw();
            }
        },

        /**
         * Sets the visibility of specific event types.
         * @param {array} eventTypesToView An array of ID numbers representing event types which will be shown. All others will be hidden.
         * @param {boolean} [redraw=true] Whether to trigger a chart redraw.
         */
        setEventTypeVisibility: function( eventTypesToView, redraw ) {
            redraw = redraw === undefined ? true : redraw;
            if ( !this.chart ) {
                return;
            }
            Logger.log( 'Setting event type visibility', eventTypesToView );
            // for each events series, if the event type is in the list of eventTypesToView, show it. Otherwise, hide it.
            this.chart.series.forEach( function(series) {
                if ( seriesIsEvent.call(this,series) ) {
                    var eventTypeId = series.options.eventDetails.type.id;
                    series.setVisible( eventTypesToView.indexOf(eventTypeId) !== -1, false );
                }
            });
            if ( redraw ) {
                this.chart.redraw();
            }
        },


        /**
         * Sets the extremes for the x-axis and the navigator x-axis.
         * If the x-axis represents time, the passed values should be Unix timestamps. 
         * @param {number} min The minimum x-axis value to show.
         * @param {number} max The maximum x-axis value to show.
         * @param {number} navigatorMin The minimum x-axis value to show in the navigator.
         * @param {number} navigatorMax The maximum x-axis value to show in the navigator.
         * @param {boolean} [redraw=true] Whether to trigger a chart redraw.
         */
        setExtremes: function( min, max, navigatorMin, navigatorMax, redraw ) {
            redraw = redraw === undefined ? true : redraw;
            Logger.log('New Extremes Set. Min: ' + min + ' Max: ' + max + ' Navmin: ' + navigatorMin + ' Navmax: ' + navigatorMax );
            
            // update regular xAxis extremes
            this.options.xAxis[0].min = min;
            this.options.xAxis[0].max = max;
            this.chart.xAxis[0].setExtremes( min, max, false );
            
            // update the nav extremes
            this.options.navigator.xAxis.min = navigatorMin;
            this.options.navigator.xAxis.max = navigatorMax;
            var navXAxis = getNavigatorXAxis.call( this );
            if ( navXAxis ) {
                navXAxis.setExtremes( navigatorMin, navigatorMax, false );
            }

            if ( redraw ) {
                this.chart.redraw();
            }
        },

        /**
         * Reflows the chart to fit the dimensions of its container element.
         */
        reflow: function() {
            Logger.log('Reflowing Chart');
            this.chart.reflow();
        },

        /**
         * Redraws the chart, applying any new options.
         */
        redraw: function() {
            Logger.log('Redrawing Chart');
            this.chart.redraw();
            // update the tooltip/legend now.
            // Otherwise, the height of the graphic area will change on the first mouseover.
            this.updateTooltip();
        },

        /**
         * Sets the height of the chart.
         * @param {number} height The desired pixel height of the chart.
         * @param {boolean} [redraw=true] Whether to redraw the chart.
         */
        setHeight: function( height, redraw ) {
            this.options.chart.height = height;
            update.call( this, {chart: { height: height }}, redraw );
        },

        /**
         * Manually sets the width of the area between the y-axis line and the leftmost edge of the chart container.
         * @param {number} width The width of the area, in pixels.
         * @param {boolean} [redraw=true] Whether to redraw the chart.
         */
        setYAxisLabelWidth: function( width, redraw ) {
            // setting the width of the y-axis label area can be done by setting the chart margin left
            // when we manually set the marginLeft, highcharts ignores a couple things like padding values. Add a bit to the width value to account for that.
            if ( typeof width !== 'undefined' ) {
                width += 14;
            }
            if ( width === this.options.chart.marginLeft ) {
                return;
            }
            // perform an update, only passing it the new margin value
            update.call( this, {chart: {marginLeft: width} }, redraw );
        },

        /**
         * Sets whether the 'Reset zoom' button will show when the chart is zoomed in on either the x- or y-axis.
         * @param {boolean} enabled Whether to show the button.
         * @param {boolean} [redraw=true] Whether to redraw the chart.
         */
        setResetZoomButtonEnabled: function( enabled, redraw ) {
            // if enabled is true, theme.display is set to the default values (which will show the button)
            // otherwise, if enabled is false or undefined, the button will be hidden
            var value = this.options.chart.resetZoomButton.theme.display = enabled ? undefined : 'none';
            update.call( this, {chart: {resetZoomButton:{theme:{display: value}}}}, redraw );
        },
        
        /**
         * Enables or disables the navigator at the bottom of the chart.
         * @param {boolean} enabled Whether the navigator should be enabled.
         * @param {boolean} [redraw=true] Whether to redraw the chart.
         */
        setNavigatorEnabled: function( enabled, redraw ) {
            Logger.log( 'Turning navigator ' + (enabled ? 'on' : 'off') );
            this.options.navigator.enabled = enabled;
            this.options.navigator.height = enabled ? constants.NAVIGATOR_HEIGHT : 0;
            onSetNavigatorOrScrollbar.call( this );
            update.call( this, {
                navigator: this.options.navigator,
                // the call to onSetNavigatorOrScrollbar updates some chart options
                chart: {spacingBottom: this.options.chart.spacingBottom}
            }, false );
            // set the navigator highlight area to the current zoom extremes
            if ( enabled ) {
                var navXAxis = getNavigatorXAxis.call( this );
                if ( navXAxis ) {
                    navXAxis.setExtremes( this.options.navigator.xAxis.min, this.options.navigator.xAxis.max );
                }
            }
            if ( redraw ) {
                this.chart.redraw();
            }
        },

        /**
         * Enables or disables the scrollbar at the bottom of the chart.
         * @param {boolean} enabled Whether the scrollbar should be enabled.
         * @param {boolean} [redraw=true] Whether to redraw the chart.
         */
        setScrollbarEnabled: function( enabled, redraw ) {
            Logger.log( 'Turning scrollbar ' + (enabled ? 'on' : 'off') );
            if ( this.options.scrollbar === undefined ) {
                this.options.scrollbar = {};
            }
            this.options.scrollbar.enabled = enabled;
            onSetNavigatorOrScrollbar.call( this );
            update.call( this, {
                scrollbar: this.options.scrollbar,
                // the call to onSetNavigatorOrScrollbar updates some navigator and chart options
                navigator: this.options.navigator,
                chart: {spacingBottom: this.options.chart.spacingBottom}
            }, redraw );
        },

        /**
         * Enables or disables data grouping.
         * @param {boolean} enabled Whether data grouping should be enabled.
         * @param {boolean} [redraw=true] Whether to redraw the chart.
         */
        setDataGroupingEnabled: function( enabled, redraw ) {
            Logger.log( 'Turning data grouping ' + (enabled ? 'on' : 'off') );
            this.options.plotOptions.line.dataGrouping.enabled = enabled;
            this.options.plotOptions.arearange.dataGrouping.enabled = enabled;
            update.call( this, {plotOptions: this.options.plotOptions}, redraw );
        },

        /**
         * Sets the horizontal alignment of the legend text.
         * @param {string} direction The horizontal alignment of the text. Valid values are `'left'`, `'right'`, and `'center'`.
         * @param {boolean} [redraw=true] Whether to redraw the chart.
         */
        setLegendAlign: function( direction, redraw ) {
            this.options.legend.align = direction;
            update.call( this, {legend:{align: direction}}, redraw );
        },

        /**
         * Sets which axes can be zoomed on by dragging the mouse.
         * @param {string} zoomType Which axes can be zoomed on. Valid values are `'x'`, `'y'`, and `'xy'`.
         * @param {boolean} [redraw=true] Whether to redraw the chart.
         */
        setZoomType: function( zoomType, redraw ) {
            Logger.log( 'Setting zoom type to ' + zoomType );
            this.options.chart.zoomType = zoomType;
            update.call( this, {chart:{zoomType: zoomType}}, redraw );
        },

        /**
         * Sets how every series (other than min/max series) in the chart is displayed -- via lines, points, or both.
         * @param {string} displayMode The display mode. Valid values are `'lines'`, `'points'`, and `'linesAndPoints'`.
         * @param {boolean} [redraw=true] Whether to redraw the chart.
         */
        setSeriesDisplayMode: function( displayMode, redraw ) {
            Logger.log( 'Setting series display mode:', displayMode );
            // set both line and point visibility based on the display mode
            this.options.plotOptions.line.marker.enabled = ( displayMode != 'lines' );
            this.options.plotOptions.line.lineWidth = ( displayMode == 'points' ) ? 0 : constants.DEFAULT_LINE_WIDTH;
            update.call( this, {plotOptions: {line: this.options.plotOptions.line}}, redraw );
        },

        /**
         * Enables or disables the min/max series (also called 'range' series).
         * @param {boolean} visible Whether the min/max series should be shown.
         * @param {boolean} [redraw=true] Whether to redraw the chart.
         */
        setRangeVisibility: function( visible, redraw ) {
            Logger.log( 'Turning range visibility ' + (visible ? 'on' : 'off') );
            this.options.plotOptions.arearange.visible = visible;
            update.call( this, {plotOptions: {arearange: {visible: visible}}}, redraw );
        },

        /**
         * Sets the values of the yellow and red limit areas and draws bands representing the limit areas behind the series on the chart.
         * @param {number} redLow The y-value of the lower red limit threshold.
         * @param {number} redHigh The y-value of the upper red limit threshold.
         * @param {number} yellowLow The y-value of the lower yellow limit threshold.
         * @param {number} yellowHigh The y-value of the upper yellow limit threshold.
         * @param {boolean} [redraw=true] Whether to redraw the chart.
         */
        setYAxisLimitBands: function( redLow, redHigh, yellowLow, yellowHigh, redraw ) {
            Logger.log( 'Setting y-axis limit bands' );
            this.options.yAxis[0].plotBands = [{
                //Yellow low band
                color: this.colorTheme.limits.bands.warn,
                from: redLow,
                to: yellowLow,
                limitType: LimitTypes.WARN,
                zIndex: 1
            }, {
                // Yellow high band
                color: this.colorTheme.limits.bands.warn,
                from: yellowHigh,
                to: redHigh,
                limitType: LimitTypes.WARN,
                zIndex: 1
            },{
                // Red low band
                color: this.colorTheme.limits.bands.bad,
                from: -Number.MAX_VALUE,
                to: redLow,
                limitType: LimitTypes.BAD,
                zIndex: 1
            }, {
                // Red high band
                color: this.colorTheme.limits.bands.bad,
                from: redHigh,
                to: Number.MAX_VALUE,
                limitType: LimitTypes.BAD,
                zIndex: 1
            }];

            updateYAxis.call( this, this.options.yAxis[0], redraw );
        },

        /**
         * Hides the red and yellow limit areas.
         * @param {boolean} [redraw=true] Whether to redraw the chart.
         */
        disableYAxisLimitBands: function( redraw ) {
            Logger.log( 'Disabling y-axis limit bands' );
            this.options.yAxis[0].plotBands = [];
            updateYAxis.call( this, this.options.yAxis[0], redraw );
        },

        /**
         * Sets the title, or label, along the y-axis, representing the units of the chart's data.
         * @param {string} text The text to use as the y-axis title.
         * @param {boolean} [redraw=true] Whether to redraw the chart.
         */
        setYAxisTitle: function( text, redraw ) {
            Logger.log( 'Setting y-axis title:', text );
            // if the parameter is falsy, remove the title by setting it to undefined
            this.options.yAxis[0].title.text = text ? text : undefined;
            updateYAxis.call( this, {title:{text: text}}, redraw );
        },

        /**
         * Sets the scale of the chart's y-axis. Set `low` and `high` to `null` to enable automatic scaling based on the loaded data.
         * @param {number} low The lowest value to show on the y-axis.
         * @param {number} high The highest value to show on the y-axis.
         * @param {number} paddingPercent The amount of padding to put on the top and bottom of the y-axis extremes. A value of 0.1 is 10% padding.
         * @param {boolean} [redraw=true] Whether to redraw the chart.
         */
        setYAxisScaling: function( low, high, paddingPercent, redraw ) {
            Logger.log( 'Setting y-axis scaling:', low, high, paddingPercent );
            paddingPercent = paddingPercent || 0;
            var padding = paddingPercent * ( high - low );
            this.options.yAxis[0].min = (low === null)  ? null : low - padding;
            this.options.yAxis[0].max = (high === null) ? null : high + padding;
            updateYAxis.call( this, this.options.yAxis[0], redraw );
        },

        /**
         * Sets the y-axis scale as either linear or logarithmic.
         * @param {string} scaleType The scale type of the y-axis. Valid values are `'linear'` and `'logarithmic'`.
         * @param {boolean} [redraw=true] Whether to redraw the chart.
         */
        setYAxisScaleType: function( scaleType, redraw ) {
            Logger.log( 'Setting y-axis scale type:', scaleType );
            if ( scaleType !== 'linear' && scaleType !== 'logarithmic' ) {
                console.error("setYAxisScaleType: type must be either 'linear' or 'logarithmic'. Attempted to set type to " + scaleType);
            } else {
                this.options.yAxis[0].type = scaleType;
            }
            updateYAxis.call( this, {type: scaleType}, redraw );
        },

        /**
         * Sets the formatting of the labels along the chart's x-axis.
         * @param {string} labelFormat The format of the x-axis labels. Valid values are:
         *   `null`: Uses the default highstock formatter for x-axis values.
         *   `'auto'`: Formats the x-axis values as human-readable timestamps, and honors the date format setting (YYYY-MM-DD vs. YYYY-DDD).
         *   `'raw'`: Does no formatting of the x-axis values -- outputs the raw values.
         *   `'secondsSinceT0'`: Formats the values as number of seconds after the minimum x-axis value of the chart.
         * @param {boolean} [redraw=true] Whether to redraw the chart.
         */
        setXAxisLabels: function( labelFormat, redraw ) {
            this.labelFormat = labelFormat;

            var formatter, navigatorFormatter;
            var chart = this;
            if ( labelFormat === 'secondsSinceT0') {
                formatter = function() {
                    return xAxisLabelFormatterT0( this );
                };
                navigatorFormatter = formatter;
            } else if ( labelFormat === 'raw' ) {
                formatter = function() {
                    return this.value + chart.xAxisValueOffset;
                };
                navigatorFormatter = formatter;
            } else if ( labelFormat === 'auto' ) {
                formatter = function() {
                    return xAxisLabelFormatterDefault( this );
                };
                navigatorFormatter = function() {
                    var tempDate = moment.utc( new Date( this.value + chart.xAxisValueOffset ) );
                    tempDate.tz( chart.timezone );
                    return tempDate.format( 'HH:mm' );
                };
            } else if ( labelFormat === null || labelFormat === undefined ) {
                // use the default highcharts formatter
                formatter = null;
                navigatorFormatter = null;
            } else {
                console.error( 'Programmer error. Unrecognized labelFormat:', labelFormat );
            }
            
            // apply the settings to the highchart object
            this.options.xAxis[0].labels.formatter = formatter;
            this.options.navigator.xAxis.labels.formatter = navigatorFormatter;
            update.call( this, this.options, redraw );

            /* highstockAxisLabelObj is the object assigned to 'this' in the axis label formatter function defined in the highstock config object.
            * These xAxisLabelFormatter functions are intended to be used only in this context.
            */
            function xAxisLabelFormatterDefault( highstockAxisLabelObj ) {
                var tempDate = moment.utc( new Date( highstockAxisLabelObj.value + chart.xAxisValueOffset ) );
                tempDate.tz( chart.timezone );
                return tempDate.format( chart.momentTimeFormat + '[<br>]HH:mm:ss');
            }
            function xAxisLabelFormatterT0( highstockAxisLabelObj ) {
                return '+' + ( Math.round( (highstockAxisLabelObj.value - highstockAxisLabelObj.chart.xAxis[0].getExtremes().dataMin) / 1000) ) + 's';
            }
        },

        /**
         * Sets the title of the chart's x-axis.
         * @param {string} text The text to use for the x-axis title.
         * @param {boolean} [redraw=true] Whether to redraw the chart.
         */
        setXAxisTitle: function( text, redraw ) {
            // if the parameter is falsy, remove the title by setting it to undefined
            if ( !text ) {
                text = undefined;
            }
            this.options.xAxis[0].title.text = text;
            update.call( this, {xAxis:[{title:{text: text}}]}, redraw );
        },

        /**
         * Enables or disables the horizontal crosshair (perpendicular to the y-axis).
         * @param {boolean} enabled Whether the crosshair should be enabled.
         * @param {boolean} [redraw=true] Whether to redraw the chart.
         */
        setYAxisCrosshairEnabled: function( enabled, redraw ) {
            Logger.log( 'Turning y-axis crosshair ' + (enabled ? 'on' : 'off') );
            if ( enabled ) {
                this.options.yAxis[0].crosshair = { snap: false };
                // sometimes the crosshair is enabled before the color theme is set
                if ( typeof this.colorTheme !== 'undefined' ) {
                    this.options.yAxis[0].crosshair.color = this.colorTheme.axis.crosshairColor;
                }
            } else {
                this.options.yAxis[0].crosshair = false;
            }
            update.call( this, { yAxis:[{crosshair: this.options.yAxis[0].crosshair}] }, redraw );
        },

        /**
         * Sets color zones for a single series. Color zones cause the series to be colored based on the y-value at each point.
         * @param {number} seriesIndex The index number of the series to update.
         * @param {object} colorZones The color zones to apply to the series, as returned from the ChartData.getLimitZones function.
         * @param {boolean} [redraw=true] Whether to redraw the chart.
         */
        setSeriesColorZones: function( seriesIndex, colorZones, redraw ) {
            this.chart.series[seriesIndex].update( {zones: colorZones}, redraw );
        },

        /**
         * Enables or disables the chart's legend.
         * @param {boolean} legendEnabled Whether the legend should be enabled.
         * @param {boolean} [redraw=true] Whether to redraw the chart.
         */
        setLegendEnabled: function( legendEnabled, redraw ) {
            Logger.log( 'Turning legend ' + (legendEnabled ? 'on' : 'off') );
            this.options.legend.enabled = legendEnabled;
            update.call( this, { legend:{enabled: legendEnabled} }, redraw );
        },

        /**
         * Adds spacecraft events to the chart, or disables them.
         * @param {boolean} enabled Whether to show spacecraft events.
         * @param {EventsData} [eventsData] The spacecraft events data (a list of events, and a list of possible event types for the mission). Required if `enabled` is `true`.
         * @param {array} [viewEventTypes] A whitelist of event type IDs to show. Required if `enabled` is `true`.
         * @param {boolean} [redraw=true] Whether to redraw the chart.
         */
        setEventsOverlay: function( enabled, eventsData, viewEventTypes, redraw ) {
            Logger.log( 'Turning events overlay ' + (enabled ? 'on' : 'off') );
            // The index values of the list of event types equates to y-values on the axis.
            // i.e. events of the first type are drawn between the y-values of 0 and 1.
            // viewEventTypes is an array of strings, each one a type of event which is allowed to show.

            // reset plot bands and possibly add them in later
            this.options.xAxis[0].plotBands = [];
            this.options.xAxis[0].plotLines = [];

            if ( enabled ) {
                // make a copy of the original viewEventTypes array so we can safely modify it
                viewEventTypes = angular.copy( viewEventTypes );
                // there are some events that the user may want to hide... we also want to hide rows on the y-axis
                // for which there are no events in the shown time range. Look through all the events to see
                // which types are present, and hide the rest.
                var presentEventTypeIds = [];
                eventsData.events.forEach( function(event) {
                    if ( presentEventTypeIds.indexOf(event.type.id) === -1 ) {
                        presentEventTypeIds.push( event.type.id );
                    }
                });
                viewEventTypes = viewEventTypes.filter( function(typeId) {
                    return presentEventTypeIds.indexOf( typeId ) !== -1;
                });

                var numRows = viewEventTypes.length;
                
                // set y-axis breaks for events
                var min = Number.MAX_VALUE,
                    max = -Number.MAX_VALUE;
                this.options.yAxis[1].breaks = [];
                // first find the min and max values of the axis
                eventsData.types.forEach( function(type, i) {
                    if ( viewEventTypes.indexOf(type.id) >= 0 ) {
                        min = Math.min( min, i );
                        max = Math.max( max, i );
                    }
                }, this );
                max++;
                // now add axis breaks
                eventsData.types.forEach( function(type, i) {
                    if ( viewEventTypes.indexOf(type.id) === -1 && i < max && i >= min ) {
                        this.options.yAxis[1].breaks.push({
                            // constructing the break like this ensures that the correct labels will be shown.
                            // Putting breaks on the exact values that labels live on can hide labels in some unpredictable ways.
                            from: i - 0.00001,
                            to: i + 0.99999
                        });
                    }
                }, this );

                this.options.yAxis[1].min = min;
                this.options.yAxis[1].max = max;

                // make room for the event area and show it
                // also set the max and height for the event y-axis
                var eventRowHeight = 16; // an arbitrary value. 16 makes for a nice clickable thickness without taking too much space.
                this.options.yAxis[1].height = this.options.xAxis[0].offset = eventRowHeight * numRows;
                this.options.yAxis[1].visible = true;
                
                var chart = this;
                this.options.yAxis[1].labels.formatter = function() {
                    var eventType = eventsData.types[this.value];
                    if ( typeof eventType === 'undefined' ) return '';
                    var labelText = eventType === undefined ? '' : eventType.label;
                    // When the series uses the 'light' colors, the labels use the 'dark', colors, and vice versa
                    var color = ColorThemes.getColorForEventType( eventType, eventsData.types, ColorThemes.getOppositeTheme(chart.colorTheme) ).series;
                    return '<div class="events-label" title="' + labelText + '" style="color:' + color + '">' + labelText + '</div>';
                };
                
                // set x-axis bands and lines
                // for each event with a start and end, create a band. If the event only has a start, create a line.
                eventsData.events.forEach( function(event, i) {
                    if ( viewEventTypes.indexOf(event.type.id) === -1 )  {
                        return;
                    }
                    var eventTypeColor = ColorThemes.getColorForEventType( event.type, eventsData.types, this.colorTheme );
                    var eventTypeOrderIndex = eventsData.types.findIndex( function(type) {
                        return type.id == event.type.id;
                    });
                    if ( event.start === event.end ) {
                        this.options.xAxis[0].plotLines.push({
                            color: eventTypeColor.line,
                            value: event.start,
                            width: 2,
                            zIndex: 1
                        });
                    } else {
                        this.options.xAxis[0].plotBands.push({
                            color: eventTypeColor.band,
                            from: event.start,
                            to: event.end,
                            zIndex: 1
                        });
                    }
                }, this );
            } else {
                this.options.yAxis[1].height = this.options.xAxis[0].offset = 0;
                this.options.yAxis[1].visible = false;
            }

            // update the highchart object
            update.call( this, this.options, redraw );
        },

        /**
         * For charts with discrete data, hides all labels on the y-axis except for those associated with y-values of the loaded data.
         * @param {array} breaks An array of objects, each with a `from` and `to` property, defining where the y-axis breaks are.
         *   This array can be generated by the `ChartData.calculateYAxisBreaks` method.
         * @param {array} usedDiscreteVals An array of y-values to show on the y-axis.
         * @param {boolean} [redraw=true] Whether to redraw the chart.
         */
        hideUnusedDiscreteLabels: function( breaks, usedDiscreteVals, redraw ) {
            Logger.log( 'Hiding unused discrete labels' );
            // breaks should be an array of objects, like:
            // [{from: 1, to: 3}, {from: 5, to: 14}]
            var minmax = arrayMinMax( usedDiscreteVals );
            // normally the padding percent is 0.1, but we need to set it based on the number of visible values, not based on the range of min to max
            // See WEBTCAD-1201
            // If only one discrete value is used, the padding ends up being Infinity. Don't let this happen
            var alteredPadding = ( usedDiscreteVals.length === 1 ) ? 0 : 0.05 * usedDiscreteVals.length / (minmax.max - minmax.min );
            this.setYAxisScaling( minmax.min, minmax.max, alteredPadding, redraw );
            this.options.yAxis[0].breaks = breaks;
            updateYAxis.call( this, {breaks: breaks}, redraw );
        },

        /**
         * For charts with discrete data, shows all values on the y-axis.
         * @param {array} conversions An array of subarrays -- each subarray defines label-to-value conversions for a plotted dataset,
         *   as returned by the `ChartData.getTypeConversions` method.
         * @param {boolean} [redraw=true] Whether to redraw the chart.
         */
        showAllDiscreteLabels: function( conversions, redraw ) {
            Logger.log( 'Showing discrete labels' );
            // find min and max numeric values of the labels for all the datasets
            var allConversions = [];
            conversions.forEach( function(conversion) {
                allConversions = allConversions.concat( conversion );
            })
            var minmax = arrayMinMax( allConversions, function(el) {
                return el.value;
            });
            this.setYAxisScaling( minmax.min, minmax.max, 0.05, redraw );
            this.options.yAxis[0].breaks = undefined;
            updateYAxis.call( this, {breaks: undefined}, redraw );
        },

        /**
         * For charts with discrete data, defines how y-axis values are formatted.
         * @param {array} conversions An array of subarrays -- each subarray defines label-to-value conversions for a plotted dataset,
         *   as returned by the `ChartData.getTypeConversions` method. If this value is falsy, raw numbers will be shown on the y-axis instead of labels.
         * @param {boolean} [redraw=true] Whether to redraw the chart.
         */
        setDiscreteFormatters: function( conversions, redraw ) {
            if ( !conversions ) {
                this.options.yAxis[0].labels.formatter = undefined;
            } else {
                this.options.yAxis[0].labels.formatter = angular.copy( function() {
                    // preserve the reference to 'this'
                    var self = this;
                    var typeConversion = conversions[0].find( function( conversion ) { return conversion.value === self.value; });
                    return typeConversion ? typeConversion.state : undefined;
                });
            }
            
            // force ticks to show at every integer
            this.options.yAxis[0].tickPositioner = HighstockOptions.tickPositionerEveryInteger;

            // disable ellipsis (WEBTCAD-1201)
            this.options.yAxis[0].labels.style = {
                textOverflow: 'none'
            };
            this.options.plotOptions.line.step = true;

            updateYAxis.call( this, this.options.yAxis[0], false );
            update.call( this, {plotOptions:{line:{step: true}}}, false );
            if ( redraw ) {
                this.chart.redraw();
            }
        },

        /**
         * Defines which color theme to use for the chart.
         * @param {string} theme Which color theme to use. Valid values include any key of the `ColorThemes.themes` object (`'light'` or `'dark'`).
         * @param {boolean} [redraw=true] Whether to redraw the chart.
         */
        setColorTheme: function( theme, redraw ) {
            if ( typeof theme === 'undefined' ) return;
            Logger.log( 'Setting color theme:', theme );
            // the 'theme' parameter is a string
            // use angular.copy to make a copy of the theme, because highcharts will use the pointer values when passed the style objects
            this.colorTheme = angular.copy( ColorThemes.themes[theme] );
            // apply the theme to the highcharts config
            extendDeep( this.options, {
                chart: {
                    backgroundColor: this.colorTheme.backgroundColor,
                    selectionMarkerFill: this.colorTheme.selectionMarkerFill
                },
                colors: this.colorTheme.colors,
                legend: {
                    title: {
                        style: this.colorTheme.legend.titleStyle
                    },
                    itemStyle: this.colorTheme.legend.itemStyle,
                    itemHoverStyle: this.colorTheme.legend.itemStyle
                },
                navigator: {
                    outlineColor: this.colorTheme.navigator.outlineColor,
                    maskFill: this.colorTheme.navigator.maskFill,
                    handles: {
                        backgroundColor: this.colorTheme.navigator.handles.backgroundColor,
                        borderColor: this.colorTheme.navigator.handles.borderColor
                    },
                    xAxis: {
                        labels: {
                            style: this.colorTheme.axis.labelStyle
                        },
                        gridLineColor: this.colorTheme.axis.gridLineColor
                    }
                }
            });

            extendDeep( this.options.xAxis[0], {
                gridLineColor: this.colorTheme.axis.gridLineColor,
                lineColor: this.colorTheme.axis.lineColor,
                minorGridLineColor: this.colorTheme.axis.minorGridLineColor,
                minorTickColor: this.colorTheme.axis.minorTickColor,
                tickColor: this.colorTheme.axis.tickColor,
                crosshair: {
                    color: this.colorTheme.axis.crosshairColor
                },
                labels: {
                    style: this.colorTheme.axis.labelStyle
                }
            });

            extendDeep( this.options.yAxis[0], {
                gridLineColor: this.colorTheme.axis.gridLineColor,
                lineColor: this.colorTheme.axis.lineColor,
                minorGridLineColor: this.colorTheme.axis.minorGridLineColor,
                minorTickColor: this.colorTheme.axis.minorTickColor,
                tickColor: this.colorTheme.axis.tickColor,
                crosshair:
                    this.options.yAxis[0].crosshair ?
                    { color: this.colorTheme.axis.crosshairColor } :
                    false,
                labels: {
                    style: this.colorTheme.axis.labelStyle
                }
            });
            

            // set the colors of the event overlay bands/lines
            if ( this.options.xAxis[0].plotBands ) {
                this.options.xAxis[0].plotBands.forEach( function( band ) {
                    band.color = this.colorTheme.events.bands;
                }, this );
            }
            if ( this.options.xAxis[0].plotLines ) {
                this.options.xAxis[0].plotLines.forEach( function(line) {
                    line.color = this.colorTheme.events.lines;
                }, this );
            }

            // set the colors of the limit bands/lines
            if ( this.options.yAxis[0].plotBands ) {
                this.options.yAxis[0].plotBands.forEach( function( band ) {
                    band.color = ( band.limitType === LimitTypes.WARN ) ? this.colorTheme.limits.bands.warn : this.colorTheme.limits.bands.bad;
                }, this );
            }

            update.call( this, this.options, redraw );
            
            function extendDeep( dst ) {
                angular.forEach( arguments, function( obj ) {
                    if ( obj !== dst ) {
                        angular.forEach( obj, function( value, key ) {
                            if ( dst[key] && dst[key].constructor && dst[key].constructor === Object ) {
                                extendDeep( dst[key], value );
                            } else {
                                dst[key] = value;
                            }
                        });
                    }
                });
                return dst;
            }
        },

        /**
         * Generates a string to be used in the chart's legend, which represents the hovered point's x-value. The point may represent
         *   a single data point, or a group/bin of points.
         * @param {object} point A Highstock Point object
         * @param {number} [xOffset=0] A number representing the hovered series' x-offset from the chart's main x-axis.
         * @returns {string} A string representing either a single x-value or a range of x-values, depending on whether the passed Point
         *   object represents a group of points.
         */
        generateXLegendString: function( point, xOffset ) {
            xOffset = xOffset || 0;
            var group = point.dataGroup;
            // If data grouping is off, or the data group represents only one point, show a single x-value.
            // Once latis is able to serve start and end times for binave data, we should display those here
            // (instead of a single date) when not viewing full-res data.
            if ( typeof group === 'undefined' || group.length === 1 ) {
                return legendXValueFormatter.call( this, point.x + xOffset );
            } else {
                // otherwise, show an x-range from the start of the group to the end of the group.
                // Once latis is able to serve start and end times for bins, this should show the start time
                // of the first bin and the end time of the last bin in the data group.
                var series = point.series;
                var data = series.options.data;
                // group.start is the index of the first data point in the group, starting at the index of
                // the first currently visible data point, as opposed to the first data point overall. This may be a bug:
                // https://github.com/highcharts/highcharts/issues/6335
                // The workaround is to use the index of the first visible data point (series.cropStart).
                var xStart = data[series.cropStart + group.start][0];
                var xEnd = data[series.cropStart + group.start + group.length -1][0];
                return legendXValueFormatter.call( this, xStart + xOffset, xEnd + xOffset );
            }
        },


        /**
         * Calls the `runPointActions` method on the highstock chart object.
         * @param {object} evt The event object on which the point actions should be based.
         */
        runPointActions: function( evt ) {
            this.chart.pointer.runPointActions(evt);
        },
        
        /**
         * Calls the `reset` method on the highstock chart's mouse tracker object.
         */
        pointerReset: function() {
            this.chart.pointer.reset( false, 500 );
        },

        /**
         * Resets the y-zoom so that the full range of the y-axis is shown.
         */
        resetYZoom: function() {
            Logger.log('Chart Zoomed Out');
            this.chart.zoomOut();
        },
        
        /**
         * Triggers a file download of a static image of the chart.
         * @param {string} filetype The desired filetype of the image to be downloaded. Valid values are `'png'` and `'svg'`.
         * @param {string} filename The desired name of the file to be downloaded.
         */
        downloadImage: function( filetype, filename ) {
            // filetype should be 'png' or 'svg'
            var mime = '';
            if ( filetype === 'png' ) mime = 'image/png';
            else if ( filetype === 'svg' ) mime = 'image/svg+xml';
            else if ( filetype === 'pdf' ) mime = 'application/pdf';
            try {
                this.chart.exportChartLocal({
                    filename: filename,
                    type: mime,
                    sourceWidth: this.chart.container.clientWidth
                });
            } catch ( e ) {
                alert( 'Sorry, your browser does not support this feature. Try using Chrome or Firefox.' );
            }
        },

        /**
         * Updates all the x- and y-values in the legend.
         * @param {boolean} clearData Whether to clear all info in the legend.
         */
        updateTooltip: function( clearData ) {
            // Legend render handler
            var chart = this.chart;
            if ( !this.options.legend.enabled ) {
                return;
            }
            //now we have to update our values in the legend which is serving as our tooltip
            var legendOptions = chart.legend.options;
            var hoverPoints = chart.hoverPoints;
            
            if ( !hoverPoints && chart.hoverPoint ) {
                hoverPoints = [chart.hoverPoint];
            }
            if ( hoverPoints ) {
                angular.forEach(hoverPoints, function (point) {
                    point.series.point = point;
                });
                angular.forEach(chart.legend.allItems, function (item) {
                    // clear the legend value if needed
                    if ( clearData ) {
                        item.point = {};
                    }
                    
                    item.legendItem.attr({
                        text: legendOptions.labelFormat ? 
                            Highcharts.format(legendOptions.labelFormat, item) :
                            legendOptions.labelFormatter.call(item)
                    });
                });
            }

            if ( chart.legend.title ) {
                if ( !this.showSingleLegendXValue ) {
                    // the x-values are rendered in the formatter for each series, not here.
                    chart.legend.title.textSetter('');
                } else if ( clearData || !hoverPoints ) {
                    // Passing an empty object to generateXLegendString ultimately sets the title to a hyphen.
                    // Set the title to a hyphen rather than an empty string.
                    // Using an empty string would make the plot expand vertically a bit.
                    // Kind of irritating when the plots are wiggling around whenever you mouseover/out a plot.
                    chart.legend.title.textSetter( this.generateXLegendString({}) );
                } else if ( hoverPoints ) {
                    chart.legend.title.textSetter( this.generateXLegendString( hoverPoints[0]) );
                }
                chart.legend.render();
            }
        }
    }, Chart.prototype);
    return ( Chart );
}

angular.module( 'laspChart' ).factory( 'Chart', [ 'constants', 'LimitTypes', 'HighstockOptions', 'ColorThemes', 'Logger', highstockAdapter ]);