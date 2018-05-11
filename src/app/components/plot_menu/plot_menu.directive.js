'use strict';

function plotMenuDirective( $window ) {
    return {
        restrict: 'A',
        scope: {
            open: '=',
            menuBtn: '='
        },
        link: function( scope, element, attr ) {
            var el = element[0]; // convenience variable to access the HTMLElement instead of the jqLite object
            
            // get the default offset values for the element.
            var defaultTop = el.offsetTop;
            var defaultLeft = el.offsetLeft;

            
            // find the nearest scrolling ancestor
            function findNearestScrollingAncestor() {
                var scrollElement = element.parent();
                while ( scrollElement[0] !== document.body && scrollElement !== null && typeof scrollElement !== 'undefined' ) {
                    // find out if it scrolls by setting scrollTop to a number greater than 0 and getting the value again
                    // once Element.scrollTopMax or something like it has been standardized, we can use that instead.
                    var originalScrollTop = scrollElement[0].scrollTop;
                    scrollElement[0].scrollTop = 1; 
                    if ( scrollElement[0].scrollTop > 0 ) {
                        // reset the scroll value and break since we've found our scrolling container
                        scrollElement[0].scrollTop = originalScrollTop;
                        break;
                    }
                    scrollElement = scrollElement.parent();
                }
                return scrollElement;
            }
            

            element.on( 'click', function( event ) {
                event.clickedPlotMenu = true; // used for not closing the menu when the menu is clicked on
            });
            
            element.find( 'li' ).on( 'mouseenter', function( event ) {
                var childUl = angular.element(this).find('ul')[0];
                
                if ( typeof childUl !== 'undefined' ) {
                    var scrollElement = findNearestScrollingAncestor();
                    var scrollElementBoundingRect = scrollElement[0].getBoundingClientRect();
                    // reset styles which are possible altered
                    childUl.style.top = '0';
                    childUl.style.height = 'auto';
                    childUl.style.overflowY = '';
                    var $childUl = angular.element( childUl );
                    $childUl.removeClass( 'open-left' );
                    
                    var boundingRect = childUl.getBoundingClientRect();

                    if ( boundingRect.height > $window.innerHeight && $childUl.hasClass( 'scrolling-menu' ) ) {
                        // set the height of the element to equal the height of the nearest scrolling ancestor, and add a scroll bar to the ul
                        childUl.style.height = scrollElement[0].offsetHeight + 'px';
                        childUl.style.overflowY = 'scroll';
                        // re-get the bounding rect since we've changed the height
                        boundingRect = childUl.getBoundingClientRect();
                    }

                    var bottomDiff = scrollElementBoundingRect.bottom - boundingRect.bottom + window.pageYOffset;
                    // adjust the height of the element so it doens't disappear below the bottom of the nearest scrolling ancestor
                    if ( bottomDiff < 0 ) {
                        childUl.style.top = bottomDiff + 'px';
                    }
                    // if the element hangs off the right side of the screen, move it to the left
                    if ( $window.innerWidth < boundingRect.right ) {
                        $childUl.addClass( 'open-left' );
                    }
                }
            });
            
            scope.$watch( 'open', function( newVal, oldVal ) {
                el.style.display = ( newVal ) ? 'block' : 'none';
                
                if ( newVal ) {
                    // the menu has just been opened
                    var scrollElement = findNearestScrollingAncestor();
                    var scrollElementBoundingRect = scrollElement[0].getBoundingClientRect();
                    var boundingRect = el.getBoundingClientRect();
                    var bottomDiff = scrollElementBoundingRect.bottom - boundingRect.bottom + window.pageYOffset;
                    
                    // when the menu is opened, make sure the bottom of the menu doesn't fall off the bottom of the browser window
                    // don't bother adjusting the position of the menu if the menu is taller than the containing element
                    if ( bottomDiff < 0 && boundingRect.height <= scrollElementBoundingRect.height ) {
                        // if the menu button is defined, find the width so we can move the menu to the right of the button
                        // this assumes that the menu normally opens directly below the button, and that the left side of the button and menu are aligned
                        if ( typeof scope.menuBtn !== 'undefined' ) {
                            el.style.left = scope.menuBtn.offsetWidth + scope.menuBtn.offsetLeft + defaultLeft + 'px';
                        }
                        // move the menu up so the bottom of the menu is aligned with the bottom of the screen
                        el.style.top = bottomDiff + defaultTop + 'px';
                    }
                } else {
                    // reset the position of the menu to the default values
                    el.style.top = defaultTop + 'px';
                    el.style.left = defaultLeft + 'px';
                }
            });
        }
    };
}

angular.module( 'laspChart' ).directive( 'plotMenu', ['$window', plotMenuDirective] );