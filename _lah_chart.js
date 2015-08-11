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
                    text: 'Median Story TIP'
                }
        },
        yAxis: [
            {
                title: {
                    text: '60 Day Activity'
                }
            }
        ],
        plotOptions: {
            bubble: {
                tooltip: {
                    headerFormat: '<b>{series.name}</b><br>',
                    //pointFormat: 'TIP:{point.x}, Portfolio Items:{point.y}, Users:{point.z}, % Active:{point.pct}'
                    pointFormat: 'PortfolioItems:{point.portfolioitems} Stories:{point.stories} Defects:{point.defects}' +
                    '<br>PortfolioItems (Users):{point.portfolioitemsUniqueUsers} Stories (Users):{point.storiesUniqueUsers} Defects (Users):{point.defectsUniqueUsers}' +
                    '<br>TIP:{point.x}, Portfolio Items:{point.y}, Users:{point.z}' +
                    '<br>Story Activity Ratio:{point.featureRatio} User Activity Ratio:{point.activityRatio} Snapshots:{point.snapshots}'
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