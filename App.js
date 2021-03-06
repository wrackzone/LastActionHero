Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    requests : 0,

    config: {
        defaultSettings: {
            yAxisType : "Story",
            useUniqueUserCount : true

        }
    },

    launch: function() {

    	var me = this;

    	me.setLoading(true);

        Deft.Promise.all([me.readWorkspaces()],me).then({

            success: function(results) {

            	me.setLoading(false);
                // console.log("results",results);
                var workspaces = _.first(results);

                Deft.Promise.all([

                	me.setUserCounts(workspaces),
                	me.setFeatureCounts(workspaces),
                	me.setFeatureTIP(workspaces),
                	me.setUserActivity(workspaces),
                    me.setWorkspacePortfolioItemCounts(workspaces),
                    me.setWorkspaceStoryCounts(workspaces),
                    me.setWorkspaceDefectCounts(workspaces)

                ],me).then({

                	success : function(results) {
                        me.hideMask();
						// console.log("workspaces",_.map(workspaces,function(w){return w.get("Name")+"-"+w.get("UserWorkspaceCount")+":"+w.get("ProjectsCount")}));
						me.createChart(me.prepareChartData(workspaces));
                	},
                	failure : function(error) {
                        me.hideMask();
                		console.log("failure in launch---",error);
                	}

                });

            }
        });
    },

    createChart : function(series) {

        console.log("createChart",series);

    	var me = this;
        // me.setLoading(false);

        if (!_.isUndefined(me.chart)) {
            me.remove(me.chart);
        }

        me.chart = Ext.create('Rally.technicalservices.lahChart', {
            itemId: 'rally-chart',
            chartData: { series : series },
            title: 'Workspace Visualization'
        });

        console.log(me.chart);

        me.add(me.chart);

    },

    prepareChartData : function(workspaces) {

        var me = this;

		var seriesData = _.map(workspaces,function(ws){

			var snapshots = ws.get("WorkspaceUserActivity");
			var features = ws.get("WorkspaceFeatureCount");
			var totalUsers = ws.get("UserWorkspaceCount");

			var featureRatio = features > 0 ? Math.round((snapshots / features ) * 100) / 100 : 0 ;
			var activityRatio = totalUsers > 0 ? Math.round((snapshots / totalUsers ) * 100) / 100 : 0 ;

			featureRatio = _.isNaN(featureRatio) ? 0 : featureRatio;
			activityRatio = _.isNaN(activityRatio) ? 0 : activityRatio;

            var yAxisField = me.getSetting("yAxisType");
            var useUniqueUserCount = me.getSetting("useUniqueUserCount") === true || me.getSetting("useUniqueUserCount") === 'true'

            if (useUniqueUserCount===true) {
                yAxisField = (yAxisField==="Story" ? "HierarchicalRequirement" : yAxisField) + "UniqueUserCount";
            } else {
                yAxisField = (yAxisField==="Story" ? "HierarchicalRequirement" : yAxisField) + "Count";
            }

            // console.log("yAxisField",yAxisField,ws);

			return {
				name : ws.get("Name"),
				// color : seriesColor,
				data : [{ x : ws.get("FeatureTIPValue"), 
						  // y : ws.get("WorkspaceFeatureCount"), 
						  // y : activityRatio,
                          y : ws.get(yAxisField),
						  z : ws.get("UserWorkspaceCount"),
						  featureRatio : featureRatio,
						  activityRatio : activityRatio,
						  snapshots : snapshots,
                          portfolioitems : ws.get("PortfolioItemCount"),
                          defects : ws.get("DefectCount"),
                          stories : ws.get("HierarchicalRequirementCount"),
                          portfolioitemsUniqueUsers : ws.get("PortfolioItemUniqueUserCount"),
                          defectsUniqueUsers : ws.get("DefectUniqueUserCount"),
                          storiesUniqueUsers : ws.get("HierarchicalRequirementUniqueUserCount"),

						}]
						  // pct : pct}]
			}
		});    	
    	return seriesData;
    },

    setFeatureCounts : function(workspaces) {
    	// console.log("Getting Features");
    	var me = this;
    	var deferred = Ext.create('Deft.Deferred');
    	me.readPortfolioItems(workspaces).then({
			success : function(values) {
				// console.log("values",values);
				_.each(workspaces,function(workspace,i){
					// console.log(workspace.get("Name"),values[i].length);
					workspace.set("WorkspaceFeatureCount",values[i].length);
				})
				deferred.resolve([]);
			},
			failure : function(error) { 
				console.log("Error:",error);
			}
		});
		return deferred.promise;
    },

    setFeatureTIP : function(workspaces) {
    	// console.log("Getting Feature TIP");

    	var me = this;
    	var deferred = Ext.create('Deft.Deferred');

    	var getLastTIPFromValue = function(value) {
    		var scope = _.first(value.scopes);
    		if (scope.dataPoints.length===0) // no metric
    			return 0;
    		var datapoint = _.last(scope.dataPoints);
    		var metricValueKey = _.first(_.keys(datapoint.data));
    		var metricValue = datapoint.data[metricValueKey].value;

            metricValue = Math.round(metricValue * 100) / 100;


    		return metricValue;
    	};

    	me.readFeatureMetrics(workspaces).then({
    		success : function(values) {
    			//console.log("Workspace Insights API:",values);
    			_.each(workspaces,function(workspace,i){
    				workspace.set("FeatureTIPValue", getLastTIPFromValue(values[i]));
    			})
    			deferred.resolve([]);
    		}
    	});
    	return deferred.promise;

    },

    setUserActivity : function(workspaces) {
    	var me = this;
    	var deferred = Ext.create('Deft.Deferred');
    	me.readWorkspaceSnapshots(workspaces).then({
    		success : function(values) {
    			// console.log("Workspace Snapshots:",values);
    			_.each(workspaces,function(workspace,i){
    				// console.log("snapshot:",workspace.get("Name"),values[i]);
    				workspace.set("WorkspaceUserActivity", !_.isUndefined(values[i]) ? values[i].length : undefined);
    			})
    			deferred.resolve([]);
    		}
    	});
    	return deferred.promise;
    },

    uniqSnapshotsUserCount : function(snapshots) {
        var uniqueUsers = _.uniq(snapshots,function(value){return value.get("_User")});
        return uniqueUsers.length;
    },

    setWorkspacePortfolioItemCounts : function(workspaces) {

        var me = this;
        var type = "PortfolioItem";
        var deferred = Ext.create('Deft.Deferred');
        me.readWorkspaceTypeSnapshots(workspaces,type).then({
            success : function(values) {
                _.each(workspaces,function(workspace,i){
                    workspace.set(type+"Count", !_.isUndefined(values[i]) ? values[i].length : undefined);
                    workspace.set(type+"UniqueUserCount", 
                        !_.isUndefined(values[i]) ? me.uniqSnapshotsUserCount(values[i]) : undefined);
                })
                deferred.resolve([]);
            }
        });
        return deferred.promise;
    },

    setWorkspaceStoryCounts : function(workspaces) {

        var me = this;
        var type = "HierarchicalRequirement";
        var deferred = Ext.create('Deft.Deferred');
        me.readWorkspaceTypeSnapshots(workspaces,type).then({
            success : function(values) {
                console.log("[" + type + "] Workspace Snapshots:",values);
                _.each(workspaces,function(workspace,i){
                    workspace.set(type+"Count", !_.isUndefined(values[i]) ? values[i].length : undefined);
                    workspace.set(type+"UniqueUserCount", 
                        !_.isUndefined(values[i]) ? me.uniqSnapshotsUserCount(values[i]) : undefined);

                })
                deferred.resolve([]);
            }
        });
        return deferred.promise;
    },

    setWorkspaceDefectCounts : function(workspaces) {

        var me = this;
        var type = "Defect";
        var deferred = Ext.create('Deft.Deferred');
        me.readWorkspaceTypeSnapshots(workspaces,type).then({
            success : function(values) {
                _.each(workspaces,function(workspace,i){
                    workspace.set(type+"Count", !_.isUndefined(values[i]) ? values[i].length : undefined);
                    workspace.set(type+"UniqueUserCount", 
                        !_.isUndefined(values[i]) ? me.uniqSnapshotsUserCount(values[i]) : undefined);

                })
                deferred.resolve([]);
            }
        });
        return deferred.promise;
    },


    readWorkspaceTypeSnapshots : function(workspaces,type) {

        var createTypeFind = function(type) {
            var find = {
                "_ValidFrom" : { "$gt" : moment().subtract(60,"days").toISOString() }, // "2015-06-01T00:00:00.000Z"} // moment().subtract(30,"days").toISOString()
                "_TypeHierarchy" : { "$in" : [type] }
            }
            return find;
        }

        var me = this;
        var promises = _.map(workspaces, function(workspace)  {
            var deferred = Ext.create('Deft.Deferred');
            // find,fetch,hydrate,ctx
            // loadASnapShotStoreWithAPromise: function(find, fetch, hydrate, ctx) {
            me.loadASnapShotStoreWithAPromise(
                    createTypeFind(type), 
                    ["_TypeHierarchy","ObjectID","_User"], 
                    ["_TypeHierarchy"],
                    {
                        workspace : workspace.get("_ref"),
                        project : null,
                    }
                ).then({
                    scope: me,
                    success: function(values) {
                        deferred.resolve(values);
                    },
                    failure: function(error) {
                        console.log("error",error);
                        deferred.resolve([]);
                    }
                });
            return deferred.promise;
        });
        return Deft.Promise.all(promises);

    },

    readWorkspaceSnapshots : function(workspaces) {

    	var createSnapshotFind = function(workspace) {
            var find = {
            	"_ValidFrom" : { "$gt" : moment().subtract(30,"days").toISOString() } // "2015-06-01T00:00:00.000Z"} // moment().subtract(30,"days").toISOString()
            }
        	return find;
        };

		var me = this;
        var promises = _.map(workspaces,function(workspace) {
            var deferred = Ext.create('Deft.Deferred');
            // find,fetch,hydrate,ctx
            // loadASnapShotStoreWithAPromise: function(find, fetch, hydrate, ctx) {
            me.loadASnapShotStoreWithAPromise(
                    createSnapshotFind(workspace), 
                    ["_User"], 
                    [],
                    {
                    	workspace : workspace.get("_ref"),
                    	project : null,
                    }
                ).then({
                    scope: me,
                    success: function(values) {
                        deferred.resolve(values);
                    },
                    failure: function(error) {
                    	console.log("error",error);
                        deferred.resolve([]);
                    }
                });
            return deferred.promise;
        });
        return Deft.Promise.all(promises);
	},

    setProjectCounts : function(workspaces) {

    	var me = this;
    	var deferred = Ext.create('Deft.Deferred');
    	me.readProjects(workspaces).then({
    		success : function(values) {
    			console.log("project values",values);
    			_.each(workspaces,function(workspace,i){
    				workspace.set("WorkspaceProjects",values[i]);
    				workspace.set("ProjectsCount",values[i].length);
    			})
    			deferred.resolve([]);
    		}
    	});
    	return deferred.promise;

    },

    setUserCounts : function(workspaces) {

		// console.log("Getting Users");
    	var me = this;
    	var deferred = Ext.create('Deft.Deferred');
    	me.readUsers(workspaces).then({
    		success : function(values) {
    			_.each(workspaces,function(ws,i){
    				ws.set("UserWorkspaceCount",values[i].length);
    			});
    			deferred.resolve([]);
    		}
    	});
	    return deferred.promise;
    },

    readProjects : function(workspaces) {

    	var me = this;

        var promises = _.map(workspaces,function(workspace) {
            var deferred = Ext.create('Deft.Deferred');
            me._loadAStoreWithAPromise(
                    "Project", 
                    ["Name","State"], 
                    [],
                    {
                    	workspace : workspace.get("_ref"),
                    	project : null,
                    }
                ).then({
                    scope: me,
                    success: function(values) {
                        deferred.resolve(values);
                    },
                    failure: function(error) {
                        deferred.resolve([]);
                    }
                });
            return deferred.promise;
        });
        return Deft.Promise.all(promises);
    },

    readPortfolioItems : function(workspaces) {

    	var createFeatureFilter = function() {
            var filter = Ext.create('Rally.data.wsapi.Filter', {
                property: 'CreationDate',
                operator: '>',
                value: "2015-01-01T00:00:00.000Z"
            });
        	return filter;
        };

		var me = this;
        var promises = _.map(workspaces,function(workspace) {
            var deferred = Ext.create('Deft.Deferred');
            me._loadAStoreWithAPromise(
                    // "PortfolioItem", 
                    "HierarchicalRequirement",

                    ["FormattedID"], 
                    [createFeatureFilter()],
                    {
                    	workspace : workspace.get("_ref"),
                    	project : null,
                    }
                ).then({
                    scope: me,
                    success: function(values) {
                        deferred.resolve(values);
                    },
                    failure: function(error) {
                    	console.log("error",error);
                        deferred.resolve([]);
                    }
                });
            return deferred.promise;
        });
        return Deft.Promise.all(promises);
	},

	readFeatureMetrics : function(workspaces) {

        var me = this;

		var insightsAPI = function(workspace) {
			var deferred = Ext.create('Deft.Deferred');
			var metrics = [
				( me.getSetting("yAxisType") === "PortfolioItem" ? 
                    "TimeInProcessFeatureStart0P50" :
                    "TimeInProcessStoryAndDefectP50" )
            ];
			var workspace = workspace.get("ObjectID");
			var lastMonth = moment(); // moment().subtract(1,'months');
			var firstMonth = moment().subtract(6,'months');

			var baseUrl = "https://rally1.rallydev.com/insight/data";
			// var baseUrl = "/insight/data";
			var granularity = "month";

			var url = baseUrl + "?" + "granularity=" + granularity + "" + "&metrics=" + metrics.join() + 
						// "&projects=" + project + 
						"&workspaces=" + workspace + 
						"&start-date=" + firstMonth.format("YYYY-MM") + 
						"&end-date=" + lastMonth.format("YYYY-MM");

			Ext.Ajax.request({
		   		url: url,
		   		success: function(response, opts) {
			      var obj = Ext.decode(response.responseText);
			      deferred.resolve(obj);
			   	},
		   		failure: function(response, opts) {
		      		console.log('server-side failure with status code ' + response.status);
		   		}
			});
			return deferred.promise;
		};

		var me = this;
        var promises = _.map(workspaces,function(workspace) {
        	return insightsAPI(workspace);
        });
        return Deft.Promise.all(promises);
	},

    readWorkspaces : function() {
        var deferred = Ext.create('Deft.Deferred');
    	this._loadAStoreWithAPromise( "Subscription", ["Name","Workspaces"])
    		.then( {
            	success: function(subs) {
            		var sub = _.first(subs);
            		sub.getCollection('Workspaces').load({
                        fetch : ["ObjectID","Name","State"],
                        callback: function(records, operation, success) {
                        	console.log("workspaces",_.map(records,function(r){return r.get("Name")}));
                        	var recs = _.filter(records,function(r){return (r.get("State")!=="Closed") && 
                        		(r.get("Name").toLowerCase().indexOf("kfwang")==-1);});
                        	console.log("Workspace Count:",recs.length);
                        	deferred.resolve(recs);
                        }
                    });
            	},
            scope: this
        });
    	return deferred.promise;
    },

    readUsers : function(workspaces) {

    	var usersFilter = function() {
            var filter = Ext.create('Rally.data.wsapi.Filter', {
                property: 'WorkspacePermission',
                operator: '!=',
                value: 'No Access'
            });
            filter = filter.and(Ext.create('Rally.data.wsapi.Filter', {
                property: 'Disabled',
                operator: '=',
                value: false
            }));
        	return filter;
        };

    	var me = this;
        var promises = _.map(workspaces,function(workspace) {
            var deferred = Ext.create('Deft.Deferred');
            me._loadAStoreWithAPromise(
                    "User", 
                    ["UserName"], 
                    [usersFilter()],
                    {
                    	workspace : workspace.get("_ref"),
                    	project : null,
                    }
                ).then({
                    scope: me,
                    success: function(values) {
                        deferred.resolve(values);
                    },
                    failure: function(error) {
                        deferred.resolve([]);
                    }
                });
            return deferred.promise;
        });
        return Deft.Promise.all(promises);
    },

    _loadAStoreWithAPromise: function(model_name, model_fields, filters,ctx,order) {
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
          
        var config = {
            model: model_name,
            fetch: model_fields,
            filters: filters,
            limit: 'Infinity'
        };
        if (!_.isUndefined(ctx)&&!_.isNull(ctx)) {
            config.context = ctx;
        }
        if (!_.isUndefined(order)&&!_.isNull(order)) {
            config.order = order;
        }

        Ext.create('Rally.data.wsapi.Store', config ).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(records);
                } else {
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },

    loadASnapShotStoreWithAPromise: function(find, fetch, hydrate, ctx) {
        var me = this;
        var deferred = Ext.create('Deft.Deferred');
          
        var config = {
            find : find,
            fetch: fetch,
            hydrate : hydrate,
            pageSize : 1000,
            limit : 'Infinity'
        };

        if (!_.isUndefined(ctx)) { config.context = ctx;}

        var storeConfig = Ext.merge(config, {
        	removeUnauthorizedSnapshots : true,
            autoLoad : true,
            // limit: Infinity,
            listeners: {
               load: function(store, data, success) {
            		// console.log("snapshots success",store,success, ( !_.isNull(data) ? data.length : "null"),store.totalCount);
            		// var raw = _.map(data,function(d) { return d.data; })
                    me.requests = me.requests - 1;
                    me.showMask("Processing " + me.requests + " requests ...");
            		// deferred.resolve( store.totalCount );
                    deferred.resolve(data);
        		}
            },
        });
        // console.log("storeConfig",storeConfig);
        me.requests = me.requests + 1;
		Ext.create('Rally.data.lookback.SnapshotStore', storeConfig);
        return deferred.promise;
    },

    getSettingsFields: function() {
        var me = this;

        var yAxisStore = new Ext.data.ArrayStore({
            fields: ['type'],
            data : [['PortfolioItem'],['Story'],['Defect']]
        });  


        return [ 
            {
                name: 'yAxisType',
                xtype: 'combo',
                store : yAxisStore,
                valueField : 'type',
                displayField : 'type',
                queryMode : 'local',
                forceSelection : true,
                boxLabelAlign: 'after',
                fieldLabel: 'Y Axis Type',
                margin: '0 0 15 50',
                labelStyle : "width:200px;",
                afterLabelTpl: 'Select the Type to use for the Y Axis Value'
            },
            {
                name: 'useUniqueUserCount',
                xtype : 'rallycheckboxfield',
                label : 'Use number of transaction unique users for Y axis'
            }
        ];
    },
    showMask: function(msg) {
        if ( this.getEl() ) { 
            this.getEl().unmask();
            this.getEl().mask(msg);
        }
    },
    hideMask: function() {
        this.getEl().unmask();
    },




});
