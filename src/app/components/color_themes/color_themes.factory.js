(function() { // IIFE

'use strict';

/**
 * @ngdoc service
 * @name ColorThemes
 *
 * @description
 * Definition of multiple color themes available to plots.
 */
function colorThemesFactory () {

    var ColorThemes = {};

    ColorThemes.themes = {
        light: {
            colors: ['#2885e0', '#383838', '#d7792a', '#4b32c9', '#4eb7a7', "#db0a5b", "#806c00", "#008000", "#f45b5b", "#b381b3"], // use a darker color scheme than the default
            backgroundColor: '#ffffff',
            selectionMarkerFill: 'rgba(69,114,167,0.25)',
            axis: {
                gridLineColor: 'rgba(0,0,0,0.15)',
                lineColor: '#c0d0e0',
                minorGridLineColor: '#e0e0e0',
                minorTickColor: '#a0a0a0',
                tickColor: '#c0d0e0',
                crosshairColor: '#c0c0c0',
                labelStyle: {color: '#555555'}
            },
            navigator: {
                outlineColor: '#b2b1b6',
                maskFill: 'rgba(128,179,236,0.2)',
                handles: {
                    backgroundColor: '#ebe7e8',
                    borderColor: '#b2b1b6'
                }
            },
            legend: {
                itemStyle: {color: '#333333'},
                titleStyle: {color: '#000000'}
            },
            events: {
                colors: {
                    // the 'regular' event series colors are mostly the same as the main series colors for the dark color theme,
                    // minus colors that are reserved for specific kinds of events.
                    // The colors below are defined in numeric RGB values. The CSS-friendly "rgba(r,g,b,a)" strings are built in a function,
                    // so that event series, plot lines, and plot bands can all easily share the same color value but have different opacities.
                    regular: [ [101,225,206], [200,190,60], [245,93,129], [207,118,245], [240,113,62], [116,183,250] ],
                    shadow: [153,153,153],
                    contact: [118,213,99]
                },
                plotLineOpacity: 0.5,
                plotBandOpacity: 0.3
            },
            limits: {
                bands: {
                    warn: 'rgba(223, 223, 0, 0.2)',
                    bad: 'rgba(255, 0, 0, 0.08)'
                },
                zones: {
                    good: '#33ae1a',
                    warn: '#c6ba02',
                    bad: '#c70202'
                }
            }
        },
        dark: {
            colors: ['#74b7fa', '#c1c1c1', '#f08e3e', '#ac9ef4', '#65e1ce', "#f15c80", "#9f6b3f", "#6b8e23", "#f45b5b", "#e4d354"],
            backgroundColor: '#000000',
            selectionMarkerFill: 'rgba(88,133,186,0.25)',
            axis: {
                gridLineColor: 'rgba(255,255,255,0.2)',
                lineColor: '#4f5f6f',
                minorGridLineColor: '#1f1f1f',
                minorTickColor: '#5f5f5f',
                tickColor: '#1f2f3f',
                crosshairColor: '#5f5f5f',
                labelStyle: {color: '#d0d0d0'}
            },
            navigator: {
                outlineColor: '#4a494e',
                maskFill: 'rgba(128,179,236,0.3)',
                handles: {
                    backgroundColor: '#b2b1b6',
                    borderColor: '#4a494e'
                }
            },
            legend: {
                itemStyle: { color: '#cccccc' },
                titleStyle: { color: '#ffffff' }
            },
            events: {
                colors: {
                    // See the notes on the events colors for the light color theme.
                    regular: [ [78,183,167], [185,175,15], [199,53,88], [144,81,209], [215,121,42], [40,133,224] ],
                    shadow: [156,156,156],
                    contact: [51,174,26]
                },
                plotLineOpacity: 0.55,
                plotBandOpacity: 0.3
            },
            limits: {
                bands: {
                    warn: 'rgba(255, 255, 0, 0.2)',
                    bad: 'rgba(255, 0, 0, 0.25)'
                },
                zones: {
                    good: '#46d754',
                    warn: '#f0e546',
                    bad: '#e42929'
                }
            }
        }
    };

    // takes a color theme object and returns the opposite theme.
    ColorThemes.getOppositeTheme = function( theme ) {
        return angular.equals( theme, ColorThemes.themes.light ) ? ColorThemes.themes.dark : ColorThemes.themes.light;
    };

    ColorThemes.getColorForEventType = function( eventType, allEventTypes, colorTheme ) {
        // there are some special colors to use for certain event types. Otherwise, just get a color from the default event color list.
        // Return colors for series, plot line, and plot band
        if ( eventType.label.toLowerCase().indexOf('shadow') !== -1 ) {
            var rgbColor = colorTheme.events.colors.shadow;
        } else if ( eventType.label.toLowerCase().indexOf('contact') !== -1 ) {
            rgbColor = colorTheme.events.colors.contact;
        } else {
            // get the index of the event type in the master list of event types
            var index = allEventTypes.findIndex( function(type) {
                return type.id === eventType.id;
            });
            // get the color corresponding to the index of the event type
            var eventColors = colorTheme.events.colors.regular;
            rgbColor = eventColors[ index % eventColors.length ];
        }
        var rgbColorString = rgbColor.join(',');
        return {
            series: 'rgb(' + rgbColorString + ')',
            line: 'rgba(' + rgbColorString + ', ' + colorTheme.events.plotLineOpacity + ')',
            band: 'rgba(' + rgbColorString + ', ' + colorTheme.events.plotBandOpacity + ')'
        };
    };

    return ColorThemes;
}

angular.module( 'laspChart' ).factory( 'ColorThemes', [ colorThemesFactory ]);

})(); // End IIFE
