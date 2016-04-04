'use strict';

angular.module('tempApp')
  .directive('myGrid', function ($http, uiGridConstants, gridSettings, socket, $q, tcFactory) {
  return {
    templateUrl: 'components/myGrid/myGrid.html',
    restrict: 'E',
    replace: true,
    scope: {
      myApi:'@',
      date:'=',
      smfltnum:'@',
      print:'&'
    },
    link: function (scope, element, attrs ) {
    scope.gridOptions = gridSettings.get(scope.myApi).gridOptions;
    scope.tempData = [];
    var flight;
    scope.addData = function(){
      var object = angular.copy(gridSettings.get(scope.myApi).newRecord);
      object.smfltnum = scope.smfltnum + "A";
      object['DATE TO FLY'] = scope.date;
      scope.gridOptions.data.push(object);
    };
    
    scope.removeRow = function(row) {
        //put a modal in here?
        row.entity.travelCode=undefined;
        if (row.entity._id) $http.put('/api/' + scope.myApi + '/superdelete/' + row.entity._id);
         
    };
    
    scope.return = function(row){
      //make a copy of row in the opposite direction
      var newRow = jQuery.extend(true,{},row);
      newRow.entity['$$hashKey'] = undefined;
      newRow.entity._id=undefined;
      newRow.entity['Ref#'] = 13-newRow.entity['Ref#'];
      newRow.entity['FLIGHT#'] = undefined;
      if (newRow.entity.smfltnum.substring(2)==='A') newRow.entity.smfltnum = newRow.entity.smfltnum.substring(0,2) + 'B';
      else newRow.entity.smfltnum = newRow.entity.smfltnum.substring(0,2) + 'A';
      newRow.entity['DATE RESERVED'] = new Date(Date.now());
      var index = scope.gridOptions.data.indexOf(row);
      tcFactory.getData(function(tcs) {
        newRow.entity.travelCode.value = tcs.filter(function(element){
              return element['Ref#']===newRow.entity['Ref#'];
            })[0]['Route'];
        //scope.gridOptions.data.splice(index,0,newRow.entity);    
        scope.gridOptions.data.push(newRow.entity);
      });
      
    };
    
    scope.index=0;
    scope.saveRow = function( rowEntity ) {
      scope.index = scope.gridOptions.data.indexOf(rowEntity);
      //rowEntity.dateModified = new Date();
      var preSave = gridSettings.get(scope.myApi).preSave;
      preSave.forEach(function(element){
        rowEntity[element] = new Date(rowEntity[element]);
      });
      if (scope.myApi==='reservations'){
        var body = {date:rowEntity['DATE TO FLY'], smfltnum:rowEntity.smfltnum};
        var tcs,flights, res, temp;
        var promise = tcFactory.getData(function(data){
          tcs=data;
          rowEntity['Ref#'] = tcs.filter(function(element){
              return element['Route']===rowEntity.travelCode.value;
          })[0]['Ref#'];
          rowEntity.travelCode=undefined;
          return $http.post('/api/flights/o',body);
        })
        
        .then(function(response){
          flights=response.data;
          flight = undefined;
          flights = flights.filter(function(flight){
            return flight.SmFltNum===rowEntity.smfltnum;
          });
          flights.sort(function(a,b){
            return a['FLIGHT#'].localeCompare(b['FLIGHT#']);
          });
          return $http.post('/api/reservations/day',body);
        })
        
        .then(function(response){
            var reservations =response.data.filter(function(reservation){
              return reservation.smfltnum===rowEntity.smfltnum;
            });
            for (var i=0;i<flights.length;i++){
              res = reservations.filter(function(reservation){
                return flights[i]['FLIGHT#']===reservation['FLIGHT#'];
              });
              if (res.length<4) {
                flight = flights[i]['FLIGHT#'];
                i=flights.length;
              }
            }
            if (!rowEntity['FLIGHT#']) {
              if (flight) rowEntity['FLIGHT#'] = flight;
              else rowEntity['FLIGHT#'] = '5' + rowEntity.smfltnum;
            }
            if (rowEntity._id) return ($http.patch('/api/' + scope.myApi + '/'+rowEntity._id, rowEntity));
            else {
              scope.gridOptions.data.splice(scope.index,1);
              if (!rowEntity.hasOwnProperty('uid')) scope.addData();
              return $http.patch('/api/' + scope.myApi + '/', rowEntity);
            }
        })
        ;
      }  
      else {
        if (rowEntity._id) promise =  ($http.patch('/api/' + scope.myApi + '/'+rowEntity._id, rowEntity));
            else {
              scope.gridOptions.data.splice(scope.index,1);
              if (!rowEntity.hasOwnProperty('uid')) scope.addData();
              promise = $http.patch('/api/' + scope.myApi + '/', rowEntity);
            }
      }
        
       //actually save the change
      scope.gridApi.rowEdit.setSavePromise( rowEntity, promise);
            

    };
    
    scope.gridOptions.multiSelect=false;
    
    scope.gridOptions.onRegisterApi = function(gridApi){
    //set gridApi on scope
      scope.gridApi = gridApi;
      gridApi.rowEdit.on.saveRow(scope, scope.saveRow);
    };

    scope.refreshOptions = function(){
      if (scope.myApi==="reservations"){
        //$http.get('/api/travelCodes').success(function(data){
        tcFactory.getData(function(data) {
          data.forEach(function(d){
            d.value=d['Route'];
          });
          scope.gridOptions.columnDefs[4].editDropdownOptionsArray= data;
        });
        
        
      }
    };
    
    scope.selectedRow={};
    
    scope.rowDate = function(){
      return new Date(scope.selectedRow.entity.date);
    };
    
    var tempDate=new Date(2016,2,4,0,0,0,0); 
    scope.query = "date=" + tempDate + "&hourOfDay=8";
    gridSettings.setCriteria(tempDate,8);
    scope.query = gridSettings.getQuery();
    if (scope.myApi!=="reservations") scope.query="";
    
        
      
    scope.getData = function(query){
      
      $http.post('/api/' + scope.myApi +'/o', query).success(function(data){
        data = gridSettings.getFun(scope.myApi,data);
        scope.gridOptions.data=data;
        scope.addData();
        scope.shortApi = scope.myApi.substr(0,scope.myApi.length-1);
        socket.unsyncUpdates(scope.shortApi);
        socket.syncUpdates(scope.shortApi, scope.gridOptions.data, function(event, item, array){
          scope.gridOptions.data = gridSettings.getFun(scope.myApi,array);
          scope.print();
        });
      });  
    };
    
    scope.makeQuery = function(){
      var date = new Date(scope.date);
      tempDate=new Date(date.getFullYear(),date.getMonth(),date.getDate(),0,0,0,0); 
      var query = {date: tempDate,hourOfDay:scope.smfltnum};
      scope.getData(query);
    };
    
    scope.$on('$destroy', function () {
      socket.unsyncUpdates(scope.shortApi);
    });
    scope.$watch('date',function(){
      scope.makeQuery();
    });
    if (scope.smfltnum) {
      scope.$watch('smfltnum',function(){
        scope.makeQuery();
      });
    }
    //scope.getData(scope.query);
    
    
   }
  };
  });