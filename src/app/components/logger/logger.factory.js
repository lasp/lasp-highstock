(function() { // IIFE

'use strict';

/**
 * @ngdoc service
 * @name loggerFactory
 *
 * @description
 * A tool used to control console log/debug statements made by lasp-highstock
 */
function loggerFactory () {

    var Logger = {
        // takes an undefined number of arguments and passes them to console.debug
        log: function() {
            // call console.debug with the passed args, as well as with a specific string
            // so we can filter the console statements to show only lasp-highstock debug output
            var args = Array.prototype.slice.call( arguments );
            console.debug.apply( console, ['%c[lasp-highstock]', 'background:#cfebed'].concat(args) );
        }
    };

    return Logger;
}

angular.module( 'laspChart' ).factory( 'Logger', [ loggerFactory ]);

})(); // End IIFE