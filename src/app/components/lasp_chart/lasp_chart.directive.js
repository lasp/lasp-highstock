'use strict';

/**
 * @ngdoc service
 * @name highchart
 *
 * @description
 * Highcharts directive currently being optimized for large datasets
 */
function highchart( Chart, ChartData, constants, DatasetTypes, LimitTypes, ColorThemes, Logger, $q, $window, $timeout, $uibModal ) {
    return {
        /**
         * This object defines our directive. It can call the functions defined above and the functions
         * defined in our helper factory.
         */
        restrict: 'E',
        template: '<div></div>',
        replace: true,
        scope: {
            highchartScope: '=',
            frameScope: '='
        },
        //link: function used for DOM manipulation tasks
        link: function ( scope, element ) {
            scope.highchartScope = scope;

            var dataArray;
            var yAxisBreaks;
            var allUsedDiscreteVals;
            var chartDataZones;
            

            scope.init = function() {
                //get a new instance of our chart
                scope.chart = new Chart( element[0], {
                    dataIsFullRes: function() {
                        return scope.frameScope.fullResolution;
                    },
                    getTypeConversions: function() {
                        return scope.typeConversions;
                    },
                    onAfterSetExtremes: function( min, max ) {
                        // pass the changes to the frame scope
                        scope.$emit( 'setVisibleTimeRange', min, max, true );
                    },
                    onSeriesClick: function( url ) {
                        $window.open( url, '_self' );
                    },
                    onSpacecraftEventClick: function( eventDetails ) {
                        scope.openEventModal( eventDetails );
                    }
                });

                scope.frameScope.chart = scope.chart;
            };

            scope.afterDatasetDownloaded = function( data ) {
                
            };

            scope.afterAllDatasetsDownloaded = function() {
                scope.chart.tooltipDecimalLengthReset = true;
                
                // set some default options and behaviors for different kinds of plots

                if ( scope.frameScope.datasetType === DatasetTypes.DISCRETE ) {

                    scope.menuOptions.yAxis.scaling.type = 'auto';
                    scope.menuOptions.dataDisplay.dataGrouping = false;

                    analyzeTypeConversions();
                    findYAxisBreaks();
                
                } else if ( scope.frameScope.datasetType === DatasetTypes.ANALOG ) {
                    
                    analyzeYAxisUnits();
                    analyzeYAxisLimits();
                }

                // if all datasets have 0 offset, show one x-value (timestamp) in the legend.
                scope.chart.showSingleLegendXValue = dataArray.every( function(chartData) {
                    return chartData.offset == 0;
                });
                
                createChart();


                function analyzeTypeConversions() {
                    // create type conversions
                    scope.typeConversions = [];
                    for ( var i = 0; i < dataArray.length; i++ ) {
                        scope.typeConversions.push( dataArray[i].getTypeConversions() );
                    }
                    
                    scope.frameScope.discreteFormattersEnabled = true;
                    // if the type conversions for all datasets are identical, then show them. Otherwise show numeric values.
                    // ignore desirability for type conversion comparison.
                    if ( dataArray.length > 1 ) {
                        var conversionsCopy = angular.copy( scope.typeConversions );
                        conversionsCopy.map( function(conversions) {
                            return conversions.map( function(conversion) {
                                delete conversion.desirability;
                                return conversion;
                            });
                        });
                        var firstTypeConversion = JSON.stringify( conversionsCopy[0] );
                        for ( i=1; i<conversionsCopy.length; i++ ) {
                            if ( firstTypeConversion !== JSON.stringify(conversionsCopy[i]) ) {
                                scope.frameScope.discreteFormattersEnabled = false;
                                break;
                            }
                        }
                    }
                }

                function findYAxisBreaks() {
                    allUsedDiscreteVals = [];
                    dataArray.forEach( function(da) {
                        allUsedDiscreteVals = allUsedDiscreteVals.concat( da.getUsedDiscreteVals() );
                    });
                    // we may have duplicate values. Get only unique values.
                    allUsedDiscreteVals = ChartData.findUniqueVals( allUsedDiscreteVals, function(el){return el;} );
                    yAxisBreaks = ChartData.calculateYAxisBreaks( allUsedDiscreteVals );
                }

                function analyzeYAxisUnits() {
                    // determine if all plotted items have the same y-axis units
                    var unitses = dataArray.map( function(datum) {
                        if ( typeof datum === 'undefined' || typeof datum.metadata === 'undefined' || typeof datum.metadata.Info === 'undefined' ) {
                            return undefined;
                        } else {
                            return datum.metadata.Info.Units;
                        }
                    });
                    var unitsArray = unitses.filter( function(units, index) { return unitses.indexOf( units ) === index && typeof units !== 'undefined'; });
                    
                    // now we have an array of unique "Units" values. All datasets have the same units if there's only one item in the array
                    if ( unitsArray.length === 1 ) {
                        var label = unitsArray[0];
                        if ( !constants.Y_AXIS_LABEL_SHOW_UNITS_ONLY ) {
                            // find if we have one common "name" to label the y-axis with. If not, we'll default to only the units.
                            // it's currently possible for all the units to match, but not the names.
                            // in the future we may use a different property than metadata.Name.
                            var nameses = dataArray.map( function(datum) { return datum.metadata.Name; });
                            var namesArray = nameses.filter( function(names, index) { return nameses.indexOf( names ) === index; });
                            if ( namesArray.length === 1 ) {
                                label = namesArray[0] + ' (' + label + ')';
                            }
                        }
                        scope.chart.setYAxisTitle( label, false );
                    } else {
                        scope.chart.setYAxisTitle( '', false );
                    }
                }

                function analyzeYAxisLimits() {
                    // if the limits for all datasets in this plot are the same (or if there's only one dataset), show the limits.
                    // Otherwise limits will be turned off by default but users can select which dataset's limits they want to view.
                    var limitses = dataArray.map( function(array) {
                        // get the limits data, and stringify it for easy comparison
                        return JSON.stringify( array.getMetadata().Limits );
                    });
                    var uniqueLimitses = limitses.filter( function(limits, index) { return limitses.indexOf( limits ) === index && typeof limits !== 'undefined'; });
                    
                    // now we have an array of unique "Limits" values. All datasets have the same limits if there's only one item in the array
                    scope.menuOptions.selectedLimitsIndex = undefined;
                    scope.frameScope.enableLimitsSelection = false;
                    
                    if ( uniqueLimitses.length === 1 ) {
                        scope.menuOptions.selectedLimitsIndex = 0;
                    } else if ( scope.frameScope.isOverplot() ) {
                        // temprarily disable the limit bands,
                        // so we can let the user choose which dataset to show limits for
                        scope.frameScope.enableLimitsSelection = true;
                        scope.chart.disableYAxisLimitBands( false );
                    }
                }
            };
            
            function createChart() {
                // don't even bother with this if there's a server error
                if ( scope.frameScope.dataError === 'Server Error' ) {
                    return;
                }
                
                // apply all uiOptions and menuOptions
                scope.onSetUiOptions();
                scope.onSetMenuOptions();
                
                // allow parent scopes to make custom changes to the chart config before/after the plot initializes
                function beforeInit( config ) {
                    scope.$emit( 'beforeChartInit', config );
                }
                function afterInit( chart ) {
                    scope.$emit( 'afterChartInit', chart );
                }
                
                scope.chart.init( beforeInit, afterInit );
                
                // keep track of x-offsets for every series we add to the plot
                var seriesOffsets = [];

                // add series
                dataArray.forEach( function(chartData, chartDataIndex ) {
                    if ( scope.menuOptions.dataDisplay.dataGrouping ) {
                        // We don't want to apply data grouping to a chart which only contains a line series...
                        // peaks and valleys would be clobbered. The function below artificially creates a min/max
                        // arearange series if needed.
                        chartData.createMinMaxDataFromLine();
                    } else {
                        // The function below destroys the artificial min/max arearange if one was created.
                        chartData.removeMinMaxDataCreatedFromLine();
                    }

                    chartData.getSeriesTypes().forEach( function(seriesType, i) {
                        // assume that series after the first aren't needed at full res
                        // If data grouping is on, we'll always need both line and arearange series, because even full-res data
                        // can be 'grouped', which will smooth out peaks and valleys on a line series.
                        if ( i > 0 && scope.frameScope.fullResolution && !scope.menuOptions.dataDisplay.dataGrouping ) {
                            return;
                        }
                        
                        var dataToPlot;
                        if ( seriesType === 'line' ) {
                            dataToPlot = scope.menuOptions.dataDisplay.gaps.enabled ?
                                chartData.getDataWithGaps( scope.menuOptions.dataDisplay.gaps.threshold ) :
                                chartData.getData();
                        } else if ( seriesType === 'arearange' ) {
                            dataToPlot = scope.menuOptions.dataDisplay.gaps.enabled ?
                                chartData.getMinMaxDataWithGaps( scope.menuOptions.dataDisplay.gaps.threshold ) :
                                chartData.getMinMaxData();
                        }
                        
                        var color = undefined;
                        // set the color of this series based on the color of the previous series
                        if ( i > 0 ) {
                            var allSeries = scope.chart.getAllSeries();
                            color = allSeries[ allSeries.length -1].color;
                        }
                        
                        scope.chart.addSeries(
                            dataToPlot,
                            chartDataIndex,
                            i > 0 && seriesType === 'arearange' ? 'range' : chartData.getYNameAndUnits(),
                            color,
                            seriesType,
                            false,
                            chartData.getLinkURL()
                        );
                        seriesOffsets.push( chartData.offset );
                    });
                });

                scope.chart.seriesOffsets = seriesOffsets;

                if ( scope.menuOptions.view.limitViolationFlags ) {
                    applyColorZones();
                }

                if ( scope.menuOptions.view.events ) {
                    addEventsToChart( scope.frameScope.eventsData.events );
                    scope.chart.setEventTypeVisibility( scope.menuOptions.view.eventTypes );
                }
                
                // Show the defined visible time range
                scope.applyVisibleTimeRange( false );
                
                // now that we're done adding series and altering the chart object, trigger a redraw
                scope.chart.redraw();
            }
            
            
            scope.setDataArray = function( d ) {
                dataArray = d;
            };
            
            scope.getExtraAccessURLParameters = function() {
                if ( scope.frameScope.datasetType !== DatasetTypes.DISCRETE && scope.frameScope.datasetType !== DatasetTypes.STRING && typeof constants.NUM_BINS !== 'undefined' ) {
                    return '&binave(' + constants.NUM_BINS + ')&exclude_missing()';
                } else return '';
            };
            
            scope.downloadImage = function( filetype, filename ) {
                scope.chart.downloadImage( filetype, filename );
            };
            
            scope.updateTooltip = function( clearData ) {
                scope.chart.updateTooltip( clearData );
            };
            
            function getExtremesWithPadding(extremeLow, extremeHigh, plotHeightPixels, paddingPixels) {
                // based on the chart pixel height and extremes we wish to show (given in y-axis units), find the new extremes in y-axis units in order to have a certain amount of 'padding' in pixels on the top and bottom.
                if ( typeof paddingPixels === 'undefined' ) {
                    paddingPixels = 20;
                }
                if ( scope.menuOptions.yAxis.scaleType === 'logarithmic' ) {
                    paddingPixels = 0;
                }
                
                var diff = (plotHeightPixels * extremeHigh - paddingPixels * (extremeHigh + extremeLow)) / (plotHeightPixels - 2 * paddingPixels) - extremeHigh;
                return {
                    low: extremeLow - diff,
                    high: extremeHigh + diff
                };
            }
            
            scope.applyVisibleTimeRange = function( redraw ) {
                redraw = typeof redraw === 'undefined' ? true : redraw;
                // If we changed our x-axis, we want to re-calculate a max decimal precision for tooltips
                scope.chart.tooltipDecimalLengthReset = true;
                
                // if start/end are null, the axis will show the max range
                var visibleStartTime = scope.timeRange.visible.start === null ? null : scope.timeRange.visible.start.getTime();
                var visibleEndTime = scope.timeRange.visible.end === null ? null : scope.timeRange.visible.end.getTime();
                var totalStartTime = scope.timeRange.total.start === null ? null : scope.timeRange.total.start.getTime();
                var totalEndTime = scope.timeRange.total.end === null ? null : scope.timeRange.total.end.getTime();
                
                scope.chart.setExtremes(
                    visibleStartTime,
                    visibleEndTime,
                    totalStartTime,
                    totalEndTime,
                    redraw
                );
            };
            
            // rather than listening for scope.$on( $destroy ), we let the parent scope directly call this destroy function.
            // if we listen for $destroy, the listener seems to fire after the parent scope has already been destroyed,
            // and the chart.destroy function encounters errors as it tries to remove attributes from an HTML element that no longer exists.
            scope.onDestroy = function() {
                scope.chart.destroy();
            };
            
            scope.resetYZoom = function() {
                scope.chart.resetYZoom();
            };
            
            scope.onWidthChange = function() {
                // reflow the plot to fit the new width, but save some cycles by not doing this when collapsed
                if ( !scope.uiOptions.collapsed && scope.chart.chart ) scope.chart.reflow();
            };
            
            // watch for changes in the width of the y-axis label area
            scope.$watch( function() {
                return scope.getDefaultYAxisLabelWidth();
            }, function( newWidth, oldWidth ) {
                if ( newWidth === oldWidth || scope.frameScope.loading ) {
                    return;
                }
                // tell the world about the change. Have the frame scope emit it so apps don't have to listen to this directive
                scope.frameScope.$emit( 'yAxisLabelWidthChange', newWidth, oldWidth );
            });
            
            scope.getDefaultYAxisLabelWidth = function() {
                var yAxisLabels = element[0].querySelectorAll('.highcharts-axis-labels.highcharts-yaxis-labels');
                var width = 0;
                if ( yAxisLabels ) {
                    // yAxisLabels may contain the navigator's y-axis label container as well (the DOM element will be there, even if it contains no labels)
                    // Only find the width of the non-navigator y-axis labels.
                    // The events y-axis labels also cause some issues---in that case, we want to find the width of individual labels, not the container for them.
                    for ( var i = 0; i < yAxisLabels.length; i++ ) {
                        var labelsElement = angular.element(yAxisLabels[i]);
                        if ( !labelsElement.hasClass('highcharts-navigator-yaxis') && !labelsElement.hasClass('events-y-axis') ) {
                            // round the number because we don't need huge accuracy here
                            // Get the largest width, searching through the regular y-axis and the events labels.
                            width = Math.max( width, Math.round( labelsElement[0].getBoundingClientRect().width ) );
                        }
                    }
                    // Find the greatest with of the individual events axis labels
                    var eventsLabels = element[0].querySelectorAll('.events-label');
                    if ( Array.isArray(eventsLabels) ) {
                        eventsLabels.forEach( function(eventsLabel) {
                            width = Math.max( width, angular.element(eventsLabel).parent()[0].getBoundingClientRect().width );
                        });
                    }
                    
                    // if units are shown on the y-axis, the .highcharts-yaxis element will have a greater width than the label area. We'd want to use that one instead.
                    var yAxis = element[0].querySelectorAll('.highcharts-axis.highcharts-yaxis');
                    for ( var i = 0; i < yAxis.length; i++ ) {
                        if ( !angular.element(yAxis[i]).hasClass('highcharts-navigator-yaxis') ) {
                            width = Math.max( width, Math.round( yAxis[i].getBoundingClientRect().width ) );
                        }
                    }
                    return width;
                }
                return 0;
            };
            
            scope.setYAxisLabelWidth = function( width ) {
                if ( scope.chart ) {
                    scope.chart.setYAxisLabelWidth( width );
                }
            };
            
            /**
             * @ngdoc method
             * @name onSetMenuOptions
             * @methodOf laspChart
             * @description
             * Applies new menu options, or applies all menu options. If applying only new options, this function must be called after changing scope.menuOptions.
             * If applying all menu options, there is no prerequisite.
             * 
             * @param {object} [oldOptions] The old set of menuOptions. Omit this parameter to apply all menuOptions instead of only the ones which have changed.
             */
            scope.onSetMenuOptions = function( oldOptions ) {
                // if oldOptions is undefined, apply all menuOptions, but don't recreate/redraw the chart, or alter the chart object, because it hasn't been initialized yet
                var applyAll = typeof oldOptions === 'undefined';
                var updateChart = typeof scope.chart.chart !== false && !scope.frameScope.loading && !applyAll;

                var redraw = false,
                    recreate = false;
                // shorthand variables used in many places throughout this function
                // Their values are set by hasChanged()
                var newValue,
                    oldValue;
                
                if ( hasChanged('dataDisplay.dataGrouping') ) {
                    scope.chart.setDataGroupingEnabled( newValue, false );
                    recreate = true;
                }
                
                if ( hasChanged('dataDisplay.gaps') ) {
                    // Just recreate the chart to let lasp_chart code apply data with calculated gaps
                    // The gaps are calculated in the ChartData object
                    recreate = true;
                }
                
                if ( hasChanged('dataDisplay.seriesDisplayMode') ) {
                    // ensure seriesDisplayMode is a valid value
                    var validValues = ['lines','points','linesAndPoints'];
                    if ( validValues.indexOf(newValue) === -1 ) {
                        console.error( 'Error: "' + newValue + '" is an invalid value for seriesDisplayMode. Must be one of: ' + validValues.join(',') );
                    } else {
                        scope.chart.setSeriesDisplayMode( newValue, false );
                        redraw = true;
                    }
                }
                
                if ( hasChanged('dataDisplay.showMinMax') ) {
                    if ( scope.frameScope.datasetType === DatasetTypes.ANALOG ) {
                        scope.chart.setRangeVisibility( newValue, false );
                        redraw = true;
                    }
                }
                
                if ( hasChanged('selectedLimitsIndex') ) {
                    // make sure the selected limits index stays within a valid range.
                    if ( newValue >= dataArray.length ) {
                        scope.menuOptions.selectedLimitsIndex = 0;
                    }
                    // run the same code for when menuOptions.view.limits changes. This will update the limit bands if limits are currently shown
                    onViewLimitsChanged();
                    // re-apply y axis scaling values if scaled to limits
                    if ( scope.menuOptions.yAxis.scaling.type === 'yellow' || scope.menuOptions.yAxis.scaling.type === 'red' ) {
                        onYAxisScalingChanged();
                    }
                    redraw = true;
                }

                if ( hasChanged('selectedXAxisIndex') ) {
                    // make sure the selected xaxis index stays within a valid range.
                    if ( newValue >= dataArray.length ) {
                        scope.menuOptions.selectedXAxisIndex = 0;
                    }
                    // update the offset property on the chart.
                    scope.chart.xAxisValueOffset = ChartData.parseOffset( dataArray[scope.menuOptions.selectedXAxisIndex].offset );
                    redraw = true;
                }
                
                if ( hasChanged('timeLabels.format') ) {
                    scope.chart.setXAxisLabels( newValue, false );
                    // With raw value formatting, add an x-axis title. Otherwise, the date formatting obviously indicates that the x-axis is time, so clear the x-axis title.
                    scope.chart.setXAxisTitle( newValue === 'raw' ? dataArray[0].getXNameAndUnits() : '', false );
                    redraw = true;
                }
                
                if ( hasChanged('timeLabels.legendFormatter') ) {
                    scope.chart.legendFormatter = newValue;
                    redraw = true;
                }

                if ( hasChanged('timeLabels.momentTimeFormat') ) {
                    scope.chart.momentTimeFormat = newValue;
                    redraw = true;
                }

                if ( hasChanged('timeLabels.timezone') ) {
                    scope.chart.timezone = newValue;
                    redraw = true;
                }
                
                if ( hasChanged('view.events') ) {
                    // add events series to the plot or remove them
                    if ( newValue ) {
                        // when this is called during plot creation, the events will not actually be added here,
                        // because the highstock chart object doesn't yet exist.
                        // The events series are added in createChart().
                        addEventsToChart( scope.frameScope.eventsData.events, false );
                    } else {
                        scope.chart.removeEvents( false );
                    }
                    updateViewEventTypes();
                    redraw = true;
                }

                if ( hasChanged('view.eventTypes') ) {
                    updateViewEventTypes();
                    redraw = true;
                }
                
                if ( hasChanged('view.horizontalCrosshair') ) {
                    scope.chart.setYAxisCrosshairEnabled( newValue, false );
                    redraw = true;
                }
                
                if ( hasChanged('view.legend') ) {
                    scope.chart.setLegendEnabled( newValue, false );
                    redraw = true;
                }
                
                if ( hasChanged('view.limits') ) {
                    if ( scope.frameScope.datasetType === DatasetTypes.ANALOG ) {
                        onViewLimitsChanged();
                        redraw = true;
                    }
                }
                
                if ( hasChanged('view.limitViolationFlags') ) {
                    // define the zones for each separate item that was downloaded.
                    // if we're turning this feature off, defining the zones as empty arrays will remove the coloring.
                    var zoneColors = scope.chart.colorTheme.limits.zones;
                    chartDataZones = dataArray.map( function(chartData) {
                        return newValue ? chartData.getLimitZones(zoneColors.good, zoneColors.warn, zoneColors.bad) : [];
                    });
                    applyColorZones();
                    redraw = true;
                }
                
                if ( hasChanged('view.navigator') ) {
                    scope.chart.setNavigatorEnabled( newValue, false );
                    
                    if ( !oldValue && newValue ) {
                        // Due to a highstock bug, we must sometimes recreate the plot when showing the navigator.
                        // We can switch to always redrawing when this is resolved:
                        // https://github.com/highcharts/highcharts/issues/7067
                        recreate = true;
                    } else {
                        redraw = true;
                    }
                }
                
                if ( hasChanged('view.scrollbar') ) {
                    scope.chart.setScrollbarEnabled( newValue, false );
                    redraw = true;
                }
                
                if ( hasChanged('yAxis.labels.hideUnusedDiscreteLabels') ) {
                    if ( scope.frameScope.datasetType === DatasetTypes.DISCRETE ) {
                        if ( newValue ) {
                            scope.chart.hideUnusedDiscreteLabels( yAxisBreaks, allUsedDiscreteVals, false );
                        } else {
                            scope.chart.showAllDiscreteLabels( scope.typeConversions, false );
                        }
                        redraw = true;
                    }
                }
                
                if ( hasChanged('yAxis.labels.showNumericDiscreteValues') ) {
                    // always show numeric values if the discrete formatters are not enabled
                    newValue = scope.frameScope.discreteFormattersEnabled ? newValue : true;
                    if ( scope.frameScope.datasetType === DatasetTypes.DISCRETE ) {
                        scope.chart.setDiscreteFormatters( newValue ? false : scope.typeConversions, false );
                        redraw = true;
                    }
                }

                if ( hasChanged('yAxis.scaling') ) {
                    onYAxisScalingChanged();
                    redraw = true;
                }
                
                if ( hasChanged('yAxis.scaleType') ) {
                    if ( scope.frameScope.datasetType === DatasetTypes.ANALOG ) {
                        scope.chart.setYAxisScaleType( newValue, false );
                        redraw = true;
                    }
                }
                
                if ( hasChanged('zoomMode') ) {
                    scope.chart.setZoomType( newValue, false );
                    redraw = true;
                }
                
                
                // execute only the most expensive chart-refreshing function, because the more expensive ones will invoke the less expensive ones
                if ( updateChart ) {
                    if ( recreate ) {
                        createChart();
                    } else if ( redraw ) {
                        scope.chart.redraw();
                    }
                }
                
                // convenience function for checking if an option has changed.
                // Takes a menuOption name as a string, like 'yAxis.scaling.type'
                // This function replaces if-statements like this:
                //    if ( !angular.equals(oldOptions.dataDisplay.gaps, scope.menuOptions.dataDisplay.gaps) )
                // ... with something more readable like this:
                //    if ( hasChanged('dataDisplay.gaps') )
                // This also sets the values of olValue and newValue
                function hasChanged( optionNameAsString ) {
                    if ( applyAll ) {
                        oldValue = newValue = eval( 'scope.menuOptions.' + optionNameAsString );
                        return true;
                    }

                    oldValue = eval( 'oldOptions.' + optionNameAsString );
                    newValue = eval( 'scope.menuOptions.' + optionNameAsString );
                    var changed = !angular.equals( oldValue, newValue );
                    if ( changed ) {
                        Logger.log( 'menuOption changed: ' + optionNameAsString );
                    }
                    return changed;
                }
            };

            function applyColorZones() {
                // update each series with the appropriate color zones, as defined in chartDataZones
                scope.chart.getAllSeries().forEach( function(series, i) {
                    var userOptions = series.userOptions;
                    if ( typeof userOptions !== 'undefined' ) {
                        var chartDataIndex = userOptions.chartDataIndex;
                        if ( typeof chartDataIndex !== 'undefined' ) {
                            scope.chart.setSeriesColorZones( series.index, chartDataZones[chartDataIndex], false );
                        }
                    }
                });
            }

            // update the settings for viewing limits
            function onViewLimitsChanged() {
                if ( scope.menuOptions.view.limits === true ) {
                    var limitsIndex = scope.menuOptions.selectedLimitsIndex;
                    if ( typeof limitsIndex !== 'undefined' ) {
                        var metadata = dataArray[ limitsIndex ].getMetadata();
                        if ( metadata.Limits ) {
                            scope.chart.setYAxisLimitBands( metadata.Limits.Red.Low, metadata.Limits.Red.High, metadata.Limits.Yellow.Low, metadata.Limits.Yellow.High, false );
                        }
                    }
                } else {
                    scope.chart.disableYAxisLimitBands( false );
                }
            }
            
            // apply the settings in menuOptions.yAxis.scaling
            function onYAxisScalingChanged() {
                if ( scope.frameScope.datasetType === DatasetTypes.DISCRETE ) {
                    // y-axis scaling shouldn't be changed for discrete plots
                    return;
                }
                
                scope.frameScope.yAxisScalingError = undefined;
                
                var low = undefined;
                var high = undefined;
                var limitExtremes;
                
                // shorthand vars
                var selectedLimitsIndex = scope.menuOptions.selectedLimitsIndex;
                var scaling = scope.menuOptions.yAxis.scaling;
                
                if ( scaling.type === 'auto' ) {
                    low = null;
                    high = null;
                } else if ( scaling.type === 'custom' ) {
                    // check to make sure inputs are valid
                    if ( typeof scaling.low !== 'number' || typeof scaling.high !== 'number' ) {
                        scope.frameScope.yAxisScalingError = 'Please enter two numbers.';
                        return;
                    } else if ( scaling.low >= scaling.high ) {
                        scope.frameScope.yAxisScalingError = '"Low" must be lower than "High".';
                        return;
                    }
                    
                    limitExtremes = getExtremesWithPadding( scaling.low, scaling.high, scope.uiOptions.plotHeight );
                    low = limitExtremes.low;
                    high = limitExtremes.high;
                } else if ( scaling.type === 'yellow' || scaling.type === 'red' ) {
                    if ( typeof selectedLimitsIndex !== 'undefined' && typeof scope.frameScope.metadata[ selectedLimitsIndex ].Limits !== 'undefined' ) {
                        var selectedLimits = scope.frameScope.metadata[ selectedLimitsIndex ].Limits;
                        limitExtremes = scaling.type === 'yellow' ? getExtremesWithPadding( selectedLimits.Yellow.Low, selectedLimits.Yellow.High, scope.uiOptions.plotHeight )
                                : scaling.type === 'red' ? getExtremesWithPadding( selectedLimits.Red.Low, selectedLimits.Red.High, scope.uiOptions.plotHeight )
                                : { low: undefined, high: undefined };
                        low = limitExtremes.low;
                        high = limitExtremes.high;
                    } 
                }
                
                if ( typeof low !== 'undefined' ) {
                    scope.chart.setYAxisScaling( low, high, false );
                }
            }

            function updateViewEventTypes() {
                // update chart options to show or hide the extra y-axis
                scope.chart.setEventsOverlay( scope.menuOptions.view.events, scope.frameScope.eventsData, scope.menuOptions.view.eventTypes, false );
                scope.chart.setEventTypeVisibility( scope.menuOptions.view.eventTypes, false );
            }

            function addEventsToChart( events ) {
                var startMs = scope.timeRange.total.start === null ? undefined : scope.timeRange.total.start.getTime();
                var endMs = scope.timeRange.total.end === null ? undefined : scope.timeRange.total.end.getTime();
                events.forEach( function(event) {
                    var eventSeriesColor = ColorThemes.getColorForEventType( event.type, scope.frameScope.eventsData.types, scope.chart.colorTheme ).series;
                    scope.chart.addEvent( event, eventSeriesColor, startMs, endMs );
                });
            }
            
            scope.onSetUiOptions = function( oldOptions ) {
                var applyAll = typeof oldOptions === 'undefined';
                var updateChart = typeof scope.chart.chart !== false && !scope.frameScope.loading && !applyAll;
                
                var recreate = false,
                    redraw = false,
                    reflow = false;
                
                if ( applyAll || scope.uiOptions.colorTheme !== oldOptions.colorTheme ) {
                    scope.chart.setColorTheme( scope.uiOptions.colorTheme, false );
                    // Recreate the plot rather than updating it, because setting series colors correctly gets complicated.
                    // The user isn't likely to change the color theme often anyway.
                    recreate = true;
                }
                
                if ( applyAll || scope.uiOptions.plotHeight !== oldOptions.plotHeight ) {
                    scope.chart.setHeight( scope.uiOptions.plotHeight, false );
                    reflow = true;
                }
                
                if ( applyAll || scope.uiOptions.legendAlign !== oldOptions.legendAlign ) {
                    scope.chart.setLegendAlign( scope.uiOptions.legendAlign, false );
                    redraw = true;
                }

                if ( applyAll || scope.uiOptions.showResetZoomButton !== oldOptions.legendAlign ) {
                    scope.chart.setResetZoomButtonEnabled( scope.uiOptions.showResetZoomButton, false );
                    redraw = true;
                }

                Logger.log( 'Setting UI options' );
                
                // execute only the most expensive chart-refreshing function, because the more expensive ones will invoke the less expensive ones
                if ( updateChart ) {
                    if ( recreate ) {
                        createChart();
                    } else if ( redraw ) {
                        scope.chart.redraw();
                    } else if ( reflow && !scope.uiOptions.collapsed ) {
                        // save some cycles by not reflowing when the plot is collapsed
                        scope.chart.reflow();
                    }
                }
            };

            scope.openEventModal = function( eventDetails ) {
                // eventDetails contains type, start, end
                scope.modalInstance = $uibModal.open({
                    templateUrl: 'events_modal/events_modal.html',
                    controller: 'eventsModalCtrl',
                    controllerAs: '$ctrl',
                    size: 'md',
                    resolve: {
                        eventDetails: function () {
                            return eventDetails;
                        },
                        timeLabelsOptions: function() {
                            return scope.menuOptions.timeLabels;
                        }
                    }
                });
            };
            
        }
    };
}


/**
 * This describes a module with a directive and a factory.
 * The functions below this statement then define those two objects.
 */
angular.module( 'laspChart' )
.directive( 'highchart', [
    'Chart',
    'ChartData',
    'constants',
    'DatasetTypes',
    'LimitTypes',
    'ColorThemes',
    'Logger',
    '$q',
    '$window',
    '$timeout',
    '$uibModal',
    highchart
]);
