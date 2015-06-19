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
                me.setUserCounts(workspaces,permissions);
                // me.setProjectCounts(workspaces);
                me.setFeatureCounts(workspaces);
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
    			y : ws.get("WorkspaceFeatureCount"), x : 100, z : ws.get("UserWorkspaceCount")
    		}
    	});

    	var series = [{
    		data : seriesData
    	} ]

    	console.log("seriesData",series);
    	return series;

    },

    setFeatureCounts : function(workspaces) {
    	var me = this;
    	me.readPortfolioItems(workspaces).then({
			success : function(values) {
				console.log("values",values);
				_.each(workspaces,function(workspace,i){
					workspace.set("WorkspaceFeatureCount",values[i].length);
				})
				console.log("workspaces",_.map(workspaces,function(w){return w.get("Name")+"-"+w.get("UserWorkspaceCount")+":"+w.get("ProjectsCount")}));
				me.createChart(me.prepareChartData(workspaces));
			},
			failure : function(error) { 
				console.log("Error:",error);
			}
		});
    },

    setProjectCounts : function(workspaces) {

    	var me = this;

    	me.readProjects(workspaces).then({
    		success : function(values) {
    			console.log("project values",values);
    			_.each(workspaces,function(workspace,i){
    				workspace.set("WorkspaceProjects",values[i]);
    				workspace.set("ProjectsCount",values[i].length);
    			})
    		}
    	})

    },

    setUserCounts : function(workspaces,permissions) {
        _.each(workspaces,function(ws,i){
	    	var perms = _.filter(permissions,function(perm){
	    		return (perm.get("Workspace")._ref === ws.get("_ref")) &&
	    			(perm.get("Role") === "User");
	    	});
	    	ws.set("UserWorkspaceCount",perms.length);
	    });
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


	readWorkspacePermissions : function() {
        var deferred = Ext.create('Deft.Deferred');
        this._loadAStoreWithAPromise(
            'WorkspacePermission', 
            ["Workspace","User","Name","Role"]
            ).then({
            scope: this,
            success: function(permissions) {
            	console.log("permissions",permissions);
                deferred.resolve(permissions);
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

    readWorkspaceFeatures : function(workspaces) {

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
                'PortfolioItem', 
                ["ObjectID"], 
                [createFeatureFilter()],
                // [ { property:"Ordinal", operator:"=", value:0} ],
                {
                	project : null,
                	workspace : workspace.get("_ref")
                }
                ).then({
                scope: me,
                success: function(pis) {
                    deferred.resolve(pis);
                }
            });
            return deferred.promise;
        });
        return Deft.Promise.all(promises);
    },

    readFeatures : function(workspace) {

        var me = this;

        var createFeatureFilter = function() {
            var filter = Ext.create('Rally.data.wsapi.Filter', {
                property: 'CreationDate',
                operator: '>',
                value: "2015-01-01T00:00:00.000Z"
            });
        	return filter;
        };

        var readFeatureType = function() {
            var deferred = Ext.create('Deft.Deferred');
            me._loadAStoreWithAPromise(
                'TypeDefinition', 
                ["TypePath"], 
                [ { property:"Ordinal", operator:"=", value:0} ],
                {
                	project : null,
                	workspace : workspace.get("_ref")
                }
                ).then({
                scope: me,
                success: function(types) {
                    deferred.resolve(_.first(types).get("TypePath"));
                }
            });
            return deferred.promise;
        };

        var readFeatures = function(type) {
        	console.log("Reading:",type);

        	var deferred = Ext.create('Deft.Deferred');
            me._loadAStoreWithAPromise(
                type, 
                ["FormattedID","Name","ObjectID","CreationDate"], 
                [createFeatureFilter()],
                {   
                	project: null,
                    workspace : workspace.get("_ref")
                }
            ).then({
            	scope: me,
                success: function(features) {
                	console.log("Features:",features.length)
                    deferred.resolve(features);
                }
        	});
            return deferred.promise;
        };

        var deferred = Ext.create('Deft.Deferred');
        Deft.Chain.pipeline([readFeatureType,readFeatures],self).then({
            success: function(results) {
                deferred.resolve(results);
            },
            failure: function(error) {
            	console.log("error:",error);
            }
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
