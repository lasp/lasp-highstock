/*
* This function "hacks" the default title renderer and adds it to the main legend group instead
* of creating its own group. This means that we can render the title and legend items in a single line
* instead of the default 2 lines. This code originates from highstock source code.
*/
(function (H) {
    // Hide the tooltip but allow the crosshair
    H.Tooltip.prototype.defaultFormatter = function () { return false; };
    // This function is provided by highstock to overwrite default behaviour
    H.wrap(H.Legend.prototype, 'renderTitle', function() {
        var legend = this;
        var options = legend.options;
        var padding = legend.padding;
        var titleOptions = options.title;
        var titleHeight = 0;
        var bBox;
        var chart = legend.chart;
        var widthOption = options.width;
        var initialItemX = legend.initialItemX;

        var text = legend.title && legend.title.text ? legend.title.text.textStr : titleOptions.text;

        if (text) {
            if (!legend.title) {
                legend.title = legend.chart.renderer.label(text, padding - 3, padding - 5, null, null, null, null, null, 'legend-title')
                    .attr({ zIndex: 1 })
                    .css(titleOptions.style)
                    .add(legend.group);
            }
            bBox = legend.title.getBBox();
            titleHeight = bBox.height;

            legend.offsetWidth = bBox.width;
            
            // advance the x value for the next legend item
            legend.itemX += bBox.width + 8;
        
            // if the item exceeds the width, start a new line
            if ( legend.itemX - initialItemX + bBox.width + 16 > (widthOption || (chart.chartWidth - 2 * padding - initialItemX - options.x))) {
                legend.itemX = initialItemX;
                legend.itemY += legend.lastLineHeight;
                legend.lastLineHeight = 0; // reset for next line
            }
            this.titleHeight = titleHeight;
            legend.lastLineHeight = titleHeight + padding;
        } else {
            this.titleHeight = 19.5;
        }
    });
    H.wrap(H.Legend.prototype, 'render', function(proceed) {
        if ( typeof this.chart === 'undefined' ) {
            // this.chart is undefined if there has been a data error
            return;
        }
        var legend = this;
        legend.isFirstItem = true;
        var chart = legend.chart;
        var yAxis = legend.chart.yAxis;
        var oldLegendHeight = legend.legendHeight;
        proceed.apply(legend);
        var newLegendHeight = legend.legendHeight;

        // the overall height of the legend may fluctuate. We want the plot's height to shrink
        // to make room for the legend when the legend is too tall, but we don't want the plot's
        // height to always grow to fill the available space when the legend takes up less space
        // (such as when the user mouses out of the chart). This could lead to a plot constantly
        // changing height, which is rather annoying.
        // We only want to give the plot a chance to grow in height when the chart's width is
        // resized larger than it was previously, because this may cause the legend to use 
        // fewer lines.

        // keep track of the maximum height that the legend achieves, and only reset this maximum
        // when the size of the plot grows.

        if ( chart.oldPlotWidth !== undefined && chart.plotWidth > chart.oldPlotWidth ) {
            legend.maxHeight = 0;
        }
        chart.oldPlotWidth = chart.plotWidth;

        // keep track of the maximum height that the legend achieves.
        var oldMaxHeight = legend.maxHeight === undefined ? 0 : legend.maxHeight;
        legend.maxHeight = Math.max( newLegendHeight, oldMaxHeight );

        // redraw the chart if the legend has gotten to a larger max height. This will shrink
        // the plot's height to make room for the legend.
        if ( oldLegendHeight && legend.maxHeight !== undefined && legend.maxHeight > oldMaxHeight ) {
            //for some reason we have to mark the y axis as dirty or it won't do anything
            //on a redraw
            yAxis[0].isDirty = true;
            chart.redraw();
        }

    });
    H.wrap(H.Legend.prototype, 'renderItem', function(proceed,item) {
        // modify how legend items are rendered to ensure that the timestamp will not
        // be rendered on top of the first legend item
        if ( item === undefined ) {
            return;
        } else {
            var legend = this;
            if ( legend.isFirstItem === undefined ) {
                legend.isFirstItem = true;
            }
            if ( legend.isFirstItem && item.legendItem !== undefined && item.legendItem !== null ) {
                var bbox = item.legendItem.getBBox();
                if ( legend.itemX + bbox.width + bbox.x > legend.chart.chartWidth - 2 * legend.padding ) {
                    // drop it down to the next row
                    legend.itemX = 0;
                    legend.itemY += legend.itemHeight;
                    legend.lastItemY = legend.itemY;
                    legend.lastLineHeight = 0;
                }
            }
            proceed.call( this, item );
        }
        legend.isFirstItem = false;
    });
}(Highcharts));