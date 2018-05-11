'use strict';

/**
 * @ngdoc service
 * @name eventTable
 *
 * @description
 * Directive used to show a table of date and string values
 */
function eventTable() {
    return {
        restrict: 'E',
        templateUrl: 'event_table/event_table.html',
        replace: true,
        scope: {
            eventTableScope: '=',
            frameScope: '='
        },
        link: function( scope, element ) {
            scope.eventTableScope = scope;
            scope.tableStyle = {};
            scope.tableData = [];
            
            var dataArray;
            
            scope.init = function() {
                
            };
            
            scope.setDataArray = function( d ) {
                dataArray = d;
            };
            
            scope.afterDatasetDownloaded = function( data ) {
                
            };
            
            scope.afterAllDatasetsDownloaded = function() {
                scope.onSetMenuOptions();
                scope.onSetUiOptions();
                recreateTable();
            };
            
            scope.applyVisibleTimeRange = function() {
                // maybe scroll the table to the start of the visible time range? Would the user find this odd?
            };
            
            scope.onSetMenuOptions = function( oldOptions ) {
                var recreate = false;
                
                if ( oldOptions && !angular.equals(scope.menuOptions.timeLabels, oldOptions.timeLabels) ) {
                    recreate = true;
                }
                
                if ( recreate ) {
                    recreateTable();
                }
            };
            
            scope.onSetUiOptions = function( oldOptions ) {
                if ( typeof oldOptions === 'undefined' || scope.uiOptions.plotHeight !== oldOptions.plotHeight ) {
                    scope.tableStyle.height = scope.uiOptions.plotHeight + 'px';
                }
            };
            
            function recreateTable() {
                // copy the data from dataArray and format the time
                scope.tableData = angular.copy( dataArray[0].data );
                
                /* For timeseries charts, the dates are formatted according to the value of menuOptions.timeLabels.format.
                 * Although the event table has no x-axis, it does have dates that need to be formatted, so we use the same
                 * menuOptions value to determine how to format the dates here
                 */
                if ( scope.menuOptions.timeLabels.format !== 'none' && scope.tableData.length > 0 ) {
                    var formatter = ( scope.menuOptions.timeLabels.format === 'secondsSinceT0' ) ? dateFormatterT0 : dateFormatterDefault;
                    var t0 = Number( scope.tableData[0][0] );
                    scope.tableData.forEach( function( entry, index ) {
                        scope.tableData[index][0] = formatter( Number(entry[0]), t0 );
                    });
                }
            }
            
            function dateFormatterDefault( msSinceEpoch ) {
                var tempDate = moment.utc( new Date( msSinceEpoch ) );
                var timezone = scope.menuOptions.timeLabels.timezone;
                var timeFormat = scope.menuOptions.timeLabels.momentTimeFormat;
                tempDate.tz( timezone );
                return tempDate.format( timeFormat + ' HH:mm:ss');
            }
            
            function dateFormatterT0( msSinceEpoch, t0 ) {
                return '+' + ( Math.round( (msSinceEpoch - t0) / 1000) ) + 's';
            }
        }
    };
}

angular.module( 'laspChart' ).directive( 'eventTable', [ eventTable ]);
