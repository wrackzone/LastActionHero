Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    launch: function() {

    	var me = this;

    	me.setLoading(true);

        Deft.Promise.all([me.readWorkspaces()],me).then({

            success: function(results) {

            	me.setLoading(false);
                console.log("results",results);
                var workspaces = _.first(results);

                Deft.Promise.all([

                	me.setUserCounts(workspaces),
                	me.setFeatureCounts(workspaces),
                	me.setFeatureTIP(workspaces),
                	me.setUserActivity(workspaces)

                ],me).then({

                	success : function(results) {
						console.log("workspaces",_.map(workspaces,function(w){return w.get("Name")+"-"+w.get("UserWorkspaceCount")+":"+w.get("ProjectsCount")}));
						me.createChart(me.prepareChartData(workspaces));
                	},
                	failure : function(error) {
                		console.log("error---",error);
                	}

                });

            }
        });
    },

    createChart : function(series) {

    	var me = this;
        me.setLoading(false);

        if (!_.isUndefined(me.chart)) {
            me.remove(me.chart);
        }

        me.chart = Ext.create('Rally.technicalservices.lahChart', {
            itemId: 'rally-chart',
            chartData: { series : series },
            title: 'Workspace Visualization'
        });

        me.add(me.chart);

    },

    prepareChartData : function(workspaces) {

		var seriesData = _.map(workspaces,function(ws){

			// var activityUsers = _.uniq( _.map(ws.get("WorkspaceUserActivity"), function(snapshot) { return snapshot._User;}));
			// var totalUsers = ws.get("UserWorkspaceCount");
			
			// var pct = totalUsers > 0 ? (activityUsers.length / totalUsers ) * 100 : 0;
			
			// var seriesColor = null;
			// if (pct > 80) { seriesColor = "#107c1e" } else
			// 	if (pct > 60) { seriesColor = "#8dc63f"} else 
			// 		if (pct > 40) { seriesColor = "#fad200"} else
			// 			if (pct > 20) { seriesColor = "#ee6c19"} else
			// 				seriesColor = "#ec1c27";

			// console.log(ws.get("Name"),"ActiveUsers:",activityUsers.length,"TotalUsers",totalUsers,"Percent",pct,"color:",seriesColor);

			var snapshots = ws.get("WorkspaceUserActivity");
			var features = ws.get("WorkspaceFeatureCount");
			var totalUsers = ws.get("UserWorkspaceCount");

			var featureRatio = features > 0 ? Math.round((snapshots / features ) * 100) / 100 : 0 ;
			var activityRatio = totalUsers > 0 ? Math.round((snapshots / totalUsers ) * 100) / 100 : 0 ;

			featureRatio = _.isNaN(featureRatio) ? 0 : featureRatio;
			activityRatio = _.isNaN(activityRatio) ? 0 : activityRatio;

			return {
				name : ws.get("Name"),
				// color : seriesColor,
				data : [{ x : ws.get("FeatureTIPValue"), 
						  // y : ws.get("WorkspaceFeatureCount"), 
						  y : activityRatio,
						  z : ws.get("UserWorkspaceCount"),
						  featureRatio : featureRatio,
						  activityRatio : activityRatio,
						  snapshots : snapshots
						}]
						  // pct : pct}]
			}
		});    	

    	console.log("seriesData",seriesData);
    	console.log("seriesData",_.map(seriesData,function(sd){return _.first(sd.data).y}));
    	return seriesData;

    },

    setFeatureCounts : function(workspaces) {
    	console.log("Getting Features");
    	var me = this;
    	var deferred = Ext.create('Deft.Deferred');
    	me.readPortfolioItems(workspaces).then({
			success : function(values) {
				console.log("values",values);
				_.each(workspaces,function(workspace,i){
					console.log(workspace.get("Name"),values[i].length);
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
    	console.log("Getting Feature TIP");

    	var me = this;
    	var deferred = Ext.create('Deft.Deferred');

    	var getLastTIPFromValue = function(value) {
    		var scope = _.first(value.scopes);
    		if (scope.dataPoints.length===0) // no metric
    			return 0;
    		var datapoint = _.last(scope.dataPoints);
    		var metricValueKey = _.first(_.keys(datapoint.data));
    		var metricValue = datapoint.data[metricValueKey].value;
    		return metricValue;
    	};

    	me.readFeatureMetrics(workspaces).then({
    		success : function(values) {
    			console.log("Workspace Insights API:",values);
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
    			console.log("Workspace Snapshots:",values);
    			_.each(workspaces,function(workspace,i){
    				console.log("snapshot:",workspace.get("Name"),values[i]);
    				workspace.set("WorkspaceUserActivity", values[i]);
    			})
    			deferred.resolve([]);
    		}
    	});
    	return deferred.promise;
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

		console.log("Getting Users");
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
                    "PortfolioItem", 
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

		var insightsAPI = function(workspace) {
			var deferred = Ext.create('Deft.Deferred');
			var metrics = [
            	"TimeInProcessFeatureStart0P50"
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
            pageSize : 100
        };

        if (!_.isUndefined(ctx)) { config.context = ctx;}

        var storeConfig = Ext.merge(config, {
        	removeUnauthorizedSnapshots : true,
            autoLoad : true,
            // limit: Infinity,
            listeners: {
               load: function(store, data, success) {
            		console.log("snapshots success",store,success, ( !_.isNull(data) ? data.length : "null"),store.totalCount);
            		// var raw = _.map(data,function(d) { return d.data; })
            		deferred.resolve( store.totalCount );
        		}
            },
        });
        // console.log("storeConfig",storeConfig);
		Ext.create('Rally.data.lookback.SnapshotStore', storeConfig);
        return deferred.promise;
    }


});
