'use strict';

angular.module( 'constants', [] )
  .service('constants', [function() {
  return {
      // Plot options:
      DEFAULT_PLOT_HEIGHT: 400,
      DEFAULT_LINE_COLOR: '#FF0000',
      DEFAULT_LINE_WIDTH: 1.2,
      DEFAULT_COLOR_THEME: 'light',

      NAVIGATOR_HEIGHT: 40,
      NAVIGATOR_MARGIN: 25,
      /* by default, the y axis label will look something like:
       *   Irradiance (W/m^2)
       * If the following value is true, the label will look like:
       *   W/m^2
       */
      Y_AXIS_LABEL_SHOW_UNITS_ONLY: false,
      // Zoom ratios for setting how far the zoom in/out buttons zoom
      ZOOM_OUT_RATIO: 3/2,
      ZOOM_IN_RATIO: 2/3,
      // Ratios for setting how far the pan left/right buttons pan
      PAN_LEFT_RATIO: -2/3,
      PAN_RIGHT_RATIO: 2/3,
      
      MINIMUM_RANGE: 30 * 1000, // 30 seconds

      VIOLATION_ZINDEX: 3, // a value of 3 keeps the violations under the selection area in the navigator
      LIMIT_VIOLATION_LINE_WIDTH: 3,
      MILLISECONDS_PER_MINUTE: 60 * 1000,
      // In search modal, minimum number of characters at which to apply filters
      MIN_SEARCH_CHARACTERS: 3,

      // data grouping can speed up the UI when large amounts of data are loaded
      // this value can be changed for individual plots by setting menuOptions.dataDisplay.dataGrouping
      DEFAULT_DATA_GROUPING: true,

      EXPORTING: true
  };
}]);
