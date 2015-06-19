Ext.define('Rally.technicalservices.lahChart',{
    extend: 'Rally.ui.chart.Chart',
    alias: 'widget.progresschart',

    itemId: 'rally-chart',
    chartData: {},
    loadMask: false,
    chartColors : [],
    chartConfig: {
        colors : ["#E0E0E0","#00a9e0","#fad200","#8dc63f"],
        chart: {
            type: 'bubble'
        },
        title: {
            text: 'Progress by Project'
        },
        xAxis: {
                title: {
                    text: 'Median Feature TIP'
                }
        },
        yAxis: [
            {
                title: {
                    text: '# Portfolio Items'
                }
            }
        ],
        plotOptions: {
            bubble: {
                tooltip: {
                    headerFormat: '<b>{series.name}</b><br>',
                    //pointFormat: 'TIP:{point.x}, Portfolio Items:{point.y}, Users:{point.z}, % Active:{point.pct}'
                    pointFormat: 'TIP:{point.x}, Portfolio Items:{point.y}, Users:{point.z}<br>Feature Ratio:{point.featureRatio} Activity Ratio:{point.activityRatio}'
                }
            }
        }
    },
    constructor: function (config) {
        this.callParent(arguments);
        if (config.title){
            this.chartConfig.title = config.title;
        }
    }
});