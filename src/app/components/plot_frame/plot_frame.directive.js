'use strict';

function plotFrame( $uibModal, $window, $timeout, $q, constants, latis, ChartData, EventsData, DatasetTypes, LoadingProgressTracker, Logger ) {
    return {
        restrict: 'A',
        templateUrl: 'plot_frame/plot_frame.html',
        scope: {
            initialMenuOptions: '= menuOptions',
            initialUiOptions: '=? uiOptions',
            datasets: '=?',
            data: '=?',
            initialTimeRange: '=? timeRange',
            chart: '=?',
            plotObj: '=?',
            plotList: '='
        },
        link: function( scope, element ) {
            var dataArray = [];
            var childScope;
            var cancelling = false;

            // menuOptions, uiOptions, and timeRange are initialized with default values and empty objects to ensure that we won't get an error when trying to access a property on a non-object

            // init menuOptions
            scope.menuOptions = angular.merge({
                dataDisplay: {
                    dataGrouping: constants.DEFAULT_DATA_GROUPING,
                    gaps: {
                        enabled: true,
                        threshold: 3
                    },
                    seriesDisplayMode: 'lines',
                    showMinMax: true
                },
                timeLabels: {},
                view: {
                    scrollbar: false,
                    events: false
                },
                yAxis: {
                    labels: {},
                    scaling: {},
                    scaleType: 'linear'
                },
                selectedXAxisIndex: 0,
                zoomMode: 'x'
            }, scope.initialMenuOptions );

            // eventsData holds data on the spacecraft events that occurred over the defined time period,
            // as well as metadata on different types of events.
            // This information is loaded at the same time as the telemetry items, or later if events are
            // toggled on after other data is loaded.
            scope.eventsData = undefined;

            // init uiOptions
            scope.uiOptions = angular.merge({
                disableMenuLabelText: 'Disable menu',
                plotHeight: constants.DEFAULT_PLOT_HEIGHT,
                colorTheme: constants.DEFAULT_COLOR_THEME,
                legendAlign: 'left',
                eventsURL: undefined
            }, scope.initialUiOptions );

            // init timeRange object
            // setting total.start or total.end to null instructs the chart to put no constraint on the minimum/maximum time as loaded from the server
            scope.timeRange = angular.merge({
                total: {
                    start: null,
                    end: null,
                    ertStart: null,
                    ertEnd: null
                },
                visible: {
                    start: null,
                    end: null
                }
            }, scope.initialTimeRange );
            sanitizeTimeRange();

            // init scope.datasets
            /* scope.datasets is an array of objects.
             * Each object looks like:
             * {
             *   accessURL: <string>,
             *   name: <string>,
             *   desc: <string>,
             *   offset: <number> or <string>,
             *   filters: {
             *       minmax: {
             *           enabled: <boolean>,
             *           min: <number>,
             *           max: <number>
             *       },
             *       delta: {
             *           enabled: <boolean>,
             *           value: <number>
             *       },
             *       change: {
             *           enabled: <boolean>
             *       }
             *   }
             * }
             */

            if ( typeof scope.datasets === 'undefined' ) {
                scope.datasets = [];
            }

            fixDatasetsObject();

            // scope.timeRange can contain null values, and we want to retain those values even after data has loaded.
            // In those cases, we still need a way to keep track of the loaded/visible range, as defined by the data returned from the server.
            // This variable updates whenever scope.timeRange updates.
            var actualTimeRange;
            setActualTimeRange();

            // init variables
            scope.constants = constants; // make it available to the template
            scope.plotObj = scope;
            scope.eventTableScope;
            scope.highchartScope;
            scope.chart = false;

            scope.history = [];

            scope.showBottomMenu = false;
            function closeDropdownMenus() {
                scope.plotMenuOpen = false;
                scope.zoomMenuOpen = false;
                scope.filterMenuOpen = false;
                scope.downloadMenuOpen = false;
            };
            closeDropdownMenus();

            scope.datasetType;
            scope.DatasetTypes = DatasetTypes; // to let the template access DatasetTypes
            scope.discreteFormattersEnabled = true;

            scope.loading = false;
            scope.loadingProgress = {
                kb: 0,
                percent: 0
            };

            var loadingProgressTrackers = [];

            scope.yellowViolations = undefined;
            scope.redViolations = undefined;

            scope.frameContentStyle = {
                height: scope.uiOptions.plotHeight + 'px'
            };

            scope.getElement = function() {
                return element;
            };

            function fixDatasetsObject() {
                // add an offset and filters object to each dataset if it doesn't have one
                scope.datasets = scope.datasets.map( function(ds) {
                    if ( typeof ds.offset === 'undefined' ) {
                        ds.offset = 0;
                    }
                    if ( typeof ds.filters === 'undefined' ) {
                        ds.filters = {};
                    }
                    if ( typeof ds.filters.minmax === 'undefined' ) {
                        ds.filters.minmax = {};
                    }
                    if ( typeof ds.filters.delta === 'undefined' ) {
                        ds.filters.delta = {};
                    }
                    if ( typeof ds.filters.change === 'undefined' ) {
                        ds.filters.change = {};
                    }
                    return ds;
                });

                // if there's only one dataset and it has an offset, normalize the offset to 0 and adjust the timerange
                if ( scope.datasets.length === 1 ) {
                    var offset = ChartData.parseOffset( scope.datasets[0].offset );
                    if ( offset !== 0 ) {
                        scope.datasets[0].offset = 0;
                        if ( scope.timeRange.total.start ) {
                            scope.timeRange.total.start = new Date( scope.timeRange.total.start.getTime() + offset );
                        }
                        if ( scope.timeRange.total.end ) {
                            scope.timeRange.total.end = new Date( scope.timeRange.total.end.getTime() + offset );
                        }
                        if ( scope.timeRange.visible.start ) {
                            scope.timeRange.visible.start = new Date( scope.timeRange.visible.start.getTime() + offset );
                        }
                        if ( scope.timeRange.visible.end ) {
                            scope.timeRange.visible.end = new Date( scope.timeRange.visible.end.getTime() + offset );
                        }
                    }
                }
            }

            // Returns whether the plot can combine with the given plot
            scope.canCombine = function( plot ) {
                try {
                    if (plot.plotObj !== scope.plotObj && plot.plotObj.datasetType === scope.datasetType) {
                        if (plot.plotObj.metadata[0].IndependentVariable.Units) {
                            if (plot.plotObj.metadata[0].IndependentVariable.Units === scope.metadata[0].IndependentVariable.Units) {
                                return true;
                            }
                        } else { // Check the variable name only if the variable units aren't set
                            if (plot.plotObj.metadata[0].IndependentVariable.Name &&
                                plot.plotObj.metadata[0].IndependentVariable.Name === scope.metadata[0].IndependentVariable.Name) {
                                return true;
                            }
                        }
                    }
                } catch (e) {
                    if (e instanceof TypeError) {
                        return false;
                    }
                }

                return false;
            };

            scope.isOverplot = function() {
                return scope.datasets.length > 1;
            };

            scope.hasOffsetDatasets = function() {
                return scope.datasets.some( function(ds) {
                    return ChartData.parseOffset( ds.offset ) !== 0;
                });
            };

            var closeDropdownMenusOnClick = function( $event ) {
                var clickedOnPlot = elementIsChildOf( angular.element($event.target), element );

                var apply = false;
                if ( scope.plotMenuOpen && (!clickedOnPlot || !$event.clickedPlotMenu) ) {
                    scope.plotMenuOpen = false;
                    apply = true;
                }

                if ( scope.filterMenuOpen && (!clickedOnPlot || !$event.clickedFilterMenu) ) {
                    scope.filterMenuOpen = false;
                    apply = true;
                }

                if ( scope.downloadMenuOpen && (!clickedOnPlot || !$event.clickedDownloadMenu) ) {
                    scope.downloadMenuOpen = false;
                    apply = true;
                }

                if ( scope.zoomMenuOpen && (!clickedOnPlot || !$event.clickedZoomMenu) ) {
                    scope.zoomMenuOpen = false;
                    apply = true;
                }

                if ( apply ) {
                    scope.$apply();
                }
            };

            // takes two jqlite objects, and returns true if element1 is a child of element2,
            // or if element1 is element2
            function elementIsChildOf( element1, element2 ) {
                var currentElement = element1;
                while( currentElement.length > 0 ) {
                    if ( currentElement[0] === element2[0] ) {
                        return true;
                    }
                    currentElement = currentElement.parent();
                }
                return false;
            }

            $window.addEventListener( 'click', closeDropdownMenusOnClick );

            scope.increaseResolutionButtonIsEnabled = function() {
                return !scope.uiOptions.collapsed && !scope.fullResolution && !scope.dataError && !scope.loading && !scope.visibleTimeRangeMatchesTotal() && scope.datasetType != DatasetTypes.DISCRETE && scope.dataExistsInCurrentRange;
            };

            scope.togglePlotMenu = function($event) {
                $event.clickedPlotMenu = true;
                scope.plotMenuOpen = !scope.plotMenuOpen;
                scope.plotMenuBtn = $event.target;
            };

            scope.toggleZoomMenu = function($event) {
                $event.clickedZoomMenu = true;
                scope.zoomMenuOpen = !scope.zoomMenuOpen;
            };

            scope.toggleFilterMenu = function($event) {
                $event.clickedFilterMenu = true;
                scope.filterMenuOpen = !scope.filterMenuOpen;
            };

            scope.toggleDownloadMenu = function($event) {
                $event.clickedDownloadMenu = true;
                scope.downloadMenuOpen = !scope.downloadMenuOpen;
            };

            scope.downloadButtonEnabled = function() {
                if ( typeof scope.noDataErrorKeys === 'undefined' || typeof scope.datasets === 'undefined' ) {
                    return false;
                }
                else return constants.EXPORTING && !scope.loading && scope.noDataErrorKeys.length < scope.datasets.length;
            };

            // scope.filterSelection tracks the filter button dropdown, which sets the same
            // filters across all datasets
            scope.filterSelection = {
                minmax: {
                    enabled: false,
                    min: null,
                    max: null
                },
                delta: {
                    enabled: false,
                    value: null
                },
                change: {
                    enabled: false
                }
            };

            scope.filtersAreActive = function() {
                // search through all the filters of each dataset, to see if any are enabled
                return scope.datasets.some( function(ds) {
                    return ds.filters.minmax.enabled || ds.filters.delta.enabled || ds.filters.change.enabled;
                });
            };

            // add / change filters for all datasets.
            scope.applyFilters = function() {
                scope.filterError = '';
                // check for errors before altering filter settings for datasets
                if ( scope.filterSelection.minmax.enabled ) {
                    var min = scope.filterSelection.minmax.min;
                    var max = scope.filterSelection.minmax.max;
                    if ( Number(min) !== min || isNaN(min) ) {
                        scope.filterError = "Min value must be a number";
                        return;
                    } else if ( Number(max) !== max || isNaN(max) ) {
                        scope.filterError = "Max value must be a number";
                        return;
                    } else if ( min >= max ) {
                        scope.filterError = "Min value must be less than max";
                        return;
                    }

                }
                
                if ( scope.filterSelection.delta.enabled ) {
                    var value = scope.filterSelection.delta.value;
                    if ( Number(value) !== value || isNaN(value) ) {
                        scope.filterError = "Delta max change must be a number";
                        return;
                    } else if ( value <= 0 ) {
                        scope.filterError = "Delta max change must be greater than 0";
                        return;
                    }

                }

                // apply the changes to all datasets
                scope.datasets.forEach( function(ds) {
                    ds.filters = angular.copy( scope.filterSelection );
                });

                // close the filter menu
                scope.filterMenuOpen = false;
            };

            // get the query used in the URL to tell latis to filter the data
            scope.getFilterQuery = function( dataset ) {
                var query = '';
                if ( scope.datasetType === DatasetTypes.ANALOG ) {
                    // minmax filter
                    if ( dataset.filters.minmax.enabled ) {
                        if ( typeof dataset.filters.minmax.min === 'number' ) {
                            query += '&value>' + dataset.filters.minmax.min;
                        }
                        if ( typeof dataset.filters.minmax.max === 'number' ) {
                            query += '&value<' + dataset.filters.minmax.max;
                        }
                    }

                    // delta filter
                    if ( dataset.filters.delta.enabled && typeof dataset.filters.delta.value === 'number' ) {
                        query += '&maxDelta(value,' + dataset.filters.delta.value + ')';
                    }
                }

                // change filter
                if ( dataset.filters.change.enabled ) {
                    query += '&thin()';
                }
                return query;
            };

            /**
             * @ngdoc method
             * @name setTimeRange
             * @methodOf plotFrame
             * @description
             * Sets a new total and/or visible time range for the plot. If needed, the plot will download new data.
             * Adds the old timeRange state to the history stack by default.
             *
             * @param {TimeRange} newTimeRange The new total and visible time range the plot should display. If any of the values in newTimeRange are undefined, the plot's respective values will remain the same.
             * @param {boolean} [addToHistory=true] Whether to add the plot's current time range state to the history stack.
             * @example
             * scope.setTimeRange({
             *     total: {
             *         start: new Date('Feb 20, 2000 00:00:00'),
             *         end: new Date('Feb 21, 2000 00:00:00')
             *     },
             *     visible: {
             *         start: new Date('Feb 20, 2000 12:00:00'),
             *         end: undefined
             *     }
             * }, true );
             */
            scope.setTimeRange = function( newTimeRange, addToHistory ) {
                if ( typeof addToHistory === 'undefined' ) {
                    addToHistory = true;
                }

                var oldTimeRange = angular.copy(scope.timeRange);

                // overwrite the current time range with the passed values
                // using angular.merge ensures that we won't set any values to undefined
                angular.merge( scope.timeRange, newTimeRange );

                sanitizeTimeRange();

                setActualTimeRange();

                if ( angular.equals(scope.timeRange, oldTimeRange ) ) {
                    return; // no changes made, so nothing needs to be done.
                }

                if ( addToHistory ) {
                    // Add the previous state to history
                    scope.history.push( oldTimeRange );
                    scope.$emit( 'historyAdded', scope.history );
                }

                // if the total time range has changed, load new data
                if ( !angular.equals(scope.timeRange.total, oldTimeRange.total) ) {
                    scope.downloadAllDatasets();
                } else if ( !angular.equals(scope.timeRange.visible, oldTimeRange.visible) ) {
                    // if the visible time range has changed, apply it
                    // only execute this block if the total time range didn't change, because if both total and visible time ranges changed,
                    // the code for the child scope will apply the visible range when the new data has loaded.
                    childScope.applyVisibleTimeRange();
                }
            };

            /**
             * @ngdoc method
             * @name getTimeRange
             * @methodOf plotFrame
             * @description
             * Returns the plot's current total and visible time range.
             *
             * @returns {Object} The plot's time range.
             */
            scope.getTimeRange = function() {
                // Rather than returning scope.timeRange, return actualTimeRange so that we can avoid returning nulls if possible
                return angular.copy( actualTimeRange );
            };

            /**
             * @ngdoc method
             * @name openTimeRangeModal
             * @methodOf plotFrame
             * @description
             * Opens a modal to select a new total time range.
             *
             * @returns {Object} The plot's time range.
             */
            scope.openTimeRangeModal = function() {
                scope.modalInstance = $uibModal.open({
                    templateUrl: 'timerange_modal/timerange_modal.html',
                    controller: 'timeRangeModalCtrl',
                    size: 'lg',
                    resolve: {
                        data: function () {
                            return {
                                timeRange: scope.getTimeRange(),
                                menuOptions: scope.getMenuOptions(),
                                hasOffsetDatasets: scope.hasOffsetDatasets()
                            };
                        }
                    }
                });

                scope.modalInstance.result.then( function(data) {
                    // apply the time range and format set in the modal
                    scope.setMenuOptions({
                        timeLabels: {
                            momentTimeFormat: data.timeFormat
                        }
                    });

                    scope.setTimeRange({
                        total: {
                            start: data.date.start,
                            end: data.date.end
                        },
                        visible: {
                            start: data.date.start.getTime(),
                            end: data.date.end.getTime()
                        }
                    });
                });
            };

            /**
             * @ngdoc method
             * @name visibleTimeRangeMatchesTotal
             * @methodOf plotFrame
             * @description
             * Determines whether the currently visible time range is the same as the total loaded time range.
             *
             * @returns {boolean} Whether visible and total time ranges are the same.
             */
            scope.visibleTimeRangeMatchesTotal = function() {
                if ( actualTimeRange.total.start === null || actualTimeRange.total.end === null ) return true;
                return actualTimeRange.visible.start.getTime() === actualTimeRange.total.start.getTime()
                    && actualTimeRange.visible.end.getTime()   === actualTimeRange.total.end.getTime();
            };


            /**
             * @ngdoc method
             * @name increaseResolution
             * @methodOf plotFrame
             * @description
             * Sets the total time range to match the currently visible time range and loads new data.
             * Assuming that the server doesn't always return the full resolution data, this effectively increases the resolution of the loaded data.
             */
            scope.increaseResolution = function() {
                scope.setTimeRange({
                    total: {
                        start: new Date( actualTimeRange.visible.start ),
                        end: new Date( actualTimeRange.visible.end )
                    }
                });
            };

            /**
             * @ngdoc method
             * @name resetZoom
             * @methodOf plotFrame
             * @description
             * Sets the visible time range to match the current total time range.
             */
            scope.resetZoom = function() {
                if ( childScope.resetYZoom ) childScope.resetYZoom();
                scope.setTimeRange({
                    visible: {
                        start: new Date( actualTimeRange.total.start ),
                        end: new Date( actualTimeRange.total.end )
                    }
                });
            };

            /**
             * @ngdoc method
             * @name undoZoom
             * @methodOf plotFrame
             * @description
             * Undoes the last time range change performed on the plot.
             */
            scope.undoZoom = function() {
                if ( scope.history.length > 0 ) {
                    scope.setTimeRange( scope.history.pop(), false );
                }
            };

            /**
             * @ngdoc method
             * @name setTimeRangeByDuration
             * @methodOf plotFrame
             * @description
             * Sets a new time range (both total and visible time ranges) based on a duration of time, with the center point of the currently visible time range at the center of the new time range.
             *
             * @param {Number} duration The duration of the new time range, in milliseconds.
             */
            scope.setTimeRangeByDuration = function( duration ) {
                var currentRange = actualTimeRange.visible.end.getTime() - actualTimeRange.visible.start.getTime();
                var center = currentRange/2 + actualTimeRange.visible.start.getTime();

                // set the new range based on the old center point and the new duration
                var start = center - duration/2;
                var end = center + duration/2;

                if ( duration > constants.MINIMUM_RANGE && start < end ) { //define a minimum range
                    scope.setTimeRange({
                        total: {
                            start: new Date(start),
                            end: new Date(end)
                        },
                        visible: {
                            start: new Date(start),
                            end: new Date(end)
                        }
                    });
                }
            };

            /**
             * @ngdoc method
             * @name zoom
             * @methodOf plotFrame
             * @description
             * Zooms in or out relative to the current visible time range, setting a new time range (both total and visible time ranges).
             * If `ratio > 1`, the new time range will be longer than the current time range, effectively zooming out.
             * If `ratio < 1`, the new time range will be shorter than the current time range, effectively zooming in.
             *
             * @param {Number} ratio The ratio of the duration of the new range to the duration of the current visible time range.
             */
            scope.zoom = function( ratio ) {
                scope.setTimeRangeByDuration( (actualTimeRange.visible.end.getTime() - actualTimeRange.visible.start.getTime()) * ratio );
            };

            /**
             * @ngdoc method
             * @name zoomOut
             * @methodOf plotFrame
             * @description
             * Zooms the plot by an amount defined by the constant `ZOOM_OUT_RATIO`.
             */
            scope.zoomOut = function() {
                scope.zoom( constants.ZOOM_OUT_RATIO );
            };

            /**
             * @ngdoc method
             * @name zoomIn
             * @methodOf plotFrame
             * @description
             * Zooms the plot by an amount defined by the constant `ZOOM_IN_RATIO`.
             */
            scope.zoomIn = function() {
                scope.zoom( constants.ZOOM_IN_RATIO );
            };

            /**
             * @ngdoc method
             * @name pan
             * @methodOf plotFrame
             * @description
             * Pans the plot by a defined ratio, relative to the current visible time range. Sets a new time range (both total and visible).
             * If `ratio < 0`, the plot will pan to the left.
             * If `ratio > 0`, the plot will pan to the right.
             * A value of 1 corresponds to the currently visible duration, so if `ratio = 1`, the plot will pan one "screen" to the right, i.e.
             * the new start date will be equal to the old end date.
             *
             * @param {Number} ratio The ratio representing how far to pan. Mathematically, the ratio represents `(newStart - oldStart) / (oldEnd - oldStart)`
             */
            scope.pan = function( ratio ) {
                var currentDuration = actualTimeRange.visible.end.getTime() - actualTimeRange.visible.start.getTime();
                var newStartTime = ratio * currentDuration + actualTimeRange.visible.start.getTime();
                scope.setTimeRange({
                    total: {
                        start: new Date( newStartTime ),
                        end: new Date( newStartTime + currentDuration )
                    },
                    visible: {
                        start: new Date( newStartTime ),
                        end: new Date( newStartTime + currentDuration )
                    }
                });
            };

            /**
             * @ngdoc method
             * @name panLeft
             * @methodOf plotFrame
             * @description
             * Pans the plot by an amount defined by the constant `PAN_LEFT_RATIO`.
             */
            scope.panLeft = function() {
                scope.pan( constants.PAN_LEFT_RATIO );
            };

            /**
             * @ngdoc method
             * @name panLeft
             * @methodOf plotFrame
             * @description
             * Pans the plot by an amount defined by the constant `PAN_RIGHT_RATIO`.
             */
            scope.panRight = function() {
                scope.pan( constants.PAN_RIGHT_RATIO );
            };

            /**
             * @ngdoc method
             * @name setMenuOptions
             * @methodOf plotFrame
             * @description
             * Applies one or more new menu options.
             *
             * @param {Object} options The new options to set. The passed object should have the same structure as menuOptions.
             * @example
             * scope.setMenuOptions({
             *     view: {
             *         limits: true
             *     },
             *     zoomMode: 'xy'
             * });
             */
            scope.setMenuOptions = function( options ) {
                // Before we update the menuOptions object, make a copy of its current state for comparison.
                // We'll only want to execute code if properties have actually changed
                var oldOptions = angular.copy( scope.menuOptions );
                angular.merge( scope.menuOptions, options );
                // angular.merge treats arrays like merge-able objects...
                // {a: [5,6]} merged into {a: [1,2,3]} will result in {a: [5,6,3]}
                // but we want to replace some array values, not "merge" them.
                if ( options.view !== undefined && options.view.eventTypes !== undefined ) {
                    scope.menuOptions.view.eventTypes = angular.copy(options.view.eventTypes);
                }

                // make sure some menu controls reflect the state of menuOptions
                setMenuControls();

                // emit an event if the options menu has been disabled
                if ( scope.menuOptions.menuDisabled && !oldOptions.menuDisabled ) {
                    scope.$emit( 'menuDisabled' );
                }

                if ( scope.menuOptions.view.events && !oldOptions.view.events ) {
                    // this will reset the chart and get/remove event data
                    scope.downloadAllDatasets();
                    return;
                }

                // pass the info down to the child scope so it can act as necessary
                if ( childScope ) {
                    childScope.onSetMenuOptions( oldOptions );
                }
            };

            /**
             * @ngdoc method
             * @name getMenuOptions
             * @methodOf plotFrame
             * @description
             * Returns a copy of the plot's current menu options.
             */
            scope.getMenuOptions = function() {
                // return a copy of the menuOptions object, so the original object can only be changed via setMenuOptions
                return angular.copy( scope.menuOptions );
            };

            /**
             * @ngdoc method
             * @name setUiOptions
             * @methodOf plotFrame
             * @description
             * Applies one or more new UI options.
             *
             * @param {Object} options The new options to set. The passed object should have the same structure as uiOptions.
             * @example
             * scope.setUiOptions({
             *     collapsed: false,
             *     showResetZoomButton: true
             * });
             */
            scope.setUiOptions = function( options ) {
                var oldOptions = angular.copy( scope.uiOptions );
                angular.merge( scope.uiOptions, options );

                if ( scope.uiOptions.plotHeight !== oldOptions.plotHeight ) {
                    scope.frameContentStyle.height = scope.uiOptions.plotHeight + 'px';
                }

                if ( childScope ) {
                    childScope.onSetUiOptions( oldOptions );
                }
            };

            /**
             * @ngdoc method
             * @name getUiOptions
             * @methodOf plotFrame
             * @description
             * Returns a copy of the plot's current UI options.
             */
            scope.getUiOptions = function() {
                return angular.copy( scope.uiOptions );
            };

            function beforeSetData() {
                var deferred = $q.defer();

                scope.yellowViolations = 0;
                scope.redViolations = 0;
                scope.dataError = '';
                scope.dataErrorString = '';

                scope.noDataErrorKeys = [];
                scope.dataRequests = [];
                scope.metadata = [];
                dataArray = [];

                scope.setTitle();
                closeDropdownMenus();

                // use a brief timeout to let child scopes initialize before we continue
                scope.$applyAsync( function() {
                    setupChildScope();
                    deferred.resolve();
                });

                return deferred.promise;
            }

            function afterSetData() {
                // if scope.timeRange contains nulls, we need to find the actual time range as returned by the loaded data
                setActualTimeRange();
                childScope.afterAllDatasetsDownloaded();
            }

            scope.downloadAllDatasets = function() {
                if ( scope.datasets.length === 0 ) {
                    return;
                }

                // cancel old requests before making new ones
                if ( scope.dataRequests !== undefined && scope.dataRequests.length > 0 && scope.cancel !== undefined ) {
                    scope.cancel.promise.then( function() {
                        // mark each ChartData object as cancelled, so that
                        // it won't show an error message when the promise rejects
                        dataArray.forEach( function(chartData) {
                            chartData.cancelled = true;
                        });
                        continueDownloadingAllDatasets();
                    });
                    // cancel all current downloads by resolving the cancel promise
                    scope.cancel.resolve();
                } else {
                    continueDownloadingAllDatasets();
                }
            };

            function continueDownloadingAllDatasets() {
                scope.cancel = $q.defer();
                scope.loading = true;

                var accessURL = scope.datasets[0].accessURL;
                // determine what kind of plot this is
                // users aren't allowed to overlay multiple different kinds of datasets on one plot, so the plot type is determined by only one of the datasets
                if ( accessURL.indexOf('Discrete') !== -1 ) {
                    scope.datasetType = DatasetTypes.DISCRETE;
                } else if ( accessURL.indexOf('String') !== -1 ) {
                    scope.datasetType = DatasetTypes.EVENT_TABLE;
                } else {
                    scope.datasetType = DatasetTypes.ANALOG;
                }

                beforeSetData().then( function() {
                    resetLoadingProgress();
                    loadingProgressTrackers = [];

                    scope.datasets.forEach( downloadDataset );

                    // download events data too if needed
                    if ( scope.menuOptions.view.events && typeof scope.uiOptions.eventsURL !== 'undefined' ) {
                        downloadEventsData();
                    }

                    // success and failure handlers are the same since the difference in logic for these is handled elsewhere
                    $q.all( scope.dataRequests ).then( onAllDataRequests, onAllDataRequests );

                    function onAllDataRequests(chartData1) {
                        // if one of the chartData objects was cancelled, it means all of them were
                        if ( chartData1.cancelled ) {
                            return;
                        }

                        resetLoadingProgress();
                        loadingProgressTrackers = [];

                        afterSetData();
                        scope.loading = false;
                    }
                });
            };

            function resetLoadingProgress() {
                scope.loadingProgress.kb = 0;
                scope.loadingProgress.percent = 0;
            }

            function sanitizeTimeRange() {
                // convert numbers or datestrings to date objects if necessary. The total and visible ranges should be stored as Dates.
                var tr = scope.timeRange; // shorthand
                var oldTimeRange = angular.copy( tr );
                if ( typeof tr.total.start === 'number' || typeof tr.total.start === 'string' ) tr.total.start = new Date( tr.total.start );
                if ( typeof tr.total.end === 'number' || typeof tr.total.end === 'string' ) tr.total.end = new Date( tr.total.end );
                if ( typeof tr.visible.start === 'number' || typeof tr.visible.start === 'string' ) tr.visible.start = new Date( tr.visible.start );
                if ( typeof tr.visible.end   === 'number' || typeof tr.visible.end === 'string' ) tr.visible.end = new Date( tr.visible.end );

                if ( !angular.equals(oldTimeRange, tr) ) {
                    console.warn( 'Lasp-highstock deprecation notice: timeRange values should be Date objects.', oldTimeRange );
                }
            }

            function setActualTimeRange() {
                actualTimeRange = angular.copy( scope.timeRange );

                if ( dataArray.length > 0 ) {
                    // find the overall time range given by all the data
                    var dataTimeRange = dataArray.reduce( function(computedTimeRange, data) {
                        var range = data.getXRange();
                        if ( range ) {
                            return {
                                start: Math.min( computedTimeRange.start, range.start ),
                                end: Math.max( computedTimeRange.end, range.end )
                            };
                        } else {
                            return computedTimeRange;
                        }

                    }, {
                        start: Infinity,
                        end: -Infinity
                    });

                    // we can only compute total time range if we have data
                    if ( actualTimeRange.total.start === null ) {
                        actualTimeRange.total.start = new Date( dataTimeRange.start );
                    }
                    if ( actualTimeRange.total.end === null ) {
                        actualTimeRange.total.end = new Date( dataTimeRange.end );
                    }
                }

                // if the visible range has nulls, set the value to whatever is defined in the total range
                if ( actualTimeRange.visible.start === null && actualTimeRange.total.start !== null ) {
                    actualTimeRange.visible.start = new Date( actualTimeRange.total.start );
                }
                if ( actualTimeRange.visible.end === null && actualTimeRange.total.end !== null ) {
                    actualTimeRange.visible.end = new Date( actualTimeRange.total.end );
                }
            }

            function updateMainLoadingProgress() {
                // Loop through all loading progress trackers. Average the percents and total the kb's
                resetLoadingProgress();
                loadingProgressTrackers.forEach( function(tracker) {
                    scope.loadingProgress.kb += tracker.kb;
                    // if any of the trackers report a null percent, then any guess we make on overall percent across all
                    // datasets will be inaccurate, so set the overall percent to null
                    scope.loadingProgress.percent = ( scope.loadingProgress.percent === null || tracker.percent === null )
                        ? null
                        : scope.loadingProgress.percent + tracker.percent;
                });

                if ( scope.loadingProgress.percent === null ) {
                    // Progress percent is not calculable. Show 100% so that there's at least a loading graphic to look at.
                    scope.loadingProgress.percent = 100;
                } else {
                    // average the percent
                    scope.loadingProgress.percent /= loadingProgressTrackers.length;
                }
            }

            var downloadEventsData = function() {
                var eventsAccessURL = scope.uiOptions.eventsURL;
                var requestStartTime, requestEndTime;
                // if the URL doesn't have a "?" in it, add it now so we can append GET parameters
                if ( eventsAccessURL.indexOf('?') === -1 ) {
                    eventsAccessURL += '?';
                }
                //add start and stop times if available
                if ( scope.timeRange.total.start !== null && scope.timeRange.total.end !== null ) {
                    // save the start/end time values for use in the progress event handler
                    requestStartTime = scope.timeRange.total.start.getTime();
                    requestEndTime = scope.timeRange.total.end.getTime();
                    if ( !isNaN(requestStartTime) && !isNaN(requestEndTime) ) {
                        eventsAccessURL += '&time>=' + scope.timeRange.total.start.toISOString() + '&time<=' + scope.timeRange.total.end.toISOString();
                    }
                }
                // set up an object to track progress of the download
                var tracker = new LoadingProgressTracker( requestStartTime, requestEndTime, updateMainLoadingProgress, LoadingProgressTracker.dataTypes.events );
                loadingProgressTrackers.push( tracker );

                scope.eventsData = new EventsData();
                var eventsPromise = scope.eventsData.downloadData( eventsAccessURL, scope.cancel, tracker.onProgress );
                scope.dataRequests.push( eventsPromise );
                eventsPromise.then( function() {
                    // if menuOptions.view.eventTypes isn't set, set it now to display all event types
                    if ( scope.menuOptions.view.eventTypes === undefined ) {
                        scope.menuOptions.view.eventTypes = scope.eventsData.types.map( function(type) {
                            return type.id;
                        });
                    }
                });
            };

            var downloadDataset = function( dataset ) {
                //create accessURLs
                var accessURL = dataset.accessURL;
                var requestStartTime, requestEndTime;
                var dateRange = scope.timeRange.total;
                //add ERT if available
                if( dateRange.ertStart !== null && dateRange.ertEnd !== null ) {
                    accessURL += '&ERT>=' + dateRange.ertStart + '&ERT<=' + dateRange.ertEnd;
                }

                //add filters if enabled
                accessURL += scope.getFilterQuery( dataset );

                //add start and stop times if available
                if ( dateRange.start !== null && dateRange.end !== null ) {
                    // account for a time offset
                    var offsetMs = ChartData.parseOffset( dataset.offset );
                    var adjustedDate = {
                        start: new Date( dateRange.start.getTime() + offsetMs ),
                        end:   new Date( dateRange.end.getTime() + offsetMs )
                    };
                    // save the start/end time values for use in the progress event handler
                    requestStartTime = adjustedDate.start.getTime();
                    requestEndTime = adjustedDate.end.getTime();
                    if ( !isNaN(requestStartTime) && !isNaN(requestEndTime) ) {
                        accessURL += '&time>=' + adjustedDate.start.toISOString() + '&time<=' + adjustedDate.end.toISOString();
                    }
                }

                // append extra options to the accessURL if applicable
                if ( typeof childScope.getExtraAccessURLParameters !== 'undefined' ) {
                    accessURL += childScope.getExtraAccessURLParameters();
                }

                // set up an object to track progress of the download
                var tracker = new LoadingProgressTracker( requestStartTime, requestEndTime, updateMainLoadingProgress );
                loadingProgressTrackers.push( tracker );

                dataArray.push( new ChartData() );
                var data = dataArray[dataArray.length-1];

                scope.dataRequests.push( data.downloadData( accessURL, scope.cancel, tracker.onProgress, dataset.indexes, dataset.offset ) );
                scope.dataRequests[ scope.dataRequests.length - 1 ].then( function() {
                    //check to see if we have non-zero data
                    if ( data.getData().length === 0 ) {
                        if ( scope.noDataErrorKeys.indexOf( data.getYName() ) === -1 ) {
                            scope.noDataErrorKeys.push( data.getYName() );
                        }

                        if ( scope.noDataErrorKeys.length > 0 ){
                            // build an error message to show
                            scope.dataErrorString = 'No data found for the given time range for the following dataset';
                            if ( scope.noDataErrorKeys.length !== 1 ) {
                                scope.dataErrorString += 's';
                            }
                            scope.dataErrorString += ': ' + scope.noDataErrorKeys.join(', ') + '.';
                        } else {
                            scope.dataErrorString = 'Unknown error getting data.';
                        }

                        scope.dataError = 'noData';
                    }

                    //make sure we don't add the same metadata twice
                    var nameExists = false;
                    for ( var i = 0; i < scope.metadata.length; i++ ) {
                        if ( scope.metadata[i] === undefined ) {
                            continue;
                        }
                        if ( scope.metadata[i].Name === data.getMetadata().Name ) {
                            nameExists = true;
                        }
                    }
                    if ( !nameExists ) {
                        // add this metadata to the metadata array, at an index number that matches the order in which we made the GET requests.
                        scope.metadata[ dataArray.indexOf(data) ] =  data.getMetadata();
                    }

                    scope.fullResolution = data.checkFullResolution();
                    data.checkLimitViolations();
                    scope.yellowViolations += data.numViolations.yellow;
                    scope.redViolations += data.numViolations.red;

                    childScope.afterDatasetDownloaded( data );
                }, function(chartData) {
                    // emit an event with the details of the failure, but not if we're cancelling it
                    // We're only interested in notifying the app of http failures that the user didn't cause
                    if ( !chartData.cancelled && !cancelling ) {
                        // add this dataset to the list of ones with no data
                        if ( scope.noDataErrorKeys.indexOf( dataset.name ) === -1 ) {
                            scope.noDataErrorKeys.push( dataset.name );
                        }

                        var error = data.getError();
                        // show error message
                        scope.dataError = 'Server Error';
                        scope.desc = error.code;
                        scope.dataErrorString = error.message;

                        scope.$emit( 'httpError', error.status );
                    }
                });

            };

            var setupChildScope = function() {
                // figure out whether we are displaying an event table or a chart
                childScope = scope.datasetType === DatasetTypes.EVENT_TABLE ? scope.eventTableScope : scope.highchartScope;
                // pass some often-used variables to the child scope
                childScope.menuOptions = scope.menuOptions;
                childScope.timeRange = scope.timeRange;
                childScope.uiOptions = scope.uiOptions;
                childScope.datasets = scope.datasets;
                childScope.data = scope.data;
                childScope.setDataArray( dataArray );

                childScope.init();
            };

            scope.openInfoModal = function() {
                scope.modalInstance = $uibModal.open({
                    templateUrl: 'metadata_modal/metadata_modal.html',
                    controller: 'dialogCtrl',
                    size: 'md',
                    resolve: {
                        data: function () {
                            return scope.metadata;
                        }
                    }
                });
            };

            scope.setTitle = function() {
                scope.name = '';
                scope.desc = '';
                for ( var i = 0; i < scope.datasets.length; i++ ) {
                    var ds = scope.datasets[i];
                    scope.name += ds.name;
                    scope.desc += ds.desc;
                    if ( i !== scope.datasets.length - 1 ) {
                       scope.name += ' / ';
                       scope.desc += ' / ';
                   }
                }
            };

            scope.onChangeDatasetsClicked = function() {
                closeDropdownMenus();
                scope.$emit( 'changeDatasetsClicked' );
            };

            scope.showChangeDatasetsMenuItem = function() {
                // look through the hierarchy of parents to see if any of them are listening for this event
                // Only show the button if there's a listener
                var currentScope = scope;
                do {
                    if ( typeof currentScope.$$listeners.changeDatasetsClicked !== 'undefined' ) {
                        // found a listener. Show the button.
                        return true;
                    }
                    currentScope = currentScope.$parent;
                } while ( currentScope );

                // no listener found.
                return false;
            };

            /**
             * @ngdoc method
             * @name removeDatasets
             * @methodOf plotFrame
             * @description
             * Removes one or more datasets from the plot.
             *
             * @param {array} datasetKeysToRemove An array of dataset names to remove. A dataset name is the value of the property `dataset.name`.
             * @example
             * scope.removeDatasets(['ADGYT1', 'ADST1CCNT']);
             */
            scope.removeDatasets = function( datasetKeysToRemove ) {
                // filter out the datasets which are included in datasetKeysToRemove
                scope.datasets = scope.datasets.filter( function( dataset ) {
                    return datasetKeysToRemove.indexOf( dataset.name ) === -1;
                });
                if ( scope.datasets.length === 0 ) {
                    scope.removePlot();
                }
            };

            scope.datasetIsEmpty = function( dataset ) {
                // the function takes either a name of a dataset, or a dataset object
                var datasetName = typeof dataset === 'string' ? dataset : dataset.name;
                return scope.noDataErrorKeys.indexOf( datasetName ) !== -1;
            };

            /**
             * @ngdoc method
             * @name splitDatasets
             * @methodOf plotFrame
             * @description
             * Splits one or more datasets into separate plots
             *
             * @param {array} datasetKeys An array of dataset names to split. A dataset name is the value of the property `dataset.name`.
             *   If undefiend, all datasets will be split into new plots.
             * @example
             * scope.splitDatasets(['ADGYT1', 'ADST1CCNT']);
             * scope.splitDatasets();
             */
            scope.splitDatasets = function( datasetKeys ) {
                // make a new array of plots made from individual datasets of the current plot
                var newPlots = [];
                for ( var i = 0; i < scope.datasets.length; i++ ) {
                    if ( typeof datasetKeys === 'undefined' || datasetKeys.indexOf(scope.datasets[i].name) !== -1 ) {
                        // isolate only one of the datasets
                        newPlots.push({
                            datasets: scope.datasets.splice( i, 1 ),
                            timeRange: angular.copy( scope.timeRange ),
                            menuOptions: angular.copy( scope.menuOptions ),
                            uiOptions: angular.copy( scope.uiOptions ),
                            plotObj: undefined,
                            chart: []
                        });
                        // correct the index value since we sliced the datasets array
                        i--;
                    }
                }

                // get array index of current plot
                var index;
                for ( i = 0; i < scope.plotList.length; i++ ) {
                    if ( scope.plotList[i].plotObj === scope ) {
                        index = i;
                        break;
                    }
                }

                // add the new plots to the list and remove this one
                // use splice rather than push so we can keep the order of plots as expected
                scope.plotList.splice.apply( scope.plotList, new Array( index+1, 0 ).concat( newPlots ) );

                if ( scope.datasets.length === 0 ) {
                    scope.removePlot();
                }
            };

            scope.absorbDatasetsOf = function( plotToAbsorb ) {
                // add the specified plot's datasets to this one
                for ( var i = 0; i < plotToAbsorb.datasets.length; i++ ) {
                    scope.datasets.push( plotToAbsorb.datasets[i] );
                }
                // kill the absorbed plot
                plotToAbsorb.plotObj.removePlot();
            };

            /**
             * @ngdoc method
             * @name downloadCSV
             * @methodOf plotFrame
             * @description
             * Download CSV data files given a plot object. If the plot has overplotted items, it opens a modal so the user can choose which items to download data for.
             */
            scope.downloadCSV = function() {
                // Chrome can't handle multiple download requests at once, so show a modal if there are multiple overplotted datasets
                if ( scope.datasets.length === 1 ) {
                    scope.downloadCSVforDatasets( 0 );
                } else {
                    // pop open a modal with download buttons
                    scope.modalInstance = $uibModal.open({
                        templateUrl: 'download_modal/download_modal.html',
                        controller: 'downloadCtrl',
                        size: 'md',
                        resolve: {
                            data: function() {
                                return {
                                    datasets: scope.datasets,
                                    downloadFunc: scope.downloadCSVforDatasets,
                                    datasetIsEmpty: scope.datasetIsEmpty
                                }
                            }
                        }
                    });
                }
            };

            /**
             * @ngdoc method
             * @name downloadImage
             * @methodOf plotFrame
             * @description
             * Download image of the plot.
             *
             * @param {string} filetype Filetype of the image. Accepts either 'png' or 'svg'.
             */
            scope.downloadImage = function( filetype ) {
                if ( scope.datasetType !== DatasetTypes.ANALOG && scope.datasetType !== DatasetTypes.DISCRETE ) {
                    console.error( 'Programmer error: downloadImage expected only for analog and discrete data' );
                }
                if ( filetype !== 'png' && filetype !== 'svg' && filetype !== 'pdf' ) {
                    console.error( 'Programmer error: only png, svg, and pdf are expected for downloadImage' );
                }
                // let the child scope handle the downloading of the image, since the specifics may vary based on what plot type this is
                // as of this comment, only a highcharts plot should handle this, but we may add more plot types that can generate image files
                childScope.downloadImage( filetype, scope.name );
            };

            /**
             * @ngdoc method
             * @name getDefaultYAxisLabelWidth
             * @methodOf plotFrame
             * @description
             * Get the pixel width of the y-axis label area. For plots which don't have a y-axis label area (like en Event Table), this returns 0.
             */
            scope.getDefaultYAxisLabelWidth = function() {
                if ( typeof childScope !== 'undefined' && typeof childScope.getDefaultYAxisLabelWidth !== 'undefined' ) {
                    return childScope.getDefaultYAxisLabelWidth();
                } else {
                    return 0;
                }
            };

            /**
             * @ngdoc method
             * @name setYAxisLabelWidth
             * @methodOf plotFrame
             * @description
             * For timeseries plots, sets the width of the y-axis label area.
             */
            scope.setYAxisLabelWidth = function( width ) {
                if ( typeof childScope.setYAxisLabelWidth !== 'undefined' ) {
                    childScope.setYAxisLabelWidth( width );
                }
            };

            /**
             * @ngdoc method
             * @name toggleEventType
             * @methodOf plotFrame
             * @description
             * Toggles the visibility of an event type.
             *
             * @param {number} eventType The event type (id) of the event to toggle.
             */
            scope.toggleEventType = function( eventType ) {
                var types = angular.copy( scope.menuOptions.view.eventTypes );
                var indexOfType = types.indexOf( eventType );
                if ( indexOfType >= 0 ) {
                    // the event type is currently in the list of visible types. Remove it.
                    types.splice( indexOfType, 1 );
                } else {
                    // the event type isn't in the array of visible types, so add it
                    types.push( eventType );
                }
                scope.setMenuOptions( {view:{eventTypes:types}} );
            };

            /**
             * @ngdoc method
             * @name downloadCSVforDatasets
             * @methodOf plotFrame
             * @description
             * Triggers a CSV download for one or more datasets at the given index or indices
             * Takes an undefined number of parameters, each one an index of a dataset to download
             */
            scope.downloadCSVforDatasets = function() {
                var datasetIndices = Array.prototype.slice.call( arguments ); // 'arguments' is not an array... convert it to one so we can use Array.prototype functions

                var CSVpaths = datasetIndices.map( function( val ) {
                    return scope.getCSVdownloadPath( val );
                });

                // tell the latis factory which datasets we want to download. It will decide how they are downloaded
                var timeFormatQuery;
                if ( scope.menuOptions.timeLabels.format === 'secondsSinceT0' ) {
                    timeFormatQuery = latis.timeFormatters.secondsSinceT0( actualTimeRange.total.start );
                } else {
                    timeFormatQuery = latis.timeFormatters.simple( scope.menuOptions.timeLabels.momentTimeFormat );
                }
                latis.downloadCSV( CSVpaths, timeFormatQuery );
            };

            /**
             * @ngdoc method
             * @name getCSVdownloadPath
             * @methodOf plotFrame
             * @description
             * Builds the URL path for one dataset to download a CSV of the data from latis
             *
             * @param {integer} index Index of the dataset to build a CSV path for
             */
            scope.getCSVdownloadPath = function( datasetIndex ) {
                // To make the download URL, take the URL we used to get the data
                var timeParams = '',
                    offsetDate;
                var offsetMs = ChartData.parseOffset( scope.datasets[datasetIndex].offset );
                if ( scope.timeRange.total.start !== null ) {
                    offsetDate = new Date( scope.timeRange.total.start.getTime() + offsetMs );
                    timeParams += '&time>=' + offsetDate.toISOString();
                }
                if ( scope.timeRange.total.end !== null ) {
                    offsetDate = new Date( scope.timeRange.total.end.getTime() + offsetMs );
                    timeParams += '&time<=' + offsetDate.toISOString();
                }

                return scope.datasets[datasetIndex].accessURL + timeParams + scope.getFilterQuery( scope.datasets[datasetIndex] );
            };

            /**
             * @ngdoc method
             * @name removePlot
             * @methodOf plotFrame
             * @description
             * removes the plot from the main list, and aborts any pending GET requests
             */
            scope.removePlot = function() {
                var found = false;
                for ( var index = 0; index < scope.plotList.length; index++ ) {
                    if ( scope === scope.plotList[index].plotObj ) {
                        found = true;
                        break;
                    }
                }
                if ( found ) {
                    scope.plotList[index] = null;
                    scope.plotList.splice( index, 1 );
                    scope.$emit( 'removePlot' );
                } else {
                    console.error( 'Can\'t remove plot??? Not found in plot list' );
                }
            };

            scope.$on( '$destroy', function() {
                Logger.log('$on: destroy - Removing click event listener');
                $window.removeEventListener( 'click', closeDropdownMenusOnClick );
                if ( typeof childScope.onDestroy !== 'undefined' ) {
                    childScope.onDestroy();
                }
                //cancel any outstanding requests
                cancelling = true;
                if ( typeof scope.cancel !== 'undefined' ) {
                    scope.cancel.resolve();
                }
            });

            // the child scope can change the visible time range by emitting this event
            scope.$on( 'setVisibleTimeRange', function( evt, min, max, updateScope ) {
                if ( scope.loading ) return;
                Logger.log( '$on: setVisibleTimeRange', min, max );

                // the child scope has changed what time range is visible, but we still need to update our data model and add the change to the zoom history.
                // If setTimeRange was previously called with a new visible range, the code would have added the change to the zoom history and set the new extremes on the plot.
                // In that case, the below call to setTimeRange will do nothing, because there will be no change to timeRange.visible
                scope.setTimeRange({
                    visible: {
                        start: new Date( min ),
                        end: new Date( max )
                    }
                });

                // check if the plot shows data points in the current range, for determining whether to show the "Increase resolution" button
                // this may be computationally expensive, so only check if we meet all other conditions for showing the button
                if ( !scope.fullResolution && !scope.dataError && !scope.loading && !scope.visibleTimeRangeMatchesTotal() && scope.datasetType !== DatasetTypes.DISCRETE ) {
                    scope.checkIfDataExistsInCurrentRange();
                }

                // when this function is called as a result of Highchart's "afterSetExtremes" callback firing, the scope needs to update.
                if ( updateScope ) {
                    $timeout( function() {
                        scope.$digest();
                    });
                }
            });

            scope.checkIfDataExistsInCurrentRange = function() {
                // false until proven true
                scope.dataExistsInCurrentRange = false;
                // loop through each data series
                /* it's fairly quick to loop through at most a few arrays of a few thousand points each (a few ms), but if  this ever
                 * takes a significant fraction of a second, we can switch to using a binary search algorithm instead
                 */
                for ( var i = 0; i < dataArray.length; i++ ) {
                    for ( var j = 0; j < dataArray[i].data.length; j++ ) {
                        var datum = dataArray[i].data[j];
                        /* when building the chart, we put null points at the beginning and end to force data-less areas to show at the
                         * beginning and end of the time range, if there are any. But we don't want to get fooled by these null points.
                         */
                        if ( datum[1] === null ) continue;
                        // if the timestamp of a data point is within the currently viewed range, we've seen enough
                        if ( datum[0] >= scope.timeRange.visible.start.getTime() && datum[0] <= scope.timeRange.visible.end.getTime() ) {
                            scope.dataExistsInCurrentRange = true;
                            return;
                        }
                    }
                }
                // no data is shown in current range :(
            };

            scope.updateTooltip = function( clearData ) {
                if ( typeof clearData === 'undefined' ) clearData = false;
                if ( childScope.updateTooltip ) childScope.updateTooltip( clearData );
            };

            scope.$watch( 'datasets', function( newDatasets, oldDatasets ) {
                if ( newDatasets === oldDatasets ) {
                    return;
                }
                // The new datasets object may not have the structure we want (filters, etc).
                // Add all the required properties, even though they may be empty.
                // Doing this will change scope.datasets, triggering the watcher again.
                // We don't want to fire initPlotFame() twice, so only do it if fixDatasetsObject()
                // has already made its changes.
                var newDatasetsCopy = JSON.stringify( newDatasets );
                fixDatasetsObject();
                if ( newDatasetsCopy == JSON.stringify(scope.datasets) ) {
                    Logger.log( '$watch: Datasets' );
                    scope.initPlotFrame();
                }
            }, true);

            // watch the width of the plot, which is determined by HTML/CSS
            var timer = false; //this allows us to debounce this $watcher, we don't want it updating with animations
            scope.$watch( function() {
                return element[0].clientWidth;
            }, function () {
                if ( timer ) {
                    $timeout.cancel( timer );
                }
                timer = $timeout( function() {
                    // scope.elementWidth is used by the HTML template for this directive
                    scope.elementWidth = element[0].clientWidth;
                    if ( typeof childScope !== 'undefined' && typeof childScope.onWidthChange !== 'undefined' ) {
                        childScope.onWidthChange();
                    }
                }, 100 );
            });

            function setMenuControls() {
                scope.menuControls = {
                    yAxisScalingLow: scope.menuOptions.yAxis.scaling.low,
                    yAxisScalingHigh: scope.menuOptions.yAxis.scaling.high,
                    gapThreshold: scope.menuOptions.dataDisplay.gaps.threshold
                };

                if ( scope.datasets.length > 0 ) {
                    // The built-in filter controls alter filters for all datasets simultaneously.
                    // Copy the filter settings for the first dataset we find that has filters enabled.
                    var d0filters = scope.datasets[0].filters;
                    if ( typeof d0filters === 'undefined' ) { return; }

                    var datasetWithFiltersEnabled = scope.datasets.find( function(ds) {
                        return ds.filters.minmax.enabled || ds.filters.delta.enabled || ds.filters.change.enabled;
                    });
                    if ( datasetWithFiltersEnabled !== undefined ) {
                        scope.filterSelection = angular.copy( datasetWithFiltersEnabled.filters );
                    } else {
                        // If no datasets have filters, initialize the filter controls to the filter settings
                        // of the first dataset, which will accurately set the controls to have no filters enabled.
                        scope.filterSelection = angular.copy( d0filters );
                    }
                }
            }

            scope.initPlotFrame = function() {
                scope.history = [];

                setMenuControls();

                //if we are given data, simply pass it to the chart
                if ( scope.data !== null && typeof scope.data !== 'undefined' ) {
                    //create an empty metadata array
                    dataArray = [];
                    scope.metadata = [];
                    // assume analog data rather than discrete or an event table. We may need to remove this assumption at some point if needs change.
                    scope.datasetType = DatasetTypes.ANALOG;
                    // wait for child scopes to initialize
                    beforeSetData().then( function() {
                        // @TODO: change the structure of scope.data which is passed to lasp-highstock, so that we define parameters, metadata, etc in a way that makes sense.
                        for ( var i = 0; i < scope.data.length; i++ ) {
                            dataArray.push( new ChartData() );
                            dataArray[i].setData( scope.data[i].data, scope.data[i].parameters, scope.data[i].indexes, scope.data[i].url, scope.data[i].name, scope.data[i].offset );
                        }
                        afterSetData();
                    });
                //otherwise we need to retrieve it from the server
                } else {
                    //send requests for data
                    scope.downloadAllDatasets();
                }
            };
            scope.initPlotFrame();
        }
    };
}


function datasetTypesService() {
    return {
        DISCRETE: 'discrete',
        ANALOG: 'analog',
        EVENT_TABLE: 'event_table'
    };
}

function limitTypesService() {
    return {
        GOOD: 'good',
        WARN: 'warn',
        BAD: 'bad'
    };
}

function headerGroupDirective() {
    return {
        restrict: 'A',
        templateUrl: 'plot_frame/header_button_group.html'
    };
}


angular.module( 'laspChart', [ 'latis', 'constants', 'ui.bootstrap' ] )
.service( 'DatasetTypes', [ datasetTypesService ])
.service( 'LimitTypes', [ limitTypesService ])
.directive( 'drawPlot', ['$uibModal', '$window', '$timeout', '$q', 'constants', 'latis', 'ChartData', 'EventsData', 'DatasetTypes', 'LoadingProgressTracker', 'Logger', plotFrame ] )
.directive( 'headerButtonGroup', [ headerGroupDirective ]);


//polyfill from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find
if (!Array.prototype.find) {
    Array.prototype.find = function(predicate) {
      'use strict';
      if (this == null) {
        throw new TypeError('Array.prototype.find called on null or undefined');
      }
      if (typeof predicate !== 'function') {
        throw new TypeError('predicate must be a function');
      }
      var list = Object(this);
      var length = list.length >>> 0;
      var thisArg = arguments[1];
      var value;

      for (var i = 0; i < length; i++) {
        value = list[i];
        if (predicate.call(thisArg, value, i, list)) {
          return value;
        }
      }
      return undefined;
    };
}
