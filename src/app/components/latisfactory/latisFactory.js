'use strict';

function latisFactory( $http, $q, $document, $window ) {
    /**
     * @ngdoc service
     * @name latis
     * @requires $http
     * @requires $q
     *
     * @description
     * Factory that sends out HTTP GET requests to LaTiS and returns a promise object.
     * Upon being resolved, this promise object becomes the results of the
     * HTTP GET.
     */
    var latis = {};

    var latisBase = 'latis/'; // the URL base for most latis operations
    var latisJoinBase = 'join/'; // the URL base for full outer join operations (for downloading a csv of multiple datasets)

    // Copied from here: http://stackoverflow.com/questions/470832/getting-an-absolute-url-from-a-relative-one-ie6-issue#answer-472729
    function escapeHTML(s) {
        // Comment from Ransom:
        // > Very clever, but it took me a few moments to realize you were using split/join
        // > as a global string replace. Note that using replace() with a global flag is
        // > much faster than split/join (at least in Chrome), so consider replace() if
        // > this function is ever churning through large amounts of strings
        //
        return s.split('&').join('&amp;').split('<').join('&lt;').split('"').join('&quot;');
    }

    /**
     * @ngdoc method
     * @name get
     * @methodOf latis
     * @description
     * Runs an HTTP GET against a given URL
     *
     * @param {string} URL URL to run the HTTP GET against
     * @param {function} cancel Callback function to execute when the request is cancelled or times out
     * @param {function} progressHandler Callback function to execute on the XHR progress event
     * @returns {Http Promise} HTTP promise that will resolve to the results of
     * the HTTP GET.
     *
     * @example
     * ```
     * latis.get( 'http://www.google.com' );
     * ```
     * would return a promise that (sometime in the future) resolves to:
     * ```
     * {
     *     'status': 200,
     *     'data': '<!doctype html><html itemscope=...',
     *     'config': ...
     * }
     * ```
     * (assuming google.com is up...)
     */
    latis.get = function( URL, cancel, progressHandler ) {
        /* The timeout property of the http request takes a deferred value
         * that will abort the underlying AJAX request if/when the deferred
         * value is resolved.
         */
        var deferred = $q.defer();
        cancel = cancel || $q.defer();
        progressHandler = progressHandler || angular.noop;

        // Initiate the AJAX request.
        var request = $http({
            cache: true,
            method: 'get',
            url: latisBase + URL,
            timeout: cancel.promise,
            eventHandlers: {
                progress: progressHandler
            }
        });

        /* Now that we have the promise that we're going to return to the
         * calling context, we'll augment it with the abort method. Since
         * the $http service uses a deferred value for the timeout,
         * all we have to do here is resolve the value and AngularJS will
         * abort the underlying AJAX request.
         */
        deferred.promise.abort = function() {
            deferred.resolve({});
            return deferred.promise;
        };

        /* Rather than returning the http-promise object, we want to pipe it
         * through another promise so that we can "unwrap" the response
         * without letting the http-transport mechanism leak out of the
         * service layer.
         */
        request.then(
            function( response ) {
                deferred.resolve({
                    'status': response.status,
                    'data': response.data,
                    'config': response.config
                });
                return( response.data );
            },
            function( response ) {
                /* Called asynchronously if an error occurs
                 * or server returns response with an error status.
                 */
                deferred.reject({
                    'status': response.status,
                    'data': response.data,
                    'config': response.config
                });
            }
        );

        return deferred.promise;
    };

    // Modified from polyfill here:
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith
    function endsWith( str, suffix ) {
        var pos = str.length - suffix.length;
        var lastIndex = str.indexOf(suffix, pos);
        return lastIndex !== -1 && lastIndex === pos;
    }

    latis.setBase = function( newBase ) {
        latisBase = newBase;
        if ( !endsWith( latisBase, '/' ) ) {
            latisBase += '/';
        }
    };

    latis.setJoinBase = function( newJoinBase ) {
        latisJoinBase = newJoinBase;
        if ( !endsWith( latisJoinBase, '/') ) {
            latisJoinBase += '/';
        }
    };

    latis.getBase = function() {
        return latisBase;
    };

    latis.getJoinBase = function() {
        return latisJoinBase;
    };

    latis.getFullyQualifiedLatisBase = function() {
        if ( latisBase.indexOf('://') === -1 ) {
            // the full URL will the the app's URL root plus the latisBase
            // construct an <a> element with a relative link, and let it resolve the relative URL to a full one
            var a = document.createElement('a');
            a.href = latisBase;
            return a.href;
        } else {
            // latisBase is already a fully qualified URL
            return latisBase;
        }
    };

    // Modified from here: http://stackoverflow.com/questions/470832/getting-an-absolute-url-from-a-relative-one-ie6-issue#answer-472729
    latis.qualifyURL = function( url ) {
        var el = document.createElement('div');
        el.innerHTML = '<a href="' + escapeHTML( latisBase + url ) + '"></a>';
        return el.firstChild.href;
    };

    latis.getDatasetDownload = function( identifier, parameters, startTime, endTime ) {
        var url = latisBase + identifier + '.' + parameters;
        if ( typeof startTime !== 'undefined' && typeof endTime !== 'undefined') {
            $window.open( url + '&time>=' + startTime + '&time<=' + endTime );
        } else {
            $window.open( url );
        }
    };

    latis.timeFormatters = {
        /**
         * @ngdoc method
         * @name timeFormatters.secondsSinceT0
         * @methodOf latis
         * @description
         * Creats a query parameter to be used when downloading CSV data, instructing latis to format the date as seconds since a certain time.
         *
         * @param {date} dateT0 The start date. Timestamp labels will be formatted as seconds since this date.
         */
        secondsSinceT0: function( dateT0 ) {
            return '&convert(time,seconds since ' + dateT0.toISOString() + ')';
        },
        /**
         * @ngdoc method
         * @name timeFormatters.simple
         * @methodOf latis
         * @description
         * Creats a query parameter to be used when downloading CSV data, instructing latis to format the date as either an ISO-like string or a DOY string.
         *
         * @param {string} timeFormat A short string representing how to format the date. Accepted values are 'YYYY-DDDD' and 'YYYY-MM-DD'.
         */
        simple: function( timeFormat ) {
            var formatString;
            switch ( timeFormat ) {
            case 'YYYY-DDDD':
                formatString = 'yyyy-DDD\'T\'HH:mm:ss.SSS';
                break;
            case 'YYYY-MM-DD':
                formatString = 'yyyy-MM-dd\'T\'HH:mm:ss.SSS';
                break;
            default:
                console.error( 'Programmer error: timeFormat not recognized: ' + timeFormat );
                formatString = '';
            }

            return '&format_time(' + formatString + ')';
        }
    };


    function convertToFullResURL(datasetURL){
        // Helper function for downloadCSV
        // All "Auto" downloads should contain full resolution data (WEBTCAD-1174)
        // Script should also preserve text all after TelemetryItem (WEBTCAD-1177)

        if (( datasetURL.indexOf("Auto") != -1 ) && ( datasetURL.indexOf("Analog") != -1 )){
            datasetURL = datasetURL.replace( /.+?(?=TelemetryItem)/, "Analog");
        }
        else if (( datasetURL.indexOf("Auto") != -1 ) && (datasetURL.indexOf("Discrete") != -1 )){
            datasetURL = datasetURL.replace( /.+?(?=TelemetryItem)/, "Discrete");
        }

        return datasetURL;
    };

    /**
     * @ngdoc method
     * @name downloadCSV
     * @methodOf latis
     * @description
     * Downloads CSVs for one or more datasets
     *
     * @param {array} datasetURLs An array of access URLs for datasets
     * @param {string} timeFormatQueryParam A query parameter to be appended to the download URL. This string must be generated using one of the latis.timeFormatters functions.
     */
    latis.downloadCSV = function( datasetURLs, timeFormatQueryParam ) {
        timeFormatQueryParam = timeFormatQueryParam || '';
        if ( datasetURLs.length === 1 ) {
            datasetURLs[0] = convertToFullResURL(datasetURLs[0]);
            // if there's only one CSV to download, open a new window and make a GET request to latis
            $window.open( latisBase + datasetURLs[0].replace('.jsond', '.csv') + timeFormatQueryParam );
        } else {
            // latis can merge multiple datasets together into one csv
            // in order to do this, we need to POST to it a list of the datasets to get
            //
            // Normally, a file download can only be triggered by setting the URL of a browser window
            // This would potentially send a very long GET request to the server--our list of datasets and parameters to download could potentially be rather long
            // GET request lengths max out at much lower request lengths than POST requests do. So we want to trigger a file download via POST request.
            // The only way to do this is to submit a form (POST method) with the download query information contained in the form

            // we need to convert our list of relative URLs into fully qualified URLs. The latis join service needs full URLs.
            // find the full URL if latisBase isn't one
            var fullURLBase = latis.getFullyQualifiedLatisBase();

            for ( var i = 0; i < datasetURLs.length; i++ ) {
                datasetURLs[i] = convertToFullResURL(datasetURLs[i]);
                // construct the URLs, replacing 'jsond' with 'json', and appending the time format.
                // The format should always be ISO-8601 (WEBTCAD-1110)
                datasetURLs[i] = fullURLBase + datasetURLs[i].replace( '.jsond', '.json' ) + "&format_time(yyyy-MM-dd'T'HH:mm:ss.SSS)";
            }

            // rather than appending the time formatting string to each dataset URL, we need to append it to the service URL, as a GET parameter
            var form = angular.element( '<form>' ).attr({
                method: 'post',
                target: '_blank',
                action: latisJoinBase + '?' + timeFormatQueryParam
            });
            form.append(
              angular.element( '<input>' ).attr({
                type: 'hidden',
                name: 'urls',
                value: datasetURLs.join(';') // the latis join service requires that urls are semicolon-delimited
              })
            );
            $document.find( 'body' ).append( form ); // not sure if the form even needs to be added to the DOM
            form[0].submit();
            form.remove();
        }
    };


    // Return the public API.
    return latis;
}

angular.module( 'latis', [] ).factory( 'latis', ['$http', '$q', '$document', '$window', latisFactory]);
