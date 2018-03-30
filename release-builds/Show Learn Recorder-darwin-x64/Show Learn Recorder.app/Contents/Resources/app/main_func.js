var osc = require('node-osc');
var fs = require('fs');
const electron = require('electron');
const path = require('path');

const userDataPath = (electron.app || electron.remote.app).getPath('userData');
var resultFilename = this.path = path.join(userDataPath, 'result.json');

var tsStart = Date.now()
var exports = module.exports = {};

exports.tsToTime = function(input, asString=false){
  var d = new Date(input);
  var currTime = []
  currTime[0] = (d.getHours()-1).toString().padStart(2 ,0)
  currTime[1] = d.getMinutes().toString().padStart(2 ,0)
  currTime[2] = d.getSeconds().toString().padStart(2 ,0)
  currTime[3] = d.getMilliseconds().toString().padStart(3 ,0);
  if(asString){
    return currTime[0]+":"+currTime[1]+":"+currTime[2]+","+currTime[3]
  }else{
    return currTime;
  }
}
exports.getObjById = function(input_obj, cue){
    result = input_obj.filter(function( obj ) {
      return obj.number == cue;
    });
    return result[0]
}
exports.getListByNumber = function(input_obj, cue){
    result = input_obj.filter(function( obj ) {
      return obj["$"].number == cue;
    });
    return result[0]
}
exports.writeResult = function(input){
  fs.writeFile(resultFilename, JSON.stringify(input), function(err) {
      if(err) {
          return console.log(err);
      }
  }); 
}
exports.getResult = function(callback){
  fs.readFile(resultFilename, function (err, data) {
    var json = JSON.parse(data)
    callback(json);
  })
}

exports.appendToResult = function(input){
  // Read existing file, append and write-over
  fs.readFile(resultFilename, function (err, data) {
    var json = JSON.parse(data)
    json.push(input);

    exports.writeResult(json);
  })
}

exports.parseHogExport = function(exportFile, callback){
  // Load XML File
  fs.readFile(exportFile, 'utf8', function(err, rawXML) {  
    if (err){
      console.log("Error: "+err);
       $(".logWindow").html("Error: "+err);
    }else{

      // Parse XML cuelist
      var parseString = require('xml2js').parseString;
      parseString(rawXML, function (err, result) {
        callback(err, result);
      });
    } 
  });
}
exports.resetTimer = function(){
  // Reset starttijd
  tsStart = Date.now() // Deze hoeft niet waarschijnlijk

  // Reset result file
  func.writeResult([]);
}

exports.handleOSCMsg = function(oscServer, recordedListNr, {onCueIncoming, onPing}={}){
  // Handle OSC Message
  oscServer.on("message", function (msg, rinfo) {

    // Extract payload from msg
    msgPayload = msg[2][2]
    
    // Check is go button is pushed
    if(msgPayload[0].includes("/hog/playback/go/0")){
      var recvCueArray = []

      // Extract cue nr from incoming msg
      cueInfo = msgPayload[0].split("/")[5]
      recvCueArray["list"] = cueInfo.split(".")[0]
      recvCueArray["cue"] = parseFloat(cueInfo.split(".")[1]+"."+cueInfo.split(".")[2])

      // Filter of gekozen cuelijst
      if(recvCueArray["list"] == recordedListNr){
        // Get cue info from cueList
        var currentCue = exports.getObjById(cueList, recvCueArray["cue"])

        // Check if cue exists in xml file
        if(currentCue !== undefined){

          // Calculate times
          var tsNow = Date.now()
          timestampFrom = exports.tsToTime(tsNow - tsStart, true)
          timestampTill = exports.tsToTime((tsNow - tsStart)+2000, true)

          if(currentCue.comment === undefined){ currentCue.comment = "" }
          //console.log(timestampFrom + " Cue " + String(recvCueArray["cue"]) + ": " + currentCue.name + " (" + currentCue.comment + ")");

          resultData = {
            number: recvCueArray["cue"],
            name: currentCue.name,
            comment: currentCue.comment,
            trigger: currentCue.trigger,
            time: timestampFrom,
            timestamp: tsNow - tsStart
          }
          onCueIncoming(resultData);
          exports.appendToResult(resultData)
        }else{
          console.log("Kan cue niet vinden in cuelijst, wel de goede export geladen?")
        }
      }
    }else if(msgPayload[0].includes("/hog/status/time")){
      onPing();
    }
  });
}



var count = 1;
//var outputFilename = "test.ass"
var outputType = "ass"

exports.loadJson =  function(outputFilename){
  var outputContent = ""
  var recordedData = []

  // Read existing file, append and write-over
  fs.readFile(resultFilename, function (err, data) {
      recordedData = JSON.parse(data)
      exports.getAssBegin(function(beginData){
        if(outputType == "ass"){
          outputContent += beginData
        }

      for(key in recordedData){

        if(outputType == "ass"){
          currentItem = recordedData[key]
          timestampFromCurrent = exports.tsToTime(currentItem.timestamp, outputType)
          // bepaal tijd van volgende cue
          if(key < recordedData.length-1){
            timestampTillCurrent = exports.tsToTime(recordedData[parseInt(key)+1].timestamp, outputType)

          }else{
            timestampTillCurrent = exports.tsToTime(currentItem.timestamp+2000, outputType)
          }

          // Content huidige cue
          var currentCueText = "Cue " + String(currentItem.number) + ": " + currentItem.name + " (" + currentItem.comment + ")"
          curentContent = "Dialogue: 1," + timestampFromCurrent + "," + timestampTillCurrent + ",Default,,0,0,30,," + currentCueText + "\n"
            outputContent += curentContent

            if(key < recordedData.length-1){
            // Volgende Cue
            nextItem = recordedData[parseInt(key)+1]

            // Content volgende cue
            var nextCueText = "Cue " + String(nextItem.number) + ": " + nextItem.name + " (" + nextItem.comment + ")"
              nextContent = "Dialogue: 0," + timestampFromCurrent + "," + timestampTillCurrent + ",smaller,,0,0,0,," + nextCueText + "\n"
              outputContent += nextContent
          }
        }else{
          timestampFromCurrent = exports.tsToTime(currentItem.timestamp, outputType)
          timestampTillCurrent = exports.tsToTime(currentItem.timestamp+2000, outputType)
          console.log(
            String(count) + "\n" +
            timestampFromCurrent + " --> " + timestampTillCurrent + 
            "\nCue " + String(currentItem.number) + ": " + currentItem.name + " (" + currentItem.comment + ")\n"
          )
        }
        count=count+1
      }
      fs.writeFile(outputFilename, outputContent, function(err) {
          if(err) {
              return console.log("Kan bestand niet schrijven" + err);
          }else{
            console.log("Bestand geschreven ("+outputFilename+")")
          }
      }); 
    });
  })
}
exports.getAssBegin =  function(callback){
  fs.readFile("assBegin.txt", 'utf8', function (err, data) {
    callback(data);
  });
}