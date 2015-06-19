Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    launch: function() {

    	var me = this;

        Deft.Promise.all([me.readWorkspaces(),me.readWorkspacePermissions(),me.readUsers()],me).then({
            success: function(results) {
                console.log("results",results);
                var workspaces = _.first(results);
                var permissions = results[1];

                Deft.Promise.all([

                	me.setUserCounts(workspaces,permissions),
                	me.setFeatureCounts(workspaces),
                	me.setFeatureTIP(workspaces)

                ],me).then({

                	success : function(results) {
						console.log("workspaces",_.map(workspaces,function(w){return w.get("Name")+"-"+w.get("UserWorkspaceCount")+":"+w.get("ProjectsCount")}));
						me.createChart(me.prepareChartData(workspaces));
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
			return {
				name : ws.get("Name"),
				data : [{ x : ws.get("FeatureTIPValue"), 
						  y : ws.get("WorkspaceFeatureCount"), 
						  z : ws.get("UserWorkspaceCount")}]
			}
		});    	

    	console.log("seriesData",seriesData);
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

    setUserCounts : function(workspaces,permissions) {
    	console.log("Getting Users");
    	var deferred = Ext.create('Deft.Deferred');
        _.each(workspaces,function(ws,i){
	    	var perms = _.filter(permissions,function(perm){
	    		return (perm.Workspace._ref === ws.get("_ref")) &&
	    			(perm.Role === "User");
	    	});
	    	ws.set("UserWorkspaceCount",perms.length);
	    });
	    deferred.resolve([]);
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

	readWorkspacePermissions : function() {

		var me = this;
        
        var deferred = Ext.create('Deft.Deferred');

        Ext.define('lah-cache', {
		    fields: ['date', 'value'],
		    extend: 'Ext.data.Model',
		    proxy: {
		        type: 'localstorage',
		        id  : 'lah-workspace-permissions'
		    }
		});

		var store = Ext.create('Ext.data.Store', {
			autoLoad : false,
    		model: "lah-cache"
		});

		store.load(function(records, operation, success){

			console.log("Success:",success,"Records:",records.length,records);
			var now = moment();
			if (records.length>0) {
				var rec = _.first(records);
				if (moment.duration(now.diff( moment(rec.get("date")))).asHours() > 24) {
					store.remove(records);
					store.sync();
					records = [];
				} else {
					console.log("Resolving from cache");
					deferred.resolve(_.first(records).get("value"));
				}
			}
			if (records.length===0) {
		        me._loadAStoreWithAPromise(
	            'WorkspacePermission', 
	            ["Workspace","User","Name","Role"]
	            ).then({
		            scope: this,
		            success: function(permissions) {
		            	console.log("Permissions:",permissions.length);
		            	var data = _.map(permissions,function(p){return p.data;});
		            	store.add({date: new Date(),value: data});
		            	store.sync();
		                deferred.resolve(data);
		            }
	            }) 
	        } 
        });

        return deferred.promise;
    
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

    readUsers : function() {
    	var deferred = Ext.create('Deft.Deferred');
    	this._loadAStoreWithAPromise( "User", ["UserName","UserPermissions"])
    		.then( {
            	success: function(users) {
            		deferred.resolve(users);
            	},
            scope: this
        });
    	return deferred.promise;
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
    }

});
